import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Buscar suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id')
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

    // TODO: Cuando Resend esté configurado, enviar email de confirmación aquí

    console.log(`[subscription/cancel] Cancelación programada para user ${user.id}`)

    return NextResponse.json({
      ok: true,
      message: 'Tu suscripción se cancelará al final del período actual. Conservas acceso hasta entonces.',
    })

  } catch (err) {
    console.error('[subscription/cancel] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
