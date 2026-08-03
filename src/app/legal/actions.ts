'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseConsent, calcularEdad } from '@/lib/legal'

/**
 * Estampa el consentimiento legal de un usuario que ya tiene cuenta pero llegó
 * sin pasar por el formulario de /registro (hoy: alta con Google OAuth).
 *
 * Escribe con service role porque el usuario no tiene permiso de UPDATE sobre
 * estas columnas, y no debe tenerlo: si pudiera, se marcaría el consentimiento
 * a sí mismo desde la consola.
 */
export async function guardarConsentimiento(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.is_anonymous) {
    redirect('/login')
  }

  const headersList = await headers()
  const clientIp =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    null

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // La edad se comprueba AQUÍ, antes de `parseConsent`, y a propósito.
  //
  // `/legal` monta ConsentimientoLegal sin prop, así que el formulario manda
  // `registrante = 'alumno'`. `parseConsent` rechaza esa combinación con un
  // mensaje que habla de un selector que en esta pantalla no existe, y ese
  // rechazo ocurriría antes de llegar al borrado.
  //
  // Aquí la cuenta YA existe —la creó el trigger al autenticarse con Google—
  // así que no basta con rechazar: hay que borrarla.
  //
  // Se borra de las DOS tablas. Quitarla solo de auth deja una fila huérfana en
  // public.users que revienta el siguiente registro con ese mismo correo, que
  // es justo lo que queremos permitir: que el tutor registre con él.
  const birthdateRaw = ((formData.get('birthdate') as string | null) ?? '').trim()
  const edad = calcularEdad(birthdateRaw)

  if (edad !== null && edad >= 0 && edad < 18) {
    const { error: perfilError } = await serviceClient
      .from('users')
      .delete()
      .eq('id', user.id)

    if (perfilError) {
      console.error('[legal] No se pudo borrar el perfil del menor:', perfilError)
    }

    const { error: authError } = await serviceClient.auth.admin.deleteUser(user.id)
    if (authError) {
      console.error('[legal] No se pudo borrar el usuario de auth:', authError)
    }

    await supabase.auth.signOut()
    redirect('/registro-bloqueado')
  }

  // Fecha vacía, mal formada o absurda: no se borra nada. Que el error normal
  // de `parseConsent` le pida corregirla.
  const consent = parseConsent(formData, clientIp)
  if (!consent.ok) {
    redirect(`/legal?error=${encodeURIComponent(consent.error)}`)
  }

  const { error } = await serviceClient
    .from('users')
    .update(consent.fields)
    .eq('id', user.id)

  if (error) {
    console.error('[legal] No se pudo guardar el consentimiento:', error)
    redirect('/legal?error=No%20pudimos%20guardar%20tus%20datos.%20Int%C3%A9ntalo%20de%20nuevo.')
  }

  redirect('/dashboard')
}
