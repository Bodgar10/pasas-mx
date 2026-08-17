-- 043_subscription_promo.sql
-- ---------------------------------------------------------------------------
-- Qué campaña trajo cada suscripción.
--
-- Es la métrica "cupón usado en el registro": sin esta columna no se puede
-- segmentar retención por campaña, y saber si quien entró por PASAS1 sigue
-- pagando en el mes 3 es la única forma de decidir si la promo valió la pena.
--
-- 🔴 NULL significa "sin promoción" y es un dato correcto, no un hueco. El
-- webhook lo escribe desde la metadata de la suscripción y NO lleva ningún
-- fallback: si no viene, queda NULL. Los `?? valor_inventado` de este webhook
-- se quitaron a propósito en la s27 — el de los periodos estuvo meses
-- escribiendo fechas falsas sin un solo error en los logs.
--
-- No hay FK a promo_campaigns(slug) a propósito: si algún día se borra una
-- campaña, la suscripción tiene que conservar el registro histórico de con
-- qué se vendió. Un ON DELETE CASCADE borraría la evidencia y un RESTRICT
-- volvería imborrable la campaña.
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN promo_slug text;

COMMENT ON COLUMN public.subscriptions.promo_slug IS
  'Slug de promo_campaigns con el que se vendio. NULL = sin promocion.';

-- Índice parcial, mismo patrón que idx_subscriptions_paused_until en la
-- migración 015: la mayoría de las filas van en NULL y las consultas de
-- análisis siempre filtran por una campaña concreta.
CREATE INDEX idx_subscriptions_promo_slug ON public.subscriptions(promo_slug)
  WHERE promo_slug IS NOT NULL;
