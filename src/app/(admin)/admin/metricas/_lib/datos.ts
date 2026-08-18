import 'server-only'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Capa de datos del tablero. TODO ocurre en el servidor.
 *
 * 🔴 Antes, `metricas-client.tsx` recibía SIETE TABLAS ENTERAS sin `.limit()`
 * y calculaba en el navegador. Eso tenía tres problemas: el payload crecía sin
 * techo, el admin hacía el trabajo del servidor, y —el peor— la lista de
 * correos de TODOS los usuarios se serializaba en el payload RSC de cada
 * carga. Aquí no sale ni un `email` hacia el cliente.
 *
 * Cada pestaña llama SOLO a su cargador. Ninguno consulta lo que no usa.
 */

export const TOPE = 5000 as const

export function servicio(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function ventanas() {
  const ahora = new Date()
  const dias = (n: number) => new Date(ahora.getTime() - n * 86_400_000).toISOString()
  return {
    ahora,
    ahoraIso: ahora.toISOString(),
    d1: dias(1),
    d7: dias(7),
    d30: dias(30),
    d90: dias(90),
    inicioMes: new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString(),
  }
}

/** Días enteros entre dos fechas ISO. */
export function dias(desde: string | null | undefined, hasta: string | null | undefined): number | null {
  if (!desde || !hasta) return null
  const ms = new Date(hasta).getTime() - new Date(desde).getTime()
  return ms >= 0 ? Math.floor(ms / 86_400_000) : null
}

/** `price_mxn` se guarda en CENTAVOS (001_initial_schema). */
export const aPesos = (centavos: number) => centavos / 100

export const pesos = (centavos: number) =>
  `$${Math.round(aPesos(centavos)).toLocaleString('es-MX')}`

export const pct = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 0

// ─────────────────────────────────────────────────────────────────────
// FRANJA FIJA — igual en las seis pestañas
// ─────────────────────────────────────────────────────────────────────

export type Franja = {
  mrr: number
  cuentasActivas: number
  churn30: number
  nuevos30: number
  canceladas30: number
  cuentasDePrueba: number
}

export async function cargarFranja(incluirPrueba: boolean): Promise<Franja> {
  const db = servicio()
  const v = ventanas()

  type FilaSub = {
    price_mxn: number | null
    status: string
    current_period_end: string
    cancelled_at: string | null
    user_id: string
  }

  const qSubs = db
    .from('subscriptions')
    .select('price_mxn, status, current_period_end, cancelled_at, user_id')
    .limit(TOPE)
  const qNuevos = db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', v.d30)

  const [{ data: subs }, { count: nuevos30 }, { count: dePrueba }] = await Promise.all([
    incluirPrueba ? qSubs : qSubs.eq('is_test', false),
    incluirPrueba ? qNuevos : qNuevos.eq('is_test', false),
    db.from('users').select('id', { count: 'exact', head: true }).eq('is_test', true),
  ])

  const filas = (subs ?? []) as FilaSub[]
  const activas = filas.filter((s) => s.status === 'active' && s.current_period_end > v.ahoraIso)
  const canceladas30 = filas.filter((s) => s.cancelled_at && s.cancelled_at >= v.d30).length

  return {
    mrr: activas.reduce((t, s) => t + (s.price_mxn ?? 0), 0),
    cuentasActivas: new Set(activas.map((s) => s.user_id)).size,
    // Churn sobre la base activa al inicio del periodo, aproximado con la
    // base actual + las que se fueron: sin snapshot histórico no hay forma
    // exacta, y decirlo es mejor que fingir precisión.
    churn30: pct(canceladas30, activas.length + canceladas30),
    nuevos30: nuevos30 ?? 0,
    canceladas30,
    cuentasDePrueba: dePrueba ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helper compartido: ids de cuentas y alumnos que cuentan
// ─────────────────────────────────────────────────────────────────────

export type Alumno = {
  id: string
  account_user_id: string
  status: string
  access_until: string | null
  education_level: string | null
  grade: number | null
  xp_total: number
  streak_days: number
  max_streak_days: number
  first_session_at: string | null
  activated_at: string | null
}

export async function idsVigentes(incluirPrueba: boolean) {
  const db = servicio()
  const q = db.from('users').select('id')
  const { data: usuarios } = await (incluirPrueba ? q : q.eq('is_test', false)).limit(TOPE)
  const cuentas = new Set((usuarios ?? []).map((u) => u.id as string))

  const { data: alumnos } = await db
    .from('learners')
    .select('id, account_user_id, status, access_until, education_level, grade, xp_total, streak_days, max_streak_days, first_session_at, activated_at')
    .limit(TOPE)

  const suyos = ((alumnos ?? []) as Alumno[]).filter((l) => cuentas.has(l.account_user_id))
  return { cuentas, alumnos: suyos, totalCuentas: cuentas.size }
}
