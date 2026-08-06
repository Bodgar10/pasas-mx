-- 034_cookie_consent.sql
-- Consentimiento de cookies y rastreo.
--
-- SEPARADO de marketing_consent (migración 014), que es el checkbox de
-- correos promocionales del registro. Son cosas distintas: alguien puede
-- querer recibir tus correos y NO querer que Meta lo rastree. Si
-- compartieran columna, ante una solicitud ARCO no se podría distinguir
-- qué revocar.
--
-- El consentimiento se recaba en el banner (src/components/global/
-- CookieConsent.tsx), vive en localStorage mientras la persona es un
-- visitante anónimo, y se vuelca aquí al registrarse desde
-- src/app/(auth)/registro/actions.ts.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cookie_consent_analytics boolean,
  ADD COLUMN IF NOT EXISTS cookie_consent_marketing boolean,
  ADD COLUMN IF NOT EXISTS cookie_consent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS cookie_consent_ip        text,
  ADD COLUMN IF NOT EXISTS cookie_consent_version   text;

COMMENT ON COLUMN public.users.cookie_consent_analytics IS
  'GA4, Clarity, PostHog. NULL = nunca contestó el banner, distinto de false.';

COMMENT ON COLUMN public.users.cookie_consent_marketing IS
  'Meta, TikTok, Google Ads. Transferencias art. 35 LFPDPPP.';

COMMENT ON COLUMN public.users.cookie_consent_at IS
  'Fecha del BANNER, no del registro. Puede ser días antes.';

COMMENT ON COLUMN public.users.cookie_consent_ip IS
  'Del servidor, nunca del cliente. Mismo patrón que tos_accepted_ip.';
