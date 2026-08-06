import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 🔴 Solo rutas internas. `//evil.com` y `https://evil.com` son redirecciones
  // externas que los navegadores siguen: un enlace de confirmación manipulado
  // llevaría a un sitio ajeno con la sesión recién creada.
  const nextRaw = searchParams.get('next')
  const next =
    nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : '/dashboard'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // 🔴 Sin esto, seis causas distintas —enlace caducado, código YA
      // CONSUMIDO por el prefetch del cliente de correo, red caída— caen
      // en el mismo /login?error=auth y no queda rastro de cuál fue.
      console.error('[auth/callback] exchangeCodeForSession falló:', {
        code: error.code,
        status: error.status,
        message: error.message,
      })
    }

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role, onboarding_done, full_name, education_level, grade, pending_checkout, parent_email, parental_consent_status, parental_consent_token')
          .eq('id', user.id)
          .single()

        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        }

        // Si el perfil existe pero onboarding_done es false, completarlo.
        //
        // 🔴 La señal NO es `full_name`: ese campo siempre viene lleno porque
        // /registro lo pide, así que la condición se cumplía siempre y marcaba
        // el onboarding como hecho aunque el usuario nunca hubiera elegido
        // nivel ni grado. Consecuencia: dashboard vacío, y checkout habilitado
        // sobre un producto inusable.
        //
        // La señal real son los datos de estudio. Si faltan, el middleware
        // manda al usuario a /onboarding, que es lo correcto.
        if (
          profile &&
          !profile.onboarding_done &&
          profile.full_name &&
          profile.education_level &&
          profile.grade
        ) {
          const { createClient: createServiceClient } = await import('@supabase/supabase-js')
          const serviceClient = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          await serviceClient
            .from('users')
            .update({ onboarding_done: true })
            .eq('id', user.id)

          await supabase.auth.updateUser({
            data: { onboarding_done: true },
          })
        }

        // Menor cuyo tutor es el titular de la cuenta: acaba de confirmar su
        // correo, así que lo llevamos directo a autorizar en vez de dejarlo
        // en una pantalla de espera por un correo que no existe.
        //
        // La igualdad parent_email === email es la que distingue los dos
        // caminos. En modo alumno el tutor es otra persona con otro buzón, no
        // coincide, y este bloque NO dispara: ese flujo sigue siendo el del
        // enlace por correo. Es importante que así sea — si disparara, el
        // propio menor acabaría en la pantalla de autorización y podría
        // autorizarse a sí mismo.
        if (
          profile?.parental_consent_status === 'pending' &&
          profile.parental_consent_token &&
          profile.parent_email &&
          profile.parent_email === user.email
        ) {
          return NextResponse.redirect(
            `${origin}/autorizar-menor/${profile.parental_consent_token}`
          )
        }

        // Si hay pending_checkout, crear sesión de Stripe y redirigir
        if (profile?.pending_checkout) {
          const { plan, duration } = profile.pending_checkout as { plan: string; duration: string }
          try {
            const { createClient: createServiceClient } = await import('@supabase/supabase-js')
            const serviceClient = createServiceClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            // Limpiar pending_checkout inmediatamente
            await serviceClient
              .from('users')
              .update({ pending_checkout: null })
              .eq('id', user.id)

            const { STRIPE_PRICES } = await import('@/lib/payments/config')
            const priceId = (STRIPE_PRICES as Record<string, Record<string, string>>)[plan]?.[duration]

            if (priceId) {
              // Redirigir a pantalla de bienvenida antes de Stripe
              return NextResponse.redirect(
                `${origin}/bienvenida?plan=${encodeURIComponent(plan)}&duration=${encodeURIComponent(duration)}`
              )
            }
          } catch (err) {
            console.error('[auth/callback] Error creating Stripe session:', err)
            // Si falla Stripe, continuar al dashboard normal
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // El caso más común no es un error: el enlace ya se usó. Los clientes de
  // correo hacen prefetch para previsualizar y eso consume el token de un
  // solo uso, así que cuando la persona toca, ya está gastado. Se distingue
  // para que /login pueda decir algo útil en vez de un login pelón.
  return NextResponse.redirect(`${origin}/login?error=link_usado`)
}
