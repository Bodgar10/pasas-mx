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
 * Request body: { plan: PlanKey, duration: DurationKey, promo?: string }
 * Response:     { url: string } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import {
  STRIPE_PRICES,
  CHECKOUT_CONFIG,
} from '@/lib/payments/config'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import {
  MENSAJE_PROMO_NO_DISPONIBLE,
  PromoNoDisponibleError,
  resolvePromoParaCheckout,
} from '@/lib/payments/promo-checkout'

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
    const { plan, duration, promo } = body as {
      plan: string
      duration: string
      // El slug que trae el cliente. Se manda a validar tal cual: aquí no se
      // le cree nada.
      promo?: string
    }

    const planPrices = (STRIPE_PRICES as Record<string, Record<string, string>>)[plan]
    if (!plan || !duration || !planPrices?.[duration]) {
      return NextResponse.json({ error: 'Invalid plan or duration' }, { status: 400 })
    }

    // El Personalizado está oculto de la venta. La UI ya no lo ofrece, pero
    // el endpoint es público para cualquier usuario autenticado: sin este
    // candado, un POST a mano abre un checkout de un producto que no vendemos.
    // No afecta a suscripciones existentes — solo bloquea altas nuevas.
    if (!FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && plan === 'personalizado_v2') {
      return NextResponse.json({ error: 'Plan no disponible' }, { status: 400 })
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

    // 4. Promoción. El servidor decide: valida plan y ciclo contra la fila
    //    ANTES de tocar Stripe.
    //
    //    🔴 Si la campaña aplica pero Stripe no reconoce el código, se corta
    //    la venta. El usuario ya vio "$1"; abrir el checkout a $249 sería
    //    anunciar un precio y cobrar otro.
    //
    //    `hasHadSubscription` —el mismo dato que decide el trial— entra aquí
    //    porque el promotion code es de primera compra: mandárselo a un
    //    cliente que vuelve hace que Stripe rechace el código y se caiga la
    //    sesión entera. Con true, resolvePromoParaCheckout devuelve null y
    //    esto baja solo a allow_promotion_codes.
    let promoResuelta: Awaited<ReturnType<typeof resolvePromoParaCheckout>> = null
    try {
      promoResuelta = await resolvePromoParaCheckout(
        promo,
        plan,
        duration,
        hasHadSubscription
      )
    } catch (promoError) {
      if (promoError instanceof PromoNoDisponibleError) {
        console.error('[checkout/create-session]', promoError.message)
        return NextResponse.json(
          { error: MENSAJE_PROMO_NO_DISPONIBLE },
          { status: 409 }
        )
      }
      throw promoError
    }

    // 5. Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasas.mx'
    const successUrl = `${baseUrl}${CHECKOUT_CONFIG.successPath}`
    const cancelUrl  = `${baseUrl}${CHECKOUT_CONFIG.cancelPath}?plan=${plan}`

    // 6. Create Stripe Checkout session
    //
    // `promo_slug` solo entra si se aplicó de verdad. El webhook lo lee de la
    // metadata de la suscripción para escribirlo en subscriptions.promo_slug.
    // El tipo explícito importa: sin él, la rama `{}` del ternario infiere
    // `promo_slug?: undefined` y eso no encaja en el MetadataParam de Stripe,
    // cuyo index signature es string | number | null. Con Record<string,
    // string> la clave simplemente no existe cuando no hay promo.
    const metadataPromo: Record<string, string> = promoResuelta
      ? { promo_slug: promoResuelta.promo.slug }
      : {}

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
        ...metadataPromo,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          duration,
          ...metadataPromo,
        },
        ...(hasHadSubscription ? {} : { trial_period_days: 7 }),
      },
      payment_method_collection: 'always',
      // 🔴 `discounts` y `allow_promotion_codes` NO pueden coexistir en la
      // misma Checkout Session: Stripe rechaza la llamada. Es uno o el otro,
      // y por eso van en un solo spread ternario y no en dos campos sueltos
      // que alguien pueda descuadrar después.
      //
      // Sin promo se conserva el campo de código: es el camino de las
      // escuelas (DONBOSCO30 tecleado a mano en la caja).
      ...(promoResuelta
        ? { discounts: [{ promotion_code: promoResuelta.promotionCodeId }] }
        : { allow_promotion_codes: true }),
      success_url: successUrl,
      cancel_url:  cancelUrl,
    })

    return NextResponse.json({ url: session.url })

  } catch (error) {
    console.error('[checkout/create-session] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
