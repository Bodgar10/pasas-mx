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
import { construirMetadataCheckout } from '@/lib/payments/metadata-checkout'
import type { AcquisitionSource } from '@/lib/audience-detection'
import { trackServer } from '@/lib/analytics/track-server'

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
    const { plan, duration, promo, checkout_event_id: checkoutEventId } = body as {
      plan: string
      duration: string
      // El slug que trae el cliente. Se manda a validar tal cual: aquí no se
      // le cree nada.
      promo?: string
      /**
       * `event_id` del `checkout_iniciado` que disparó el navegador. Viaja a
       * Stripe en la metadata y vuelve en el webhook, y es lo que permite
       * casar un checkout abierto con su cobro. Solo se usa como
       * identificador: nada del cobro depende de él.
       */
      checkout_event_id?: string
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
    // 🔴 El canal sale de la BASE, no del cliente.
    //
    // `users.acquisition_source` ya guarda el first-touch y lo escribe el
    // servidor. Pedirselo al navegador en el body seria dejar que cualquiera
    // se autoatribuya a la campana que quisiera, y ademas se desincronizaria
    // de lo que ya esta en la fila.
    const { data: profile } = await supabase
      .from('users')
      .select('email, full_name, acquisition_source, cookie_consent_analytics, cookie_consent_marketing')
      .eq('id', user.id)
      .single()

    const acquisition = (profile?.acquisition_source ?? null) as AcquisitionSource | null

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
    //
    // 🔴 El objeto lo arma construirMetadataCheckout, la MISMA función que
    // usa el alta de registro/actions.ts. Antes cada puerta tenía el suyo y
    // ya se habían separado: a la otra le faltaba `duration`.
    const metadataCheckout = construirMetadataCheckout({
      userId: user.id,
      plan,
      duration,
      promoSlug: promoResuelta?.promo.slug ?? null,
      acquisition,
      checkoutEventId,
    })

    const session = await stripe.checkout.sessions.create({
      mode: CHECKOUT_CONFIG.mode,
      // Sin esto Stripe cae en 'auto' y sigue al idioma del navegador, no al
      // del negocio. Sale de CHECKOUT_CONFIG para que la otra puerta —el alta
      // en registro/actions.ts— no pueda quedarse en otro idioma.
      locale: CHECKOUT_CONFIG.locale,
      payment_method_types: [...CHECKOUT_CONFIG.paymentMethods],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: profile?.email ?? user.email,
      client_reference_id: user.id,
      // Metadata is passed through to the webhook
      metadata: metadataCheckout,
      subscription_data: {
        metadata: metadataCheckout,
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

    // Evento de servidor. Va DESPUES de crear la sesion: solo se anuncia lo
    // que de verdad ocurrio. Y no se espera —`void`— para no meter la
    // latencia de PostHog entre el usuario y su redirect a Stripe; si falla,
    // trackServer lo traga y loguea.
    void trackServer(
      'checkout_session_creada',
      {
        plan,
        ciclo: duration,
        camino: 'create_session',
        con_promo: !!promoResuelta,
      },
      {
        consent: {
          analytics: profile?.cookie_consent_analytics,
          marketing: profile?.cookie_consent_marketing,
        },
        userId: user.id,
        eventId: checkoutEventId,
      }
    )

    // `promo_aplicada` es informativo y no cambia el cobro: lo usa el
    // cliente para detectar que traia slug y la sesion salio sin campana
    // (evento `promo_perdida`). Sin esto, esa perdida es invisible.
    return NextResponse.json({
      url: session.url,
      promo_aplicada: promoResuelta?.promo.slug ?? null,
    })

  } catch (error) {
    console.error('[checkout/create-session] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
