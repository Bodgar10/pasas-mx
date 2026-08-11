-- ============================================================
-- 039_seats.sql — Asientos adicionales
-- Aplicada en produccion: 11 ago 2026 (sesion 29)
-- ============================================================

BEGIN;

-- Tres estados, no dos. Una baja NO libera el asiento de inmediato:
-- quien se da de baja a media de un semestral conserva acceso hasta el
-- fin del periodo —ya esta pagado, misma regla que la cancelacion
-- normal— y su asiento sigue ocupado hasta entonces.
-- Sin 'ending' se podria dar de baja y agregar otro el mismo dia:
-- cuatro personas estudiando pagando tres.
ALTER TABLE public.learners DROP CONSTRAINT learners_status_check;

ALTER TABLE public.learners
  ADD CONSTRAINT learners_status_check
  CHECK (status IN ('active','ending','inactive'));

-- Hasta cuando conserva acceso un asiento dado de baja.
-- NULL mientras esta activo.
ALTER TABLE public.learners ADD COLUMN access_until timestamptz;

-- Fecha de alta del asiento, para el desglose del prorrateo y para
-- distinguir el asiento original de los agregados despues.
ALTER TABLE public.learners ADD COLUMN seat_added_at timestamptz;

UPDATE public.learners SET seat_added_at = created_at WHERE is_primary;

-- Asientos que ocupan lugar: activos, y en baja con acceso vigente.
-- 🔴 El tope de MAX_SEATS se calcula con esto, NO contando filas con
-- status='active' a secas.
CREATE OR REPLACE FUNCTION public.occupied_seats(p_account uuid)
RETURNS smallint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::smallint
  FROM public.learners
  WHERE account_user_id = p_account
    AND (
      status = 'active'
      OR (status = 'ending' AND access_until > now())
    );
$$;

COMMIT;
