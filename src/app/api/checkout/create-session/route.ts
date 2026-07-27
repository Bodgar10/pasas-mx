/**
 * POST /api/checkout/create-session
 * ----------------------------------
 * Creates a Stripe Checkout session and returns the hosted URL.
 * The client redirects the user to that URL to complete payment.
 *
 * To reuse in another project:
 *   - Update the Supabase profile query fields if your users table differs
 *   - Update CHECKOUT_CONFIG in src/lib/payments/config.ts
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_SITE_URL
 *
 * Request body: { plan: PlanKey, duration: DurationKey }
 * Response:     { url: string } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import {
  STRIPE_PRICES,
  CHECKOUT_CONFIG,
} from '@/lib/payments/config'

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validate request body
    const body = await request.json()
    const { plan, duration } = body as { plan: string; duration: string }

    const planPrices = (STRIPE_PRICES as Record<string, Record<string, string>>)[plan]
    if (!plan || !duration || !planPrices?.[duration]) {
      return NextResponse.json({ error: 'Invalid plan or duration' }, { status: 400 })
    }

    const priceId = planPrices[duration]

    // 3. Get user profile for pre-filling checkout
    const { data: profile } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    // Check if user already had a trial — if so, no trial on new subscription
    const { data: existingSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
    const hasHadSubscription = (existingSubs?.length ?? 0) > 0

    // 4. Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasas.mx'
    const successUrl = `${baseUrl}${CHECKOUT_CONFIG.successPath}`
    const cancelUrl  = `${baseUrl}${CHECKOUT_CONFIG.cancelPath}?plan=${plan}`

    // 5. Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: CHECKOUT_CONFIG.mode,
      payment_method_types: [...CHECKOUT_CONFIG.paymentMethods],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: profile?.email ?? user.email,
      client_reference_id: user.id,
      // Metadata is passed through to the webhook
      metadata: {
        user_id: user.id,
        plan,
        duration,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          duration,
        },
        ...(hasHadSubscription ? {} : { trial_period_days: 7 }),
      },
      payment_method_collection: 'always',
      success_url: successUrl,
      cancel_url:  cancelUrl,
    })

    return NextResponse.json({ url: session.url })

  } catch (error) {
    console.error('[checkout/create-session] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
