import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })

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
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (subscription?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
      console.log(`[delete-user] Stripe sub ${subscription.stripe_subscription_id} cancelled`)
    } catch (stripeError) {
      console.error('[delete-user] Error cancelando Stripe sub:', stripeError)
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
