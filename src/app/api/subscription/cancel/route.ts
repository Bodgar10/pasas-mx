import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import { sendEmail } from '@/lib/email/resend'
import { cancellationConfirmedTemplate } from '@/lib/email/templates/cancellation-confirmed'
import { trackServer } from '@/lib/analytics/track-server'

/** Dias enteros entre una fecha ISO y ahora. Solo analitica. */
function diasEntre(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const ms = Date.now() - new Date(iso).getTime()
  return ms >= 0 ? Math.floor(ms / 86_400_000) : undefined
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Buscar suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      // 🔴 `current_period_start` es solo para analitica, pero sin el no
      // existe `dia_del_ciclo` — la metrica que separa el arrepentimiento
      // (cancelar al dia siguiente de pagar) de la decision (cancelar justo
      // antes de renovar). Son dos problemas distintos y se arreglan
      // distinto. `price_mxn`, `plan`, `billing_cycle`, `promo_slug` y
      // `created_at` van por lo mismo.
      .select('id, provider_sub_id, current_period_start, current_period_end, plan, billing_cycle, price_mxn, promo_slug, created_at')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
    }

    // Si tiene suscripción real en Stripe, cancelar ahí
    if (subscription.provider_sub_id) {
      await stripe.subscriptions.update(subscription.provider_sub_id, {
        cancel_at_period_end: true,
      })
    }

    // Siempre actualizar BD (cubre cuentas de prueba sin Stripe)
    await supabase
      .from('subscriptions')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', subscription.id)

    // ⚠️ Si algun dia se agrega un endpoint para revertir la cancelacion
    // dentro del periodo, tiene que devolver estos asientos a 'active'
    // con access_until en null. Hoy no existe: el flujo manda a /planes.
    //
    // Los asientos adicionales pasan a 'ending' con la misma fecha de
    // acceso que el titular: mueren cuando muere la suscripcion.
    //
    // Sin esto quedaban en 'active' para siempre y occupied_seats los
    // seguia contando, dejando la cuenta bloqueada en el tope de 3
    // aunque ya no hubiera nada activo.
    //
    // El primario NO se toca: su acceso lo gobierna la suscripcion.
    //
    // Service role a proposito: learners no tiene politica de UPDATE
    // para authenticated (migracion 036). Este archivo escribe
    // `subscriptions` con el cliente del usuario porque esa tabla si la
    // tiene; learners no puede copiar ese patron.
    if (subscription.current_period_end) {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { error: asientosError } = await admin
        .from('learners')
        .update({
          status: 'ending',
          access_until: subscription.current_period_end,
        })
        .eq('account_user_id', user.id)
        .eq('is_primary', false)
        .eq('status', 'active')

      if (asientosError) {
        console.error('[subscription/cancel] no se marcaron los asientos:', asientosError)
      }
    }

    // Enviar email de confirmación de cancelación
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const userEmail = user.email
      if (userEmail) {
        const accessUntil = subscription.current_period_end
          ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric',
            })
          : 'el fin del período actual'

        await sendEmail({
          to: userEmail,
          subject: 'Cancelación confirmada — Pasas.mx',
          html: cancellationConfirmedTemplate({
            userName: userProfile?.full_name?.split(' ')[0] ?? 'Estudiante',
            accessUntil,
          }),
        })
      }
    } catch (emailErr) {
      console.error('[subscription/cancel] Error sending email:', emailErr)
    }

    console.log(`[subscription/cancel] Cancelación programada para user ${user.id}`)

    // Evento de servidor. Aparte y en su try/catch: la cancelacion ya esta
    // hecha y un fallo de analitica no puede devolver un 500 a alguien que
    // acaba de cancelar.
    try {
      const { data: consentimiento } = await supabase
        .from('users')
        .select('cookie_consent_analytics, cookie_consent_marketing')
        .eq('id', user.id)
        .maybeSingle()

      const { count: nAlumnos } = await supabase
        .from('learners')
        .select('id', { count: 'exact', head: true })
        .eq('account_user_id', user.id)
        .eq('status', 'active')

      await trackServer(
        'cancelacion_completada',
        {
          plan: subscription.plan,
          ciclo: subscription.billing_cycle,
          dia_del_ciclo: diasEntre(subscription.current_period_start),
          dias_desde_alta: diasEntre(subscription.created_at),
          n_alumnos: nAlumnos ?? undefined,
          // Lo que deja de entrar. `price_mxn` esta en centavos.
          mrr_perdido: subscription.price_mxn,
          tuvo_promo: !!subscription.promo_slug,
          promo_slug: subscription.promo_slug ?? undefined,
          // Cancela al FIN DEL PERIODO, no al momento: el acceso sigue vivo
          // hasta esta fecha y la baja real la confirma el webhook.
          acceso_hasta: subscription.current_period_end,
        },
        {
          consent: {
            analytics: consentimiento?.cookie_consent_analytics,
            marketing: consentimiento?.cookie_consent_marketing,
          },
          userId: user.id,
        }
      )
    } catch (err) {
      console.error('[subscription/cancel] analitica fallo:', err)
    }

    return NextResponse.json({
      ok: true,
      message: 'Tu suscripción se cancelará al final del período actual. Conservas acceso hasta entonces.',
    })

  } catch (err) {
    console.error('[subscription/cancel] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
