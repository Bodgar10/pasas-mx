import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import { sendEmail } from '@/lib/email/resend'
import { pauseConfirmedTemplate } from '@/lib/email/templates/pause-confirmed'
import { trackServer } from '@/lib/analytics/track-server'

/** Dias enteros desde una fecha ISO. Solo analitica. */
function diasEntre(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const ms = Date.now() - new Date(iso).getTime()
  return ms >= 0 ? Math.floor(ms / 86_400_000) : undefined
}

/** Meses aproximados (30 dias) desde una fecha ISO. Solo analitica. */
function mesesEntre(iso: string | null | undefined): number | undefined {
  const dias = diasEntre(iso)
  return dias == null ? undefined : Math.round(dias / 30)
}

async function leerConsentimiento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from('users')
    .select('cookie_consent_analytics, cookie_consent_marketing')
    .eq('id', userId)
    .maybeSingle()
  return {
    analytics: data?.cookie_consent_analytics,
    marketing: data?.cookie_consent_marketing,
  }
}

const MAX_PAUSES_PER_YEAR = 2
const MAX_PAUSE_MONTHS = 3

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const months = Math.min(Math.max(1, parseInt(body.months ?? 1)), MAX_PAUSE_MONTHS)

    // Buscar suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      // `current_period_start`, `plan`, `billing_cycle` y `price_mxn`: solo
      // analitica. Sin el primero no hay `dia_del_ciclo`.
      .select('id, provider_sub_id, status, pause_count_year, pause_count_lifetime, current_period_start, current_period_end, plan, billing_cycle, price_mxn')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
    }

    // Anti-abuso: máximo 2 pausas por año académico
    if ((subscription.pause_count_year ?? 0) >= MAX_PAUSES_PER_YEAR) {
      return NextResponse.json({
        error: 'Ya usaste tus 2 pausas de este año académico'
      }, { status: 403 })
    }

    // Calcular fecha de reactivación
    const pausedUntil = new Date()
    pausedUntil.setMonth(pausedUntil.getMonth() + months)

    // Pausar en Stripe usando pause_collection
    if (subscription.provider_sub_id) {
      await stripe.subscriptions.update(subscription.provider_sub_id, {
        pause_collection: {
          behavior: 'mark_uncollectible',
          resumes_at: Math.floor(pausedUntil.getTime() / 1000),
        },
      })
    }

    // Actualizar BD
    await supabase
      .from('subscriptions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        paused_until: pausedUntil.toISOString(),
        pause_count_lifetime: (subscription.pause_count_lifetime ?? 0) + 1,
        pause_count_year: (subscription.pause_count_year ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    // Los asientos adicionales pasan a 'ending' hasta que la pausa
    // termine. Sin esto quedaban 'active' con access_until en NULL
    // mientras la suscripcion no cobra: seguian contando en
    // occupied_seats y el estado decia que estaban vivos con la cuenta
    // detenida.
    //
    // El primario NO se toca: su estado lo gobierna la suscripcion.
    //
    // Service role: learners no tiene politica de UPDATE para
    // authenticated (migracion 036).
    {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { error: asientosError } = await admin
        .from('learners')
        .update({
          status: 'ending',
          access_until: pausedUntil.toISOString(),
        })
        .eq('account_user_id', user.id)
        .eq('is_primary', false)
        .eq('status', 'active')

      if (asientosError) {
        console.error('[subscription/pause] no se marcaron los asientos:', asientosError)
      }
    }

    // Enviar email de confirmación
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (user.email) {
        const pausedUntilFormatted = pausedUntil.toLocaleDateString('es-MX', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
        await sendEmail({
          to: user.email,
          subject: 'Tu cuenta está pausada — Pasas.mx',
          html: pauseConfirmedTemplate({
            userName: userProfile?.full_name?.split(' ')[0] ?? 'Estudiante',
            pausedUntil: pausedUntilFormatted,
            months,
          }),
        })
      }
    } catch (emailErr) {
      console.error('[subscription/pause] Error sending email:', emailErr)
    }

    try {
      const consentimiento = await leerConsentimiento(supabase, user.id)
      await trackServer(
        'pausa_iniciada',
        {
          meses: months,
          dia_del_ciclo: diasEntre(subscription.current_period_start),
          plan: subscription.plan,
          ciclo: subscription.billing_cycle,
          // Lo que deja de entrar mientras dura la pausa. No es perdido:
          // vuelve al reanudar, y por eso es una metrica distinta de
          // `mrr_perdido` de la cancelacion.
          mrr_pausado: subscription.price_mxn,
          pausa_n_lifetime: (subscription.pause_count_lifetime ?? 0) + 1,
        },
        { consent: consentimiento, userId: user.id }
      )
    } catch (err) {
      console.error('[subscription/pause] analitica fallo:', err)
    }

    console.log(`[subscription/pause] Usuario ${user.id} pausó ${months} mes(es) hasta ${pausedUntil.toISOString()}`)

    return NextResponse.json({
      ok: true,
      pausedUntil: pausedUntil.toISOString(),
      message: `Tu cuenta está pausada hasta ${pausedUntil.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    })

  } catch (err) {
    console.error('[subscription/pause] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — Reactivar pausa manualmente desde /perfil
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // paused_until se lee ANTES de limpiarlo: hace falta para saber que
    // asientos se marcaron por esta pausa y no por una baja manual.
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id, paused_until, paused_at, plan, billing_cycle')
      .eq('user_id', user.id)
      .eq('status', 'paused')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No hay pausa activa' }, { status: 404 })
    }

    // Quitar pausa en Stripe
    if (subscription.provider_sub_id) {
      await stripe.subscriptions.update(subscription.provider_sub_id, {
        pause_collection: '',
      } as any)
    }

    // Actualizar BD
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        paused_at: null,
        paused_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    // Revertir los asientos que esta pausa marco.
    //
    // 🔴 Solo los que tienen access_until EXACTAMENTE igual al
    // paused_until que se esta limpiando. Sin ese filtro, reactivar una
    // pausa reviviria tambien un asiento que el usuario dio de baja a
    // mano por otra razon.
    if (subscription.paused_until) {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { error: asientosError } = await admin
        .from('learners')
        .update({
          status: 'active',
          access_until: null,
        })
        .eq('account_user_id', user.id)
        .eq('is_primary', false)
        .eq('status', 'ending')
        .eq('access_until', subscription.paused_until)

      if (asientosError) {
        console.error('[subscription/pause] no se revirtieron los asientos:', asientosError)
      }
    }

    /**
     * Reactivacion MANUAL, desde el perfil y antes de que venza la pausa.
     *
     * 🔴 `via: 'manual'` y `con_cupon: false` a proposito. El cron
     * `pauses-ending` reactiva a TODO el mundo cuando vence el plazo y
     * ademas aplica STRIPE_COUPON_REACTIVATION_50; esta via no aplica
     * ninguno. Quien vuelve solo, sin descuento y antes de tiempo, vale mas
     * que quien vuelve porque se le acabo el plazo — y sin estos dos campos
     * los dos casos serian el mismo evento.
     */
    try {
      const consentimiento = await leerConsentimiento(supabase, user.id)
      await trackServer(
        'pausa_terminada',
        {
          meses_pausados: mesesEntre(subscription.paused_at),
          via: 'manual',
          con_cupon: false,
          plan: subscription.plan,
          ciclo: subscription.billing_cycle,
          // Se reactivo ANTES de que venciera: es la señal mas fuerte de que
          // el producto se echaba de menos.
          anticipada: subscription.paused_until
            ? new Date(subscription.paused_until).getTime() > Date.now()
            : false,
        },
        { consent: consentimiento, userId: user.id }
      )
    } catch (err) {
      console.error('[subscription/pause] analitica DELETE fallo:', err)
    }

    console.log(`[subscription/pause] Reactivación manual para user ${user.id}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[subscription/pause] DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
