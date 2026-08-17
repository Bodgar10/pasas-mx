-- 042_promo_campaigns.sql
-- ---------------------------------------------------------------------------
-- CAMPAÑAS DE PROMOCION — interruptor en admin.
--
-- Una fila por campaña. `activa` es el interruptor: apagarlo desde /admin
-- retira la promoción de toda la app sin deploy, que es justo lo que los
-- feature flags de src/lib/feature-flags.ts NO pueden hacer (son env vars
-- NEXT_PUBLIC_*, se inlinean en el bundle en build time).
--
-- 🔴 `codigo_visible` es la ÚNICA fuente del descuento. No se guarda ningún
-- id de Stripe: el promotion code (promo_...) se resuelve en tiempo de
-- checkout con stripe.promotionCodes.list({ code, active: true }).
--
-- Guardar el id además del código sería tener dos fuentes para la misma cosa,
-- y la que manda es la que Stripe reconoce. Resolverlo cada vez también
-- significa que desactivar el código EN STRIPE apaga la promo sola, sin tener
-- que acordarse de tocar esta tabla.
--
-- `descuento_tipo` y `descuento_valor` NO descuentan nada: solo existen para
-- ANUNCIAR el precio en pantalla. Si no coinciden con el cupón que Stripe
-- tiene detrás del código, la pantalla promete un monto y la tarjeta cobra
-- otro — el problema de PROFECO que ya costó dos correcciones en los asientos
-- adicionales. Ese desajuste lo detecta POST /api/admin/promo/verify, y es lo
-- que hay que correr antes de prender una campaña.
--
-- El seed entra con activa = FALSE: el renglón queda listo, solo apagado.
-- ---------------------------------------------------------------------------

CREATE TABLE public.promo_campaigns (
  slug                     text PRIMARY KEY,
  activa                   boolean NOT NULL DEFAULT false,
  codigo_visible           text NOT NULL,
  planes                   text[] NOT NULL,
  ciclos                   text[] NOT NULL,
  descuento_tipo           text NOT NULL CHECK (descuento_tipo IN ('monto','porcentaje')),
  descuento_valor          numeric NOT NULL,
  inicia_at                timestamptz,
  termina_at               timestamptz,
  cta_label                text NOT NULL,
  cta_sublabel             text,
  badge_landing            text,
  banner_checkout          text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- `planes` usa las claves de PLAN_DISPLAY (estandar_v2, personalizado_v2) y
-- `ciclos` el vocabulario de DISPLAY (mensual, semestral, anual), NO el de
-- la base (monthly, semestral, annual). Es el vocabulario con el que
-- PLAN_DISPLAY.prices se llavea en src/lib/payments/config.ts, y es de donde
-- precioConPromo() lee el precio de lista. Mezclarlos deja el descuento sin
-- calcular y la promo se apaga en silencio.
COMMENT ON COLUMN public.promo_campaigns.planes IS
  'Claves de PLAN_DISPLAY: estandar_v2 | personalizado_v2';
COMMENT ON COLUMN public.promo_campaigns.ciclos IS
  'Vocabulario de PLAN_DISPLAY.prices: mensual | semestral | anual';
COMMENT ON COLUMN public.promo_campaigns.codigo_visible IS
  'Fuente del descuento. Se resuelve en Stripe con promotionCodes.list({ code, active: true }).';
COMMENT ON COLUMN public.promo_campaigns.descuento_valor IS
  'Solo para anunciar en pantalla. El descuento real lo aplica el cupon detras de codigo_visible.';

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;

-- Lectura pública SOLO de campañas prendidas. Incluye anon a propósito: la
-- landing se ve sin sesión y /planes crea sesión anónima.
--
-- La tabla ya no guarda nada secreto —el código es público por definición, va
-- impreso en el anuncio—, así que una fila activa se puede leer entera sin
-- riesgo. /api/promo igual devuelve solo los campos de pintado: no por
-- secreto, sino para que la UI no dependa de columnas que no necesita.
CREATE POLICY "promo_campaigns: public read active" ON public.promo_campaigns
  FOR SELECT
  TO anon, authenticated
  USING (activa = true);

-- Patrón copiado de 035_learners.sql ("learners: admin").
CREATE POLICY "promo_campaigns: admin" ON public.promo_campaigns
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

-- ── Seed: PASAS1, apagada ──────────────────────────────────────────────────
-- $249 de lista − $248 de descuento = $1 el primer mes.
--
-- El renglón queda listo, solo apagado. Antes de prenderlo desde
-- /admin/promociones: crear en Stripe un promotion code con code = 'PASAS1'
-- sobre un cupón de $248 MXN off, y correr "Verificar en Stripe" en esa
-- pantalla. Si marca DESAJUSTE, no se prende.
INSERT INTO public.promo_campaigns (
  slug,
  activa,
  codigo_visible,
  planes,
  ciclos,
  descuento_tipo,
  descuento_valor,
  cta_label,
  cta_sublabel,
  badge_landing,
  banner_checkout
) VALUES (
  'pasas1',
  FALSE,
  'PASAS1',
  '{estandar_v2}',
  '{mensual}',
  'monto',
  248,
  'Empieza por $1',
  'Tus primeros 7 días son gratis.',
  'Primer mes a $1',
  'Primer mes a $1 — después $249/mes. Cancela cuando quieras.'
);
