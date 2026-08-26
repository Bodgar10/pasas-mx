import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/payments/stripe'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  if (userId === user.id) return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 })

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Cancelar suscripción activa en Stripe antes de borrar
  //
  // 🔴 Las columnas son `provider_sub_id` / `provider_customer_id`.
  // El `stripe_subscription_id` anterior NO existe en la tabla: el select
  // fallaba, `subscription` quedaba en null y el `if` de abajo nunca
  // entraba, asi que borrar la cuenta dejaba la suscripcion cobrando.
  //
  // 🔴 Se leen TODAS las filas, sin `maybeSingle()`. Un usuario puede
  // tener mas de una suscripcion en 'active'/'trialing' a la vez: no hay
  // UNIQUE parcial sobre user_id para esos estados. `maybeSingle()` lanzaba
  // con dos filas —impidiendo cancelar incluso la primera— y un `limit(1)`
  // habria dejado la otra cobrando.
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('provider_sub_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])

  // 🔴 El error del select se tragaba en silencio. Un fallo aqui
  // significa que no sabemos si hay algo que cancelar, y eso es dinero:
  // tiene que quedar en los logs aunque el borrado siga adelante.
  if (subError) {
    console.error('[delete-user] Error leyendo la suscripcion:', subError)
  }

  // try/catch POR ITERACION: una cancelacion que falla no puede dejar sin
  // cancelar a las siguientes, y ninguna bloquea el borrado de la cuenta.
  for (const subscription of subscriptions ?? []) {
    if (!subscription.provider_sub_id) continue
    try {
      await stripe.subscriptions.cancel(subscription.provider_sub_id)
      console.log(`[delete-user] Stripe sub ${subscription.provider_sub_id} cancelled`)
    } catch (stripeError) {
      console.error(
        `[delete-user] Error cancelando Stripe sub ${subscription.provider_sub_id}:`,
        stripeError
      )
      // No bloqueamos el borrado si Stripe falla — seguimos adelante
    }
  }

  const { error } = await serviceSupabase.auth.admin.deleteUser(userId)

  if (error) {
    console.error('[delete-user] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[delete-user] User ${userId} deleted by admin ${user.id}`)
  return NextResponse.json({ success: true })
}
