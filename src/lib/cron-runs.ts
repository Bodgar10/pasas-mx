import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Bitácora de ejecuciones de cron. Tabla `cron_runs` (migración 049).
 *
 * ── POR QUÉ LA FILA SE ABRE AL ARRANCAR ───────────────────────────────
 *
 * 🔴 Si se escribiera al terminar, un timeout no dejaría rastro y
 * volveríamos al problema de origen: en s30 estuvimos semanas sin saber si
 * `pauses-ending` funcionaba, porque un cron que corre y no encuentra a
 * nadie era indistinguible de uno que no corre.
 *
 * Una fila con `finished_at` en NULL significa "arrancó y no terminó", y
 * eso ES información: timeout, crash, o deploy a media ejecución.
 *
 * Va DESPUÉS del 401 a propósito: un atacante sin el `CRON_SECRET` no debe
 * poder llenar la tabla. Un secreto mal configurado se detecta igual —
 * simplemente no hay ninguna corrida ese día.
 *
 * ── NUNCA LANZA ───────────────────────────────────────────────────────
 *
 * Las dos funciones se tragan cualquier error y lo loguean. Un fallo
 * escribiendo la bitácora no puede impedir que se manden los avisos de la
 * LFPC ni que se reactiven las suscripciones pausadas: la bitácora existe
 * para observar el trabajo, no para condicionarlo.
 */

export type NombreCron = 'profeco-renewal-notice' | 'pauses-ending'

/**
 * Abre la fila. Devuelve su id, o null si no se pudo escribir —en cuyo
 * caso `cerrarCorrida` no hace nada y el cron sigue igual.
 */
export async function iniciarCorrida(
  supabase: SupabaseClient,
  cron: NombreCron
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('cron_runs')
      .insert({ cron, started_at: new Date().toISOString() })
      .select('id')
      .single()

    if (error) {
      console.error(`[cron_runs] no se pudo abrir la corrida de ${cron}:`, error)
      return null
    }
    return (data?.id as string) ?? null
  } catch (err) {
    console.error(`[cron_runs] excepción al abrir la corrida de ${cron}:`, err)
    return null
  }
}

/**
 * Cierra la fila abierta por `iniciarCorrida`.
 *
 * `rowsProcessed` son FILAS PROCESADAS, no trabajo completado con éxito:
 * en profeco eso es `total`, no `sent`. Son cosas distintas y la columna
 * dice "processed". El detalle de los fallos va en `error`, legible sin
 * abrir los logs de Vercel.
 *
 * 🔴 `rowsProcessed: 0` con `error` en NULL es un resultado válido y es
 * justo el caso que hoy no se distingue: "corrió y no había nada que
 * hacer".
 */
export async function cerrarCorrida(
  supabase: SupabaseClient,
  id: string | null,
  datos: { rowsProcessed: number; error?: string | null }
): Promise<void> {
  if (!id) return
  try {
    const { error } = await supabase
      .from('cron_runs')
      .update({
        finished_at: new Date().toISOString(),
        rows_processed: datos.rowsProcessed,
        error: datos.error ?? null,
      })
      .eq('id', id)

    if (error) console.error('[cron_runs] no se pudo cerrar la corrida:', error)
  } catch (err) {
    console.error('[cron_runs] excepción al cerrar la corrida:', err)
  }
}

/**
 * Resume una lista de fallos en una línea legible.
 *
 * "3 de 10 fallaron: Sub abc — Stripe timeout · Sub def — …"
 *
 * Se trunca a 900 caracteres: la columna es `text` y no tiene límite, pero
 * un volcado de cien errores en una celda no lo lee nadie. Los completos
 * siguen en los logs de Vercel.
 */
export function resumirFallos(fallos: string[], total: number): string | null {
  if (fallos.length === 0) return null
  const cabeza = `${fallos.length} de ${total} fallaron: `
  const cuerpo = fallos.join(' · ')
  return (cabeza + cuerpo).slice(0, 900)
}
