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
