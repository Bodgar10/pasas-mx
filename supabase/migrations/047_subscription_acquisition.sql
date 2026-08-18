-- =====================================================
-- 047 · Canal de origen en cada suscripción
-- Pasas.mx · s34
--
-- ⚠️ APLICADA A MANO en el SQL Editor de Supabase.
--    Este archivo existe para que el repo refleje el estado real de la
--    base. Todo es idempotente: volver a correrlo no rompe nada.
--
-- El first-touch ya vivía en users.acquisition_source pero no llegaba a la
-- venta: no se podía cruzar canal × promo × ingreso sin adivinar. Ahora las
-- dos puertas de checkout lo mandan en la metadata de Stripe y el webhook lo
-- escribe aquí, congelado en el momento del cobro.
-- =====================================================

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS acquisition jsonb;

COMMENT ON COLUMN public.subscriptions.acquisition IS
  'Canal del first-touch tal como llegó en la metadata de Stripe. Claves:
   utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
   landing_url. NULL = orgánico, o pago anterior a s34 — NUNCA ''direct''.
   promo_slug NO va aquí: tiene columna propia desde la migración 043.';

-- Índices de EXPRESIÓN, no GIN.
--
-- users.acquisition_source usa GIN (migración 014) porque ahí se buscaba por
-- contención. Aquí las consultas siempre agrupan por dos claves concretas, y
-- para eso un btree sobre la expresión es más chico y más rápido que un GIN
-- sobre el documento entero.
--
-- Parciales: la mayoría de las filas históricas van en NULL, mismo patrón que
-- idx_subscriptions_promo_slug.
CREATE INDEX IF NOT EXISTS idx_subscriptions_utm_source
  ON public.subscriptions ((acquisition->>'utm_source'))
  WHERE acquisition IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_utm_campaign
  ON public.subscriptions ((acquisition->>'utm_campaign'))
  WHERE acquisition IS NOT NULL;

COMMIT;
