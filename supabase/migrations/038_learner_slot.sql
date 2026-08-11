-- ============================================================
-- 038_learner_slot.sql — Identificador corto de alumno
-- Aplicada en produccion: 11 ago 2026 (sesion 29)
-- Verificada: 21 learners, 21 con slot, max_slot = 1
--
-- El slot va en la URL como `?a=2`. Es un numero local a cada cuenta,
-- no un uuid: el "1" de una cuenta y el "1" de otra son alumnos
-- distintos, asi que fuera de la sesion no significa nada. Ademas la
-- RLS de learners impide leer alumnos de otra cuenta aunque se adivine.
-- ============================================================

BEGIN;

ALTER TABLE public.learners ADD COLUMN slot smallint;

UPDATE public.learners SET slot = 1 WHERE is_primary;

ALTER TABLE public.learners ALTER COLUMN slot SET NOT NULL;

CREATE UNIQUE INDEX idx_learners_slot
  ON public.learners(account_user_id, slot);

-- Siguiente slot libre. Usa MAX+1 y NO reutiliza huecos a proposito:
-- un slot nunca debe referirse a dos personas distintas en la historia
-- de una cuenta, o un link viejo apuntaria a alguien mas.
CREATE OR REPLACE FUNCTION public.next_learner_slot(p_account uuid)
RETURNS smallint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(slot), 0)::smallint + 1
  FROM public.learners
  WHERE account_user_id = p_account;
$$;

COMMIT;
