'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { destinoBienvenida, type CheckoutPendiente } from './destino'

/**
 * Estampa el consentimiento parental. Solo con service role: el tutor NO tiene
 * sesión, llega por un enlace de correo.
 *
 * 🔴 EL TOKEN NO SE LIMPIA AL USARLO. Aquí decía que sí y era falso: el UPDATE
 * de abajo toca status, fecha e IP, y `parental_consent_token` se queda donde
 * estaba. El enlace sigue resolviendo hasta que caduca a los 7 días.
 *
 * No es un agujero de seguridad —lo único que se puede hacer con él es volver
 * a autorizar algo ya autorizado, y esa rama es idempotente— pero sí es la
 * razón de que `page.tsx` tenga que redirigir cuando el estado ya es 'granted'
 * en vez de volver a pintar el formulario. Si algún día se limpia de verdad,
 * ese redirect deja de hacer falta pero tampoco estorba.
 *
 * 🔴 NINGUNA RAMA DE ÉXITO TERMINA EN UNA PANTALLA SIN SALIDA. Las únicas
 * salidas que no van a /bienvenida son las de error —token ausente, token
 * desconocido, vencido, declaración sin marcar y fallo al escribir—, y todas
 * vuelven a la propia pantalla de autorización con un `?estado=` que explica
 * qué pasó y con el formulario todavía ahí para reintentar.
 *
 * 🔴 NO METAS ESTE CUERPO EN UN try/catch. `redirect()` funciona lanzando una
 * excepción: un catch se la comería y la redirección no ocurriría nunca, sin
 * dar ningún error visible.
 */
export async function autorizarMenor(formData: FormData) {
  const token = (formData.get('token') as string | null)?.trim()
  if (!token) redirect('/autorizar-menor/invalido')

  /**
   * 🔴 LA DECLARACIÓN SE VERIFICA EN EL SERVIDOR.
   *
   * El checkbox no tenía `name`, así que nunca llegaba al FormData: lo único
   * que lo hacía obligatorio era el `required` de HTML, que es validación de
   * navegador. Un POST armado a mano autorizaba la cuenta sin marcarlo.
   *
   * Es una manifestación bajo protesta de decir verdad sobre la patria
   * potestad de un menor. Se guardaban la fecha y la IP como constancia, pero
   * no la afirmación que constatan. Ahora sin ella no se estampa nada.
   */
  const declaracion = formData.get('declaracion') === 'on'
  if (!declaracion) redirect(`/autorizar-menor/${token}?estado=falta_declaracion`)

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
    .select('id, email, parent_email, pending_checkout, parental_consent_token_expires_at, parental_consent_status')
    .eq('parental_consent_token', token)
    .maybeSingle()

  if (!usuario) redirect(`/autorizar-menor/${token}?estado=invalido`)

  const checkout = usuario.pending_checkout as CheckoutPendiente

  /**
   * Ya autorizada. Idempotente: no se vuelve a estampar la fecha ni la IP.
   *
   * 🔴 Va a /bienvenida, no a una pantalla de confirmación. Un reenvío —doble
   * clic, Atrás y volver a mandar, reintento del navegador— tiene que acabar
   * donde acaba el primer envío. Si no, el segundo clic castiga al usuario
   * dejándolo en un sitio peor que el primero.
   */
  if (usuario.parental_consent_status !== 'pending') {
    redirect(destinoBienvenida(checkout))
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

  /**
   * Se limpia `pending_checkout` porque el callback ya no pasó por su propia
   * limpieza. Se va el jsonb entero, promo_slug incluido: el registro
   * permanente del canje es subscriptions.promo_slug, que escribe el webhook
   * con lo que Stripe cobró de verdad.
   *
   * 🔴 Va DESPUÉS de haber leído `checkout` arriba: el destino ya está armado
   * con esos valores. Y solo se limpia si había algo que limpiar.
   */
  if (checkout) {
    await serviceClient
      .from('users')
      .update({ pending_checkout: null })
      .eq('id', usuario.id)
  }

  /**
   * 🔴 SIEMPRE /bienvenida. Sin condición por quién sea el tutor.
   *
   * El tutor externo llega aquí sin sesión, y eso está contemplado: /bienvenida
   * detecta que no hay sesión real y, en vez del botón de checkout, le ofrece
   * entrar a /login. Ver la nota de (auth)/bienvenida/page.tsx.
   */
  redirect(destinoBienvenida(checkout))
}
