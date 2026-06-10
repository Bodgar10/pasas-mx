import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role, onboarding_done, full_name, pending_checkout')
          .eq('id', user.id)
          .single()

        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        }

        // Si el perfil existe pero onboarding_done es false, completarlo
        if (profile && !profile.onboarding_done && profile.full_name) {
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

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
