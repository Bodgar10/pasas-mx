import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { destinoBienvenida, type CheckoutPendiente } from '@/app/autorizar-menor/[token]/destino'

/**
 * A DÓNDE VA ALGUIEN JUSTO DESPUÉS DE ENTRAR (s49, 20-oct-2026).
 *
 * Lo usan el login con contraseña y /auth/continuar (el "Ya verifiqué" del
 * registro). Antes los dos mandaban SIEMPRE a /dashboard, y eso perdía el
 * pago pendiente.
 *
 * 🔴 EL CASO QUE LO ORIGINÓ — el primer registro que trajo un anuncio:
 * se registró dentro del navegador de Instagram, Gmail abrió el enlace de
 * confirmación en OTRO navegador, y ahí /auth/callback no pudo canjear el
 * código (el verificador PKCE vive en la pestaña de Instagram). Supabase sí
 * confirmó el correo, pero el callback cayó a /login?error=link_usado. Entró
 * con su contraseña → /dashboard, y su `pending_checkout` (Estándar mensual
 * con PASAS1) se quedó intacto en la base. Nunca vio la pantalla del $1.
 *
 * Mismo orden de decisiones que auth/callback:
 *   1. admin → /admin
 *   2. tutor titular con la autorización pendiente → /autorizar-menor/<token>
 *      (esa pantalla limpia pending_checkout y manda a /bienvenida con el plan)
 *   3. pago pendiente y SIN suscripción viva → /bienvenida con plan y promo
 *   4. lo demás → /dashboard
 *
 * 🔴 AQUÍ NO SE LIMPIA `pending_checkout`, a diferencia del callback. Si la
 * persona se va de /bienvenida sin pagar, el siguiente login se lo vuelve a
 * ofrecer. El guardia contra repetirlo para siempre es la suscripción: en
 * cuanto hay una active/trialing, el paso 3 deja de aplicar aunque la columna
 * siga llena.
 */
export async function destinoTrasEntrar(userId: string, email: string | null | undefined): Promise<string> {
  try {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await service
      .from('users')
      .select('role, pending_checkout, parent_email, parental_consent_status, parental_consent_token')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) return '/dashboard'
    if (profile.role === 'admin') return '/admin'

    // Mismo criterio que auth/callback: solo cuando el tutor ES el titular.
    // En modo alumno el tutor es otra persona y firma desde su propio correo.
    if (
      profile.parental_consent_status === 'pending' &&
      profile.parental_consent_token &&
      profile.parent_email &&
      email &&
      profile.parent_email === email
    ) {
      return `/autorizar-menor/${profile.parental_consent_token}`
    }

    const checkout = profile.pending_checkout as CheckoutPendiente
    if (checkout?.plan && checkout?.duration) {
      const { count } = await service
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
      if (!count) return destinoBienvenida(checkout)
    }
  } catch (err) {
    // Nunca bloquea la entrada: en el peor caso, el destino de siempre.
    console.error('[destinoTrasEntrar] No se pudo decidir el destino:', err)
  }
  return '/dashboard'
}
