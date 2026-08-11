-- ============================================================
-- 035_learners.sql — Varios alumnos por cuenta
-- Aplicada en produccion: 10 ago 2026 (sesion 28)
-- Verificada: 19 learners, 19 primarios, 17 con grado,
-- XP identico al de users, cero filas huerfanas ni cruzadas.
-- ============================================================

BEGIN;

-- 1. Tabla learners
CREATE TABLE public.learners (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  same_person_as     uuid REFERENCES public.learners(id) ON DELETE SET NULL,
  display_name       text NOT NULL,
  birthdate          date,
  education_level    education_level,
  grade              integer,
  theme_id           uuid REFERENCES public.themes(id),
  is_primary         boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'active',
  xp_total           integer NOT NULL DEFAULT 0,
  streak_days        integer NOT NULL DEFAULT 0,
  last_active_at     timestamptz,
  last_level_seen    smallint NOT NULL DEFAULT 1,
  stripe_subscription_item_id text,
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- La fecha vive en la persona, no en la fila.
  -- Fila nueva de persona nueva => trae fecha.
  -- Fila que es "el mismo de alla, otro grado" => no la repite.
  CONSTRAINT learners_birthdate_solo_persona_nueva
    CHECK ((same_person_as IS NULL) OR (birthdate IS NULL)),

  CONSTRAINT learners_status_check
    CHECK (status IN ('active','inactive')),

  -- Necesaria para la FK compuesta de las tablas hijas
  CONSTRAINT learners_id_account_key UNIQUE (id, account_user_id)
);

CREATE INDEX idx_learners_account ON public.learners(account_user_id);
CREATE INDEX idx_learners_person  ON public.learners(same_person_as);
CREATE UNIQUE INDEX idx_learners_one_primary
  ON public.learners(account_user_id) WHERE is_primary;

-- 2. Bitacora de cambios de grado (append-only)
CREATE TABLE public.learner_grade_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id  uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  from_level  education_level,
  from_grade  integer,
  to_level    education_level,
  to_grade    integer,
  reason      text NOT NULL DEFAULT 'manual',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lgc_reason_check
    CHECK (reason IN ('correccion','promocion_ciclo','manual'))
);

CREATE INDEX idx_lgc_learner ON public.learner_grade_changes(learner_id, changed_at DESC);

-- 3. Columna learner_id en las cuatro tablas del alumno
ALTER TABLE public.user_subjects   ADD COLUMN learner_id uuid;
ALTER TABLE public.progress        ADD COLUMN learner_id uuid;
ALTER TABLE public.topic_progress  ADD COLUMN learner_id uuid;
ALTER TABLE public.horde_runs      ADD COLUMN learner_id uuid;

-- 4. BACKFILL — un alumno por cada usuario existente
INSERT INTO public.learners (
  account_user_id, display_name, birthdate, education_level, grade,
  is_primary, xp_total, streak_days, last_active_at, last_level_seen, created_at
)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.full_name), ''), 'Alumno'),
  u.birthdate,
  u.education_level,
  u.grade,
  true,
  u.xp_total,
  u.streak_days,
  u.last_active_at,
  u.last_level_seen,
  u.created_at
FROM public.users u;

UPDATE public.user_subjects  c SET learner_id = l.id
  FROM public.learners l WHERE l.account_user_id = c.user_id AND l.is_primary;
UPDATE public.progress       c SET learner_id = l.id
  FROM public.learners l WHERE l.account_user_id = c.user_id AND l.is_primary;
UPDATE public.topic_progress c SET learner_id = l.id
  FROM public.learners l WHERE l.account_user_id = c.user_id AND l.is_primary;
UPDATE public.horde_runs     c SET learner_id = l.id
  FROM public.learners l WHERE l.account_user_id = c.user_id AND l.is_primary;

-- 5. NOT NULL + FK compuesta (learner_id, user_id)
-- Hace IMPOSIBLE que una fila de progreso quede colgada del alumno de
-- otra cuenta. Lo garantiza Postgres, no la disciplina de la aplicacion.
ALTER TABLE public.user_subjects
  ALTER COLUMN learner_id SET NOT NULL,
  ADD CONSTRAINT user_subjects_learner_fk
    FOREIGN KEY (learner_id, user_id)
    REFERENCES public.learners(id, account_user_id) ON DELETE CASCADE;

