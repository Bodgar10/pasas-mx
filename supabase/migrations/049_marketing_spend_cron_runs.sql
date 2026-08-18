-- =====================================================
-- 049 · Gasto publicitario y bitácora de crons
-- Pasas.mx · s39
--
-- ⚠️ APLICADA A MANO en el SQL Editor de Supabase el 18-ago-2026, con la
--    opción "Run and enable RLS". Este archivo existe para que el repo
--    refleje el estado real de la base. Todo es idempotente: volver a
--    correrlo no rompe nada.
--
-- ── RLS SIN POLÍTICAS, A PROPÓSITO ───────────────────────────────────
-- Las dos tablas quedan con `rowsecurity = true` y CERO políticas. En
-- Postgres eso significa que nadie que llegue con la clave anónima o de
-- `authenticated` puede leer ni escribir: sin política que lo permita, la
-- respuesta es siempre vacía.
--
-- El tablero de /admin/metricas las lee igual porque usa el SERVICE ROLE
-- KEY, que se salta RLS por diseño. Es el mismo patrón que ya usa el resto
-- del admin (ver src/app/(admin)/admin/metricas/_lib/datos.ts).
--
-- 🔴 NO añadir políticas "por si acaso". Aquí hay dos cosas que no deben
-- salir nunca del servidor: cuánto se gasta en publicidad, y el detalle de
-- ejecución de los crons. Si algún día hace falta leerlas desde el cliente,
-- se escribe la política concreta con la condición concreta, no un
-- `USING (true)`.
-- =====================================================

BEGIN;

-- ── marketing_spend ─────────────────────────────────────────────────
-- Captura MANUAL. No hay integración con las plataformas de anuncios y
-- montarla es otro trabajo: mientras tanto, una fila por canal y mes
-- basta para que CAC y LTV/CAC existan.
--
-- `mes` es el PRIMER DÍA del mes, no un texto: así se puede ordenar,
-- filtrar por rango y unir con date_trunc('month', …) sin parsear nada.
CREATE TABLE IF NOT EXISTS public.marketing_spend (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal       text NOT NULL,
  mes         date NOT NULL,
  monto_mxn   integer NOT NULL CHECK (monto_mxn >= 0),
  nota        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Una fila por canal y mes. Sin esto, dos capturas del mismo mes
  -- duplican el gasto y el CAC sale a la mitad.
  CONSTRAINT marketing_spend_canal_mes_key UNIQUE (canal, mes),
  -- Coincide con utm_source para poder unir sin traducir.
  CONSTRAINT marketing_spend_mes_dia1 CHECK (date_trunc('month', mes) = mes)
);

COMMENT ON TABLE public.marketing_spend IS
  'Gasto publicitario por canal y mes. Captura manual. `canal` debe
   coincidir con el utm_source que llega en acquisition_source, o el
   join para calcular CAC no encuentra nada.';

COMMENT ON COLUMN public.marketing_spend.monto_mxn IS
  'En CENTAVOS, igual que subscriptions.price_mxn. Mezclar unidades
   entre las dos tablas da un CAC 100 veces mayor o menor.';

CREATE INDEX IF NOT EXISTS idx_marketing_spend_mes
  ON public.marketing_spend(mes DESC);

-- ── cron_runs ───────────────────────────────────────────────────────
-- 🔴 MAX(renewal_notice_sent_at) NO sirve: dice cuándo se avisó a
-- alguien, no cuándo corrió el cron. Un cron que corre y no encuentra a
-- nadie es indistinguible de uno que no corre — que es exactamente lo
-- que pasó en s30 y costó semanas descubrir.
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron            text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  rows_processed  integer,
  error           text,
  CONSTRAINT cron_runs_nombre_check
    CHECK (cron IN ('profeco-renewal-notice', 'pauses-ending'))
);

COMMENT ON TABLE public.cron_runs IS
  'Una fila por EJECUCIÓN, no por resultado. rows_processed = 0 con
   error NULL significa "corrió y no había nada que hacer", que es
   distinto de no tener fila.';

COMMENT ON COLUMN public.cron_runs.finished_at IS
  'NULL = la corrida arrancó y no terminó. Un timeout deja la fila así
   y eso es información, no un hueco.';

CREATE INDEX IF NOT EXISTS idx_cron_runs_cron_fecha
  ON public.cron_runs(cron, started_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────
-- Lo que aplicó Supabase con "Run and enable RLS". Va explícito en el
-- archivo para que recrear la base desde las migraciones deje el mismo
-- estado que la base real: sin estas dos líneas, un `db reset` dejaría
-- las tablas ABIERTAS y nadie lo notaría hasta que alguien las leyera
-- desde el cliente.
ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_runs       ENABLE ROW LEVEL SECURITY;

COMMIT;
