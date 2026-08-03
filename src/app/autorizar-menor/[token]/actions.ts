'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Estampa el consentimiento parental. Solo con service role: el tutor NO tiene
 * sesión, llega por un enlace de correo.
 *
 * El token se limpia al usarlo, así que el enlace sirve una sola vez.
 */
export async function autorizarMenor(formData: FormData) {
  const token = (formData.get('token') as string | null)?.trim()
  if (!token) redirect('/autorizar-menor/invalido')

  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    null

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: usuario } = await serviceClient
    .from('users')
    .select('id, parental_consent_token_expires_at, parental_consent_status')
    .eq('parental_consent_token', token)
    .maybeSingle()

  if (!usuario) redirect(`/autorizar-menor/${token}?estado=invalido`)
  if (usuario.parental_consent_status !== 'pending') {
    // Ya autorizada. Idempotente: no se vuelve a estampar la fecha.
    redirect(`/autorizar-menor/${token}`)
  }

  const vencido =
    !usuario.parental_consent_token_expires_at ||
    new Date(usuario.parental_consent_token_expires_at) < new Date()

  if (vencido) redirect(`/autorizar-menor/${token}?estado=vencido`)

  const { error } = await serviceClient
    .from('users')
    .update({
      parental_consent_status: 'granted',
      parental_consent_at: new Date().toISOString(),
      parental_consent_ip: ip,
    })
    .eq('id', usuario.id)

  if (error) {
    console.error('[autorizar-menor] No se pudo estampar el consentimiento:', error)
    redirect(`/autorizar-menor/${token}?estado=error`)
  }

  // Sin `?estado=listo`. La pantalla lee el estado de la base, no de la URL.
  redirect(`/autorizar-menor/${token}`)
}