ALTER TABLE public.progress
  ALTER COLUMN learner_id SET NOT NULL,
  ADD CONSTRAINT progress_learner_fk
    FOREIGN KEY (learner_id, user_id)
    REFERENCES public.learners(id, account_user_id) ON DELETE CASCADE;

ALTER TABLE public.topic_progress
  ALTER COLUMN learner_id SET NOT NULL,
  ADD CONSTRAINT topic_progress_learner_fk
    FOREIGN KEY (learner_id, user_id)
    REFERENCES public.learners(id, account_user_id) ON DELETE CASCADE;

ALTER TABLE public.horde_runs
  ALTER COLUMN learner_id SET NOT NULL,
  ADD CONSTRAINT horde_runs_learner_fk
    FOREIGN KEY (learner_id, user_id)
    REFERENCES public.learners(id, account_user_id) ON DELETE CASCADE;

-- 6. Reconstruir las tres llaves que colisionaban.
-- Con la PK vieja, dos hermanos en el mismo grado no podian tocar el
-- mismo tema ni comprar la misma materia: violacion de llave unica.
ALTER TABLE public.topic_progress DROP CONSTRAINT topic_progress_pkey;
ALTER TABLE public.topic_progress ADD  PRIMARY KEY (learner_id, topic_id);

ALTER TABLE public.horde_runs DROP CONSTRAINT horde_runs_pkey;
ALTER TABLE public.horde_runs ADD  PRIMARY KEY (learner_id, topic_id);

ALTER TABLE public.user_subjects DROP CONSTRAINT user_subjects_user_id_subject_id_key;
ALTER TABLE public.user_subjects
  ADD CONSTRAINT user_subjects_learner_id_subject_id_key UNIQUE (learner_id, subject_id);

CREATE INDEX idx_progress_learner ON public.progress(learner_id, created_at DESC);

-- 7. RLS
ALTER TABLE public.learners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_grade_changes ENABLE ROW LEVEL SECURITY;

-- Solo lectura para el cliente. Las escrituras van por server action con
-- service role, a proposito: la politica 'users: update own row' no filtra
-- columnas, y copiar ese patron aqui dejaria que el cliente se otorgue
-- solo la fecha de nacimiento de un menor.
CREATE POLICY "learners: select own" ON public.learners
  FOR SELECT USING (auth.uid() = account_user_id);

CREATE POLICY "learners: admin" ON public.learners
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

CREATE POLICY "lgc: select own" ON public.learner_grade_changes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.learners l
    WHERE l.id = learner_id AND l.account_user_id = auth.uid()
  ));

-- Las 15 politicas existentes NO se tocan: user_id se conserva en las
-- tablas hijas y 'auth.uid() = user_id' sigue siendo la regla de propiedad.

-- 8. Funciones de XP.
-- DROP explicito: CREATE OR REPLACE con distinta firma NO reemplaza, deja
-- las dos vivas. La vieja seguiria siendo llamable y sumaria XP a todos
-- los alumnos de la cuenta.
DROP FUNCTION IF EXISTS public.increment_xp(uuid, integer);
DROP FUNCTION IF EXISTS public.increment_subject_xp(uuid, uuid, integer);

CREATE FUNCTION public.increment_learner_xp(lid uuid, amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.learners SET xp_total = xp_total + amount WHERE id = lid;
END; $$;

CREATE FUNCTION public.increment_subject_xp(lid uuid, sid uuid, amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.user_subjects
  SET xp = xp + amount
  WHERE learner_id = lid AND subject_id = sid;
END; $$;

-- 9. Columnas legacy. No se borran todavia: hay codigo vivo leyendolas
-- (admin, posthog-provider). Migracion 038 pendiente para dropearlas.
COMMENT ON COLUMN public.users.education_level IS 'LEGACY s28 — la verdad vive en learners. No leer.';
COMMENT ON COLUMN public.users.grade           IS 'LEGACY s28 — la verdad vive en learners. No leer.';
COMMENT ON COLUMN public.users.xp_total        IS 'LEGACY s28 — la verdad vive en learners. No leer.';
COMMENT ON COLUMN public.users.streak_days     IS 'LEGACY s28 — la verdad vive en learners. No leer.';
COMMENT ON COLUMN public.users.last_active_at  IS 'LEGACY s28 — la verdad vive en learners. No leer.';
COMMENT ON COLUMN public.users.last_level_seen IS 'LEGACY s28 — la verdad vive en learners. No leer.';

COMMIT;
