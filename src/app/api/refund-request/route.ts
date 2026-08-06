import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import { sendEmail } from '@/lib/email/resend'

/**
 * Términos y Condiciones, cláusula 3.5.A: 7 días naturales desde el
 * PRIMER COBRO, no desde el alta. Con trial de 7 días, `created_at` cae
 * una semana antes de que se cobre nada.
 *
 * `current_period_start` es la fecha del periodo pagado en curso, que tras
 * el trial coincide con el primer cobro. NO volver a `created_at`.
 */
const REFUND_WINDOW_DAYS = 7

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    // La página manda `motivo`. Se acepta `reason` también por si algún
    // otro llamador lo usa, pero el nombre real del campo es el de la página.
    const reason = body.motivo ?? body.reason

    // Buscar suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id, provider_customer_id, price_mxn, created_at, plan, current_period_start')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
    }

    // Ventana contada desde el primer cobro (T&C 3.5.A)
    const inicioCobro = new Date(
      subscription.current_period_start ?? subscription.created_at
    )
    const now = new Date()
    const daysSinceCreation = (now.getTime() - inicioCobro.getTime()) / (1000 * 60 * 60 * 24)
    const withinWindow = daysSinceCreation <= REFUND_WINDOW_DAYS

    if (withinWindow) {
      // Dentro de la ventana: reembolso automático
      try {
        // Obtener el invoice más reciente de Stripe
        const invoices = await stripe.invoices.list({
          subscription: subscription.provider_sub_id,
          limit: 1,
        })

        const latestInvoice = invoices.data[0]
        const clientSecret = latestInvoice?.confirmation_secret?.client_secret
        const paymentIntentId = clientSecret?.split('_secret_')[0]

        if (paymentIntentId) {
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer',
          })
        }

        // Cancelar suscripción en Stripe inmediatamente
        await stripe.subscriptions.cancel(subscription.provider_sub_id)

        // Actualizar BD
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)

        console.log(`[refund-request] Reembolso automático procesado para user ${user.id}`)

        return NextResponse.json({
          ok: true,
          automatic: true,
          message: 'Tu reembolso fue procesado automáticamente. Verás el dinero en 5-10 días hábiles.',
        })

      } catch (stripeErr) {
        console.error('[refund-request] Stripe error:', stripeErr)
        return NextResponse.json({ error: 'Error al procesar reembolso en Stripe' }, { status: 500 })
      }

    } else {
      // Fuera de la ventana: ticket para revisión manual
      // Notificar al admin por email
      try {
        await sendEmail({
          to: 'soporte@pasas.mx',
          subject: `⚠️ Solicitud de reembolso manual — ${user.email}`,
          html: `
            <h2>Solicitud de reembolso fuera de ventana</h2>
            <p><strong>Usuario:</strong> ${user.email}</p>
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Días desde creación:</strong> ${Math.floor(daysSinceCreation)}</p>
            <p><strong>Plan:</strong> ${subscription.plan}</p>
            <p><strong>Monto:</strong> $${Math.round(subscription.price_mxn / 100)} MXN</p>
            <p><strong>Razón:</strong> ${reason ?? 'No especificada'}</p>
            <p><strong>Subscription ID:</strong> ${subscription.provider_sub_id}</p>
          `,
        })
      } catch (emailErr) {
        console.error('[refund-request] Error sending admin email:', emailErr)
      }

      console.log(`[refund-request] Ticket manual creado para user ${user.id}. Razón: ${reason}. Días desde creación: ${Math.floor(daysSinceCreation)}`)

      return NextResponse.json({
        ok: true,
        automatic: false,
        message: 'Tu solicitud fue recibida. Nuestro equipo la revisará en máximo 5 días hábiles y te contactará por correo.',
      })
    }

  } catch (err) {
    console.error('[refund-request] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
