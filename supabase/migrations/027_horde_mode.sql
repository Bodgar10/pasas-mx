-- 027_horde_mode.sql
-- Modo Horda: banco de repaso por topic (6 oleadas x 5 preguntas).
--
-- IMPORTANTE: los ALTER TYPE deben correrse en una transaccion separada
-- del resto. Postgres no permite usar un valor de enum en la misma
-- transaccion en que se creo. Al aplicar por SQL Editor, correr el
-- bloque 1 solo, confirmar, y despues el bloque 2.

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
