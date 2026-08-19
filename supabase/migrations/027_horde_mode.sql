-- 027_horde_mode.sql
-- Modo Horda: banco de repaso por topic (6 oleadas x 5 preguntas),
-- mas el bloque 'match' del enum de secciones y el audio narrado.
--
-- ===========================================================================
-- 🔴 ESTE ARCHIVO ES LA FUSION DE TRES QUE COMPARTIAN EL NUMERO 027.
--
-- Habia tres archivos con el mismo prefijo:
--     027_horde_mode.sql     (este)
--     027_match_block.sql    -> ahora BLOQUE 3
--     027_section_audio.sql  -> ahora BLOQUE 4
--
-- POR QUE SE FUSIONARON. El CLI de Supabase registra cada migracion en
-- `supabase_migrations.schema_migrations`, cuya columna `version` es PRIMARY
-- KEY y sale del prefijo numerico del nombre del archivo. Los tres producian
-- la clave '027', asi que al reconstruir la base de cero el primero se
-- registraba y el segundo moria con:
--
--     ERROR: duplicate key value violates unique constraint
--            "schema_migrations_pkey" (SQLSTATE 23505)
--     Key (version)=(027) already exists.
--
-- No era un error de SQL: el INSERT que falla es el del propio CLI. Y el
-- orden entre los tres lo decidia el alfabeto, no una decision de nadie.
--
-- POR QUE NUNCA EXPLOTO EN PRODUCCION. Alla los tres se aplicaron A MANO en
-- el SQL Editor, que no escribe en `schema_migrations`. Sin registro no hay
-- clave primaria que violar, asi que la colision solo aparece cuando alguien
-- reconstruye la base desde este directorio — que es justo lo que hace un
-- entorno de pruebas.
--
-- EL ORDEN SE CONSERVA tal como estaba (alfabetico: horde_mode, match_block,
-- section_audio), asi que el resultado es identico al que se aplico a mano.
--
-- ===========================================================================
-- 🔴 SOBRE LOS `ALTER TYPE` Y LA TRANSACCION
--
-- La nota original de este archivo decia que los ALTER TYPE debian correrse
-- en una transaccion separada, porque Postgres no permite USAR un valor de
-- enum en la misma transaccion en que se creo. Esa advertencia describe como
-- se aplico en produccion —bloque 1 solo, confirmar, despues el bloque 2— y
-- se conserva por eso.
--
-- Pero el CLI aplica cada migracion en UNA sola transaccion, y aqui eso
-- funciona: ningun bloque de este archivo usa los valores nuevos
-- ('horde_answered', 'horde_wave_cleared', 'horde_completed', 'match'). Solo
-- los declara. Las tablas del bloque 2 no referencian `event_type`, y el
-- bloque 4 solo agrega columnas a `sections` sin tocar `section_type`.
--
-- 🔴 SI ALGUN DIA SE AGREGA AQUI UNA SENTENCIA QUE USE UNO DE ESOS VALORES
-- —un INSERT, un DEFAULT, un CHECK, una comparacion— esta migracion dejara
-- de correr de cero y habra que partirla en dos archivos con numeros
-- distintos.
-- ===========================================================================

-- ============================================================
-- BLOQUE 1 — enum (correr solo)
-- ============================================================

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'horde_answered';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'horde_wave_cleared';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'horde_completed';

-- ============================================================
-- BLOQUE 2 — tablas, indices y RLS
-- ============================================================

-- Banco de preguntas. BASE: sin theme_id, a proposito.
-- La horda simula el examen real de la escuela, que no viene tematizado.
CREATE TABLE public.horde_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id       uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  wave           smallint NOT NULL CHECK (wave BETWEEN 1 AND 6),
  difficulty     smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  question       text NOT NULL,
  options        jsonb NOT NULL,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  hint           text NOT NULL,
  explanation    text NOT NULL,
  source         text NOT NULL DEFAULT 'ai',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, wave, question)
);

CREATE INDEX idx_horde_q_topic_wave ON public.horde_questions(topic_id, wave);

-- Progreso y record por alumno por topic.
-- waves_cleared da la idempotencia del XP: solo se otorga la primera vez
-- que se limpia cada oleada.
CREATE TABLE public.horde_runs (
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id       uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  best_wave      smallint NOT NULL DEFAULT 0,
  attempts       integer NOT NULL DEFAULT 0,
  waves_cleared  smallint[] NOT NULL DEFAULT '{}',
  completed_at   timestamptz,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX idx_horde_runs_user ON public.horde_runs(user_id);

ALTER TABLE public.horde_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horde_runs      ENABLE ROW LEVEL SECURITY;

-- horde_questions: SIN politica para authenticated, a proposito.
-- Con una politica de SELECT, cualquier alumno se baja las 30 preguntas
-- con correct_answer desde la consola. Los endpoints leen con
-- SUPABASE_SERVICE_ROLE_KEY (salta RLS) y quitan la respuesta correcta
-- antes de responder al cliente.
CREATE POLICY "horde_q_admin" ON public.horde_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- horde_runs: el alumno LEE su record, nunca escribe.
-- Sin INSERT ni UPDATE para authenticated: si los tuviera, se pondria
-- best_wave = 6 desde la consola. Solo escriben los endpoints.
CREATE POLICY "horde_runs_own_read" ON public.horde_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "horde_runs_admin" ON public.horde_runs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- BLOQUE 3 — bloque 'match' del enum de secciones
--
-- Venia de 027_match_block.sql, fusionado aqui (ver cabecera).
--
-- Es idempotente y ADEMAS redundante con 029_match_section_type.sql, que
-- hace exactamente lo mismo. Aquella se escribio como migracion retroactiva
-- al descubrir que el valor se habia agregado a mano en produccion y nunca
-- habia quedado en un archivo. Se conservan las dos: el `IF NOT EXISTS` las
-- hace inofensivas, y borrar cualquiera de las dos rompe la historia que
-- cada una documenta.
-- ============================================================

ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'match';

-- ============================================================
-- BLOQUE 4 — audio narrado por seccion
--
-- Venia de 027_section_audio.sql, fusionado aqui (ver cabecera).
-- ============================================================

-- Audio narrado por sección (voz clonada, pre-generado y servido estático).
-- Aplica solo a bloques de TEXTO (explanation, analogy, example, key_fact, tip).
-- Los bloques interactivos y el diagram no llevan audio (audio_url queda NULL).
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS audio_duration numeric;

COMMENT ON COLUMN public.sections.audio_url IS 'URL pública del MP3 narrado (Supabase Storage). NULL = sin audio.';
COMMENT ON COLUMN public.sections.audio_duration IS 'Duración del audio en segundos. Se guarda al generar para pintar el tiempo sin descargar el MP3.';
