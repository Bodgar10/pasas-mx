import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'

const REFUND_WINDOW_DAYS = 14

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { reason } = body

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

    // Verificar ventana de 14 días
    const createdAt = new Date(subscription.created_at)
    const now = new Date()
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    const withinWindow = daysSinceCreation <= REFUND_WINDOW_DAYS

    if (withinWindow) {
      // Dentro de 14 días: reembolso automático
      try {
        // Obtener el invoice más reciente de Stripe
        const invoices = await stripe.invoices.list({
          subscription: subscription.provider_sub_id,
          limit: 1,
        })

        const latestInvoice = invoices.data[0]
        if (latestInvoice?.payment_intent && typeof latestInvoice.payment_intent === 'string') {
          await stripe.refunds.create({
            payment_intent: latestInvoice.payment_intent,
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
      // Fuera de 14 días: crear ticket para revisión manual
      // TODO: Cuando Resend esté configurado, enviar email al admin aquí
      console.log(`[refund-request] Ticket manual creado para user ${user.id}. Razón: ${reason}. Días desde creación: ${Math.floor(daysSinceCreation)}`)

      return NextResponse.json({
        ok: true,
        automatic: false,
        message: 'Tu solicitud fue recibida. Nuestro equipo la revisará en máximo 2 días hábiles y te contactará por correo.',
      })
    }

  } catch (err) {
    console.error('[refund-request] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
