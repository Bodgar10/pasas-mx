import type { SupabaseClient } from '@supabase/supabase-js'

/** Una materia del catalogo. Los tres caminos que crean `user_subjects`
 *  solo necesitan el id; si algun dia hace falta el nombre, se agrega
 *  aqui y no en cada llamada. */
export type MateriaDeGrado = { id: string }

/**
 * Materias del catalogo que le corresponden a un nivel y grado.
 *
 * 🔴 FUENTE UNICA de la regla "que materias le tocan a este alumno".
 * La usan los TRES caminos que escriben `user_subjects`:
 *   - webhooks/stripe      → primer pago
 *   - api/seats/add        → asientos adicionales
 *   - api/seats/change-grade → cambio de grado (s32)
 *
 * Estaba copiada en los dos primeros y al tercero se le olvido por
 * completo: por eso un alumno que cambiaba de grado se quedaba con las
 * materias del grado anterior y veia "Proximamente" en todo. Dos copias
 * de una regla se desincronizan; tres ya lo hicieron.
 *
 * NO existe "materia publicada": `subjects` no tiene esa columna. Lo
 * que se publica son los TEMAS (`topics.published`). Que un grado tenga
 * materias y que esas materias tengan temas son DOS cosas distintas: la
 * segunda se mide con `preview_stats`, no aqui.
 *
 * Lanza si la consulta falla. Un `[]` silencioso por error de red es
 * indistinguible de "este grado no tiene catalogo", y quien llama toma
 * decisiones opuestas en cada caso: una es un bug de infraestructura y
 * la otra un hueco de catalogo que hay que reportarle al usuario.
 */
export async function materiasParaGrado(
  supabase: SupabaseClient,
  educationLevel: string,
  grade: number
): Promise<MateriaDeGrado[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id')
    .eq('education_level', educationLevel)
    .contains('grades', [grade])

  if (error) {
    console.error('materiasParaGrado failed:', error)
    throw error
  }

  return data ?? []
}

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
    // 🔴 s32 — ESTA RAMA TIENE EL MISMO BUG QUE TENIA change-grade.
    // `campos` incluye education_level y grade: si el alumno ya tenia
    // materias, este update le cambia el grado y NO resincroniza
    // `user_subjects`, dejandolo con el catalogo del grado anterior y
    // "Proximamente" en todas sus materias.
    //
    // Hoy no explota por accidente, no por diseno: solo la llaman
    // onboarding y registro, siempre sobre cuentas recien creadas que
    // todavia no tienen ninguna fila en `user_subjects`. En cuanto algo
    // la llame sobre una cuenta con materias, reproduce el bug entero.
    //
    // NO se arregla aqui: ese camino se rehace completo en el prompt
    // siguiente. Queda escrito para que no se pierda.
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
      // 🔴 slot es NOT NULL sin default. El primario es SIEMPRE 1: es el
      // primer alumno de la cuenta y el que reciben todos los links sin `?a=`.
      // No usar next_learner_slot aquí — con una fila huérfana daría 2 y
      // las URLs limpias apuntarían a nadie.
      slot: 1,
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
  // 🔴 Cambiar `grade` o `education_level` de un learner OBLIGA a
  // resincronizar `user_subjects`. Los temas se filtran por grado: un
  // alumno con materias de otro grado ve "Proximamente" en todo, con el
  // contenido existiendo. Usar la funcion de resincronizacion (la RPC
  // `resync_learner_grade`, via /api/seats/change-grade), nunca un
  // update suelto.
  education_level: string | null
  grade: number | null
  theme_id: string | null
  xp_total: number
  streak_days: number
  last_level_seen: number
  /** Ciclo escolar en que ya se le propuso pasar de grado. NULL = nunca. */
  promocion_vista_ciclo: string | null
}

export async function getLearnerBySlot(
  supabase: SupabaseClient,
  userId: string,
  slot: number
): Promise<Learner | null> {
  const { data, error } = await supabase
    .from('learners')
    .select('id, slot, display_name, education_level, grade, theme_id, xp_total, streak_days, last_level_seen, promocion_vista_ciclo')
    .eq('account_user_id', userId)
    .eq('slot', slot)
    .maybeSingle()

  if (error) {
    console.error('getLearnerBySlot failed:', error)
    return null
  }

  return data
}

/** Lo minimo que hace falta para decidir si un alumno sigue teniendo acceso. */
export type AccesoLearner = {
  status: string
  access_until: string | null
}

/**
 * ¿Este alumno todavia puede estudiar?
 *
 * 🔴 Es la MISMA regla que aplica `getAccountLearners` mas abajo, escrita
 * aparte porque el admin la necesita sobre filas que NO vienen de esa
 * funcion (las trae en bloque, de todas las cuentas). Si una cambia,
 * cambian las DOS o el panel y el selector del alumno dejan de contar lo
 * mismo — y esa discrepancia no da error, solo dos numeros distintos.
 *
 * 'ending' cuenta como vigente hasta `access_until`: un alumno dado de
 * baja conserva el acceso que ya pago. Cualquier otro status es false.
 */
export function tieneAccesoVigente(l: AccesoLearner): boolean {
  if (l.status === 'active') return true
  if (l.status === 'ending' && l.access_until) {
    return new Date(l.access_until).getTime() > Date.now()
  }
  return false
}

/**
 * Alumnos de una cuenta que tienen acceso vigente, ordenados por slot.
 *
 * 🔴 Incluye los que estan en 'ending': un alumno dado de baja conserva
 * el acceso que ya pago hasta `access_until`, asi que debe seguir en el
 * selector. Filtrar por `status = 'active'` a secas lo sacaba de la
 * lista mientras todavia podia estudiar.
 *
 * El filtro de acceso vigente se hace despues en JS: PostgREST no
 * permite expresar "activo O (terminando Y con fecha futura)" en un
 * solo `.or()` legible.
 */
export async function getAccountLearners(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('learners')
    .select('id, slot, display_name, education_level, grade, theme_id, xp_total, streak_days, last_level_seen, status, access_until')
    .eq('account_user_id', userId)
    .in('status', ['active', 'ending'])
    .order('slot', { ascending: true })

  if (error) {
    console.error('getAccountLearners failed:', error)
    return []
  }

  const ahora = Date.now()
  return (data ?? []).filter(
    (l) =>
      l.status === 'active' ||
      (l.status === 'ending' && l.access_until && new Date(l.access_until).getTime() > ahora)
  )
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
