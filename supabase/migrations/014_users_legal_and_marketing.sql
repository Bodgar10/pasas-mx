-- Migración: 014_users_legal_and_marketing.sql
-- Aceptación de términos (LFPC + PROFECO 2025)
ALTER TABLE public.users
  ADD COLUMN tos_accepted_version text,
  ADD COLUMN tos_accepted_at timestamptz,
  ADD COLUMN tos_accepted_ip text;

-- Atribución de marketing
-- Estructura: { utm_source, utm_medium, utm_campaign, utm_content, utm_term,
--               referrer, landing_url, first_touch_at }
ALTER TABLE public.users
  ADD COLUMN acquisition_source jsonb;

-- Consentimiento parental para menores de 18
ALTER TABLE public.users
  ADD COLUMN parent_name text,
  ADD COLUMN parent_email text,
  ADD COLUMN parental_consent_at timestamptz,
  ADD COLUMN parental_consent_ip text;

-- Sistema de referidos
ALTER TABLE public.users
  ADD COLUMN referral_code text UNIQUE,
  ADD COLUMN referred_by_user_id uuid REFERENCES public.users(id);

-- Índices
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_acquisition_source ON public.users USING gin(acquisition_source);
