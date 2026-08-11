import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Devuelve el alumno activo de una cuenta.
 *
 * Hoy siempre es el alumno primario, porque todavia no existe el
 * selector. Cuando exista, esta funcion pasa a leerlo de la URL y
 * las rutas que la usan NO se vuelven a tocar. Toda la suposicion
 * temporal vive aqui dentro, en un solo archivo.
 */
export async function getActiveLearnerId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('learners')
    .select('id')
    .eq('account_user_id', userId)
    .eq('is_primary', true)
    .maybeSingle()

  if (error) {
    console.error('getActiveLearnerId failed:', error)
    return null
  }

  return data?.id ?? null
}

/**
 * Crea (o actualiza) el alumno primario de una cuenta.
 *
 * Idempotente: si la cuenta ya tiene primario, lo actualiza en vez de
 * crear otro. Hay un indice unico parcial que impide dos primarios por
 * cuenta, asi que insertar a ciegas tronaria en el segundo intento.
 *
 * `themeName` llega como texto porque `users.interests` guarda el
 * nombre, no el id. Si no resuelve contra `themes`, theme_id queda en
 * NULL: una temratica que falta se arregla despues, un alumno que no
 * existe deja la cuenta inservible.
 *
 * Requiere un cliente con service role: `learners` no tiene politica de
 * INSERT para `authenticated`, a proposito.
 */
export async function upsertPrimaryLearner(
  admin: SupabaseClient,
  params: {
    userId: string
    displayName: string
    educationLevel: string | null
    grade: number | null
    themeName?: string | null
  }
): Promise<string | null> {
  let themeId: string | null = null
  if (params.themeName) {
    const { data: theme } = await admin
      .from('themes')
      .select('id')
      .ilike('name', params.themeName)
      .maybeSingle()
    themeId = theme?.id ?? null
  }

  const { data: existing } = await admin
    .from('learners')
    .select('id')
    .eq('account_user_id', params.userId)
    .eq('is_primary', true)
    .maybeSingle()

  const campos = {
    display_name: params.displayName || 'Alumno',
    education_level: params.educationLevel,
    grade: params.grade,
    ...(themeId ? { theme_id: themeId } : {}),
  }

  if (existing) {
    const { error } = await admin
      .from('learners')
      .update(campos)
      .eq('id', existing.id)
    if (error) {
      console.error('upsertPrimaryLearner update failed:', error)
      return null
    }
    return existing.id
  }

  const { data: creado, error } = await admin
    .from('learners')
    .insert({
      account_user_id: params.userId,
      is_primary: true,
      ...campos,
    })
    .select('id')
    .single()

  if (error) {
    console.error('upsertPrimaryLearner insert failed:', error)
    return null
  }

  return creado.id
}

/**
 * Resuelve un alumno por su slot dentro de la cuenta.
 *
 * El slot es un numero corto (1, 2, 3) local a cada cuenta, no un uuid:
 * el "1" de una cuenta y el "1" de otra son alumnos distintos. Va en la
 * URL porque fuera de la sesion no significa nada, y ademas la RLS de
 * `learners` impide leer alumnos de otra cuenta aunque se adivine.
 */
export type Learner = {
  id: string
  slot: number
  display_name: string
  education_level: string | null
  grade: number | null
  theme_id: string | null
  xp_total: number
  streak_days: number
  last_level_seen: number
}

export async function getLearnerBySlot(
  supabase: SupabaseClient,
  userId: string,
  slot: number
): Promise<Learner | null> {
  const { data, error } = await supabase
    .from('learners')
    .select('id, slot, display_name, education_level, grade, theme_id, xp_total, streak_days, last_level_seen')
    .eq('account_user_id', userId)
    .eq('slot', slot)
    .maybeSingle()

  if (error) {
    console.error('getLearnerBySlot failed:', error)
    return null
  }

  return data
}

/**
 * Todos los alumnos activos de una cuenta, ordenados por slot.
 * El dashboard decide con esto si pinta una tarjeta o varias.
 */
export async function getAccountLearners(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('learners')
    .select('id, slot, display_name, education_level, grade, theme_id, xp_total, streak_days, last_level_seen')
    .eq('account_user_id', userId)
    .eq('status', 'active')
    .order('slot', { ascending: true })

  if (error) {
    console.error('getAccountLearners failed:', error)
    return []
  }

  return data ?? []
}

/**
 * Resuelve el alumno de una peticion a partir del query param `?a=`.
 *
 * Sin param se asume el slot 1, que es el caso de casi todas las cuentas.
 * Si el slot no existe en esta cuenta cae al primario en vez de fallar:
 * un link viejo o manipulado manda al alumno de siempre, no a un error.
 *
 * NO devuelve alumnos de otra cuenta: la consulta filtra por
 * account_user_id y la RLS lo refuerza.
 */
export async function resolveLearner(
  supabase: SupabaseClient,
  userId: string,
  searchParams?: { a?: string | string[] }
) {
  const raw = Array.isArray(searchParams?.a) ? searchParams?.a[0] : searchParams?.a
  const slot = raw ? Number.parseInt(raw, 10) : 1

  if (Number.isFinite(slot) && slot > 0) {
    const porSlot = await getLearnerBySlot(supabase, userId, slot)
    if (porSlot) return porSlot
  }

  return getLearnerBySlot(supabase, userId, 1)
}

/**
 * Construye una ruta conservando el alumno activo.
 *
 * 🔴 USAR SIEMPRE ESTO en lugar de concatenar rutas a mano. Un push que
 * olvide el `?a=` manda al usuario al alumno equivocado sin ningun error
 * visible: veria el avance de su hermano y creeria que se borro el suyo.
 *
 * El slot 1 no lleva param, para que las URLs de la mayoria queden limpias.
 */
export function rutaAlumno(path: string, slot: number): string {
  if (slot === 1) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}a=${slot}`
}

/**
 * Resuelve el alumno de una peticion de API a partir del slot que manda
 * el cliente en el body.
 *
 * Los endpoints de progreso no pueden usar getActiveLearnerId: devuelve
 * siempre el primario, asi que el alumno 2 escribiria su avance en la
 * fila del alumno 1.
 *
 * Cae al primario si el slot no viene o no existe en esta cuenta: un
 * cliente viejo que no manda slot sigue funcionando como antes.
 */
export async function resolveLearnerFromBody(
  supabase: SupabaseClient,
  userId: string,
  slot?: number | string | null
): Promise<string | null> {
  const n = typeof slot === 'string' ? Number.parseInt(slot, 10) : slot
  if (typeof n === 'number' && Number.isFinite(n) && n > 0 && n !== 1) {
    const porSlot = await getLearnerBySlot(supabase, userId, n)
    if (porSlot) return porSlot.id
  }
  return getActiveLearnerId(supabase, userId)
}
