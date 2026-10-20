import 'server-only'
import { createClient as createServiceClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'

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

/** `max_rows` de PostgREST (supabase/config.toml). Ninguna respuesta trae más. */
const PAGINA = 1000

type RespuestaPagina<T> = { data: T[] | null; error: PostgrestError | null }

/**
 * Lee TODAS las filas de una consulta, de 1000 en 1000, hasta agotarla o
 * llegar a `tope`.
 *
 * 🔴 `.limit(5000)` NO pasaba de 1000: PostgREST corta en `max_rows` sin
 * error ni aviso, así que cada tarjeta se habría quedado congelada en las
 * primeras 1000 filas en cuanto los datos crecieran.
 *
 * `armar` debe devolver un builder NUEVO en cada llamada (`.range()` muta el
 * builder) y con un `.order()` ESTABLE —por PK—: sin orden, Postgres puede
 * devolver las páginas en otro orden entre llamadas y repetir o saltarse
 * filas.
 *
 * Mismo contrato que antes: si una página falla, `data` es null (antes un
 * error también dejaba `data` en null y la pestaña pintaba ceros).
 */
export async function leerTodo<T>(
  armar: () => { range(desde: number, hasta: number): PromiseLike<RespuestaPagina<T>> },
  tope: number = TOPE
): Promise<RespuestaPagina<T>> {
  const filas: T[] = []
  while (filas.length < tope) {
    const desde = filas.length
    const hasta = Math.min(desde + PAGINA, tope) - 1
    const { data, error } = await armar().range(desde, hasta)
    if (error) return { data: null, error }
    const pagina = data ?? []
    filas.push(...pagina)
    if (pagina.length < hasta - desde + 1) break
  }
  return { data: filas, error: null }
}

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

  const qSubs = () => {
    const q = db.from('subscriptions').select('price_mxn, status, current_period_end, cancelled_at, user_id')
    return (incluirPrueba ? q : q.eq('is_test', false)).order('id')
  }
  const qNuevos = db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', v.d30)

  const [{ data: subs }, { count: nuevos30 }, { count: dePrueba }] = await Promise.all([
    leerTodo<FilaSub>(qSubs),
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
  last_active_at: string | null
  first_session_at: string | null
  activated_at: string | null
}

export async function idsVigentes(incluirPrueba: boolean) {
  const db = servicio()
  // Las dos lecturas son independientes: van en paralelo.
  const [{ data: usuarios }, { data: alumnos }] = await Promise.all([
    leerTodo<{ id: string }>(() => {
      const q = db.from('users').select('id')
      return (incluirPrueba ? q : q.eq('is_test', false)).order('id')
    }),
    leerTodo<Alumno>(() =>
      db
        .from('learners')
        .select('id, account_user_id, status, access_until, education_level, grade, xp_total, streak_days, max_streak_days, last_active_at, first_session_at, activated_at')
        .order('id')
    ),
  ])
  const cuentas = new Set((usuarios ?? []).map((u) => u.id as string))

  const suyos = ((alumnos ?? []) as Alumno[]).filter((l) => cuentas.has(l.account_user_id))
  return { cuentas, alumnos: suyos, totalCuentas: cuentas.size }
}
