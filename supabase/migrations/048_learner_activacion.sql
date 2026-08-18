-- =====================================================
-- 048 · Activación y racha máxima por alumno
-- Pasas.mx · s37
--
-- ⚠️ APLICADA A MANO en el SQL Editor de Supabase.
--    Este archivo existe para que el repo refleje el estado real de la
--    base. Todo es idempotente: volver a correrlo no rompe nada.
--
-- Tres columnas que no se pueden derivar de lo que ya hay:
--   · first_session_at  — localStorage miente al cambiar de dispositivo
--                          (tablet por la tarde, teléfono por la noche =
--                          dos "primeras sesiones"), y preguntarlo con un
--                          COUNT sobre `progress` en cada carga es peor.
--   · activated_at      — con las dos, "activado en 48h" es una resta en
--                          SQL: sin evento y sin consulta en el cliente.
--   · max_streak_days   — `learners` solo guardaba la racha ACTUAL, así que
--                          `es_record` era incomputable.
-- =====================================================

BEGIN;

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS first_session_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at     timestamptz,
  ADD COLUMN IF NOT EXISTS max_streak_days  smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.learners.first_session_at IS
  'Primer acto real del alumno (leer una sección o contestar un quiz).
   La escribe el servidor con guard de NULL: nunca se pisa. NULL = todavía
   no ha hecho nada, distinto de "empezó hoy".';

COMMENT ON COLUMN public.learners.activated_at IS
  'Momento en que completó su PRIMER quiz. Guard de NULL igual que arriba.
   activated_at - first_session_at = cuánto tardó el producto en demostrar
   valor.';

COMMENT ON COLUMN public.learners.max_streak_days IS
  'Racha más larga alcanzada. GREATEST sobre streak_days en cada escritura:
   NO cambia la lógica de rachas, solo recuerda el techo.';

-- Backfill conservador de la racha máxima: lo mínimo que sabemos con
-- certeza es que la racha actual ya se alcanzó alguna vez. No se inventa
-- histórico — sube sola en cuanto cada alumno vuelva a estudiar.
UPDATE public.learners
SET max_streak_days = streak_days
WHERE streak_days > max_streak_days;

-- 🔴 `first_session_at` y `activated_at` NO se backfillean, a propósito.
-- Se podrían derivar del MIN(created_at) de `progress`, pero eso pondría
-- fechas de hace meses en alumnos que nunca se midieron y ensuciaría
-- cualquier cohorte de activación desde el primer día.

-- Índice parcial: las consultas de activación siempre filtran por "los que
-- ya activaron", y la mayoría de las filas van en NULL.
CREATE INDEX IF NOT EXISTS idx_learners_activated_at
  ON public.learners(activated_at)
  WHERE activated_at IS NOT NULL;

COMMIT;
