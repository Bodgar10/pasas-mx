/**
 * POST /api/webhooks/stripe
 * -------------------------
 * Handles Stripe webhook events and syncs subscription state to Supabase.
 *
 * To reuse in another project:
 *   - Update the Supabase table name if your subscriptions table differs
 *   - Update PRICE_TO_PLAN in config.ts with your own price IDs
 *   - Add or remove event handlers in the switch block as needed
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET — from Stripe Dashboard → Webhooks → Signing secret
 *
 * Events handled:
 *   checkout.session.completed  → INSERT new subscription row
 *   invoice.paid                → UPDATE period dates on renewal
 *   customer.subscription.deleted → UPDATE status to cancelled
 */

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/payments/stripe'
import { createClient } from '@/utils/supabase/server'
import { PRICE_TO_PLAN } from '@/lib/payments/config'
import Stripe from 'stripe'

export async function POST(request: Request) {
  // 1. Read raw body and signature
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // 2. Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhooks/stripe] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {

      // -----------------------------------------------------------------------
      // New subscription created after successful checkout
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session        = event.data.object as Stripe.Checkout.Session
        const userId         = session.metadata?.user_id
        const subscriptionId = session.subscription as string

        if (!userId || !subscriptionId) {
          console.warn('[webhooks/stripe] Missing user_id or subscription_id in metadata')
          break
        }

        // Fetch full subscription object from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const subData = subscription as unknown as {
          items: { data: { price: { id: string; unit_amount: number } }[] }
          customer: string
          current_period_start?: number
          current_period_end?: number
          billing_cycle_anchor?: number
        }

        const priceId   = subData.items.data[0]?.price.id
        const planInfo  = PRICE_TO_PLAN[priceId] ?? { plan: 'grade', duration: 'monthly' }
        const priceAmount = subData.items.data[0]?.price.unit_amount ?? 0

        // Calculate period dates — use billing_cycle_anchor as fallback
        const now = Math.floor(Date.now() / 1000)
        const rawStart = subData.current_period_start ?? subData.billing_cycle_anchor ?? now
        const rawEnd   = subData.current_period_end   ?? (now + 30 * 24 * 60 * 60)

        const periodStart = new Date(rawStart * 1000).toISOString()
        const periodEnd   = new Date(rawEnd   * 1000).toISOString()

        await supabase.from('subscriptions').insert({
          user_id:              userId,
          plan:                 planInfo.plan,
          status:               'active',
          price_mxn:            priceAmount,
          payment_provider:     'stripe',
          provider_sub_id:      subscriptionId,
          provider_customer_id: subData.customer,
          current_period_start: periodStart,
          current_period_end:   periodEnd,
          metadata: {
            duration: planInfo.duration,
            price_id: priceId,
          },
        })

        console.log(`[webhooks/stripe] Subscription created for user ${userId}`)
        break
      }

      // -----------------------------------------------------------------------
      // Subscription renewed — update period dates
      // -----------------------------------------------------------------------
      case 'invoice.paid': {
        const invoice        = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription: string }).subscription
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const subData = subscription as unknown as {
          current_period_start?: number
          current_period_end?: number
          billing_cycle_anchor?: number
        }
        const now = Math.floor(Date.now() / 1000)
        const rawStart = subData.current_period_start ?? subData.billing_cycle_anchor ?? now
        const rawEnd   = subData.current_period_end   ?? (now + 30 * 24 * 60 * 60)
        const periodStart = new Date(rawStart * 1000).toISOString()
        const periodEnd   = new Date(rawEnd   * 1000).toISOString()

        await supabase
          .from('subscriptions')
          .update({
            status:               'active',
            current_period_start: periodStart,
            current_period_end:   periodEnd,
            updated_at:           new Date().toISOString(),
          })
          .eq('provider_sub_id', subscriptionId)

        console.log(`[webhooks/stripe] Subscription renewed: ${subscriptionId}`)
        break
      }

      // -----------------------------------------------------------------------
      // Subscription cancelled — mark as cancelled in DB
      // -----------------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from('subscriptions')
          .update({
            status:       'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at:   new Date().toISOString(),
          })
          .eq('provider_sub_id', subscription.id)

        console.log(`[webhooks/stripe] Subscription cancelled: ${subscription.id}`)
        break
      }

      default:
        // Unhandled event type — safe to ignore
        console.log(`[webhooks/stripe] Unhandled event type: ${event.type}`)
    }

  } catch (error) {
    console.error('[webhooks/stripe] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
