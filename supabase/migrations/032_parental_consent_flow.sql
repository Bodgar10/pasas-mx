-- ============================================================
-- 032_parental_consent_flow.sql
-- Sesión 25 — Flujo de consentimiento parental + preferencia de marketing
-- ============================================================
-- Renumerada desde el "027" del documento legal (14 jul): ese número
-- lo tomó 027_horde_mode.sql en la s23. 023-025 siguen RESERVADAS
-- para holiday_mode, exam_plans y tax_data.
--
-- Las columnas parent_name / parent_email / parental_consent_at /
-- parental_consent_ip YA EXISTEN desde la migración 014.
--
-- Idempotente.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'parental_consent_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.parental_consent_status AS ENUM (
      'not_required',
      'pending',
      'granted'
    );
  END IF;
END$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS parental_consent_status public.parental_consent_status
      NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS parental_consent_token text,
  ADD COLUMN IF NOT EXISTS parental_consent_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_parental_consent_token_key
  ON public.users (parental_consent_token)
  WHERE parental_consent_token IS NOT NULL;

COMMENT ON COLUMN public.users.birthdate IS
  'Fecha de nacimiento capturada en el age gate. Determina si aplica consentimiento parental.';

COMMENT ON COLUMN public.users.parental_consent_status IS
  'not_required | pending | granted. Con pending, el middleware manda a /autorizar-menor.';

COMMENT ON COLUMN public.users.parental_consent_token IS
  'Token de un solo uso. NO se borra al usarse: se conserva como llave de consulta y el estado lo dicta parental_consent_status.';

COMMENT ON COLUMN public.users.marketing_consent IS
  'NULL = el usuario todavía no elige. true/false = eligió. NUNCA disparar finalidades secundarias con NULL.';

COMMENT ON COLUMN public.users.tos_accepted_ip IS
  'IP de la aceptación de T&C y Aviso. Existe desde la 014 pero NO se escribía; se cableó en s25. Finalidad primaria 6 del Aviso.';
