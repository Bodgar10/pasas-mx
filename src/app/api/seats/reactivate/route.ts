/**
 * POST /api/seats/reactivate
 * --------------------------
 * Revive un asiento en 'ending' que todavia conserva acceso.
 *
 * NO cobra: ese periodo ya esta pagado. Lo unico que hace es volver a
 * crear el item en Stripe para que se renueve, y devolver la fila a
 * 'active'.
 *
 * Un asiento cuyo acceso ya vencio NO pasa por aqui: ese se vuelve a
 * comprar desde /agregar-alumno, donde si hay cobro y consentimiento.
 *
 * Request body: { learnerId: string }
 * Response:     { ok: true, subscriptionItemId: string } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/payments/stripe'
import {
  STRIPE_SEAT_PRICES,
  MAX_SEATS,
  SEAT_DISCOUNT_COUPON,
  PLAN_DB_A_STRIPE,
  type DurationKey,
} from '@/lib/payments/config'

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const learnerId = (body as { learnerId?: string } | null)?.learnerId
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId requerido' }, { status: 400 })
    }

    // 2. Pertenencia. Mismo chequeo que remove.
    const { data: learner, error: learnerError } = await supabase
      .from('learners')
      .select('id, status, access_until, is_primary')
      .eq('id', learnerId)
      .eq('account_user_id', user.id)
      .maybeSingle()

    if (learnerError) {
      console.error('[seats/reactivate] lectura de learner fallo:', learnerError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!learner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Solo un 'ending' con acceso vigente. Si ya vencio, no hay nada
    //    que revivir: hay que comprarlo de nuevo, con cobro.
    if (learner.status !== 'ending') {
      return NextResponse.json(
        { error: 'Ese alumno no esta dado de baja' },
        { status: 409 }
      )
    }
    const accesoVigente = learner.access_until
      ? new Date(learner.access_until) > new Date()
      : false
    if (!accesoVigente) {
      return NextResponse.json(
        { error: 'El acceso de ese alumno ya vencio. Agregalo de nuevo desde Agregar alumno.' },
        { status: 409 }
      )
    }

    // 4. Tope. Un 'ending' con acceso vigente YA cuenta en la RPC, asi
    //    que reactivar no lo empeora — pero otro asiento pudo agregarse
    //    entre tanto.
    const { data: ocupados, error: rpcError } = await supabase
      .rpc('occupied_seats', { p_account: user.id })

    if (rpcError) {
      console.error('[seats/reactivate] occupied_seats fallo:', rpcError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if ((ocupados ?? 0) > MAX_SEATS) {
      return NextResponse.json(
        { error: `Una cuenta admite hasta ${MAX_SEATS} alumnos` },
        { status: 409 }
      )
    }

    // 5. No se revive un asiento en una cuenta sin suscripcion viva.
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('provider_sub_id, plan, billing_cycle')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      console.error('[seats/reactivate] lectura de suscripcion fallo:', subError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!sub?.provider_sub_id) {
      return NextResponse.json(
        { error: 'Necesitas una suscripcion activa para reactivar un alumno' },
        { status: 400 }
      )
    }

    // 6. El asiento usa su propio price. Mismo que add: Stripe rechaza
    //    dos items con el mismo price en una suscripcion.
    //
    //    PLAN_DB_A_STRIPE se conserva solo para VALIDAR que el plan
    //    admite asientos: 'exam' no esta en el mapa y cae aqui.
    const planStripe = PLAN_DB_A_STRIPE[sub.plan]
    const priceId = STRIPE_SEAT_PRICES[sub.billing_cycle as DurationKey]

    if (!planStripe || !priceId) {
      console.error('[seats/reactivate] sin price para', sub.plan, sub.billing_cycle)
      return NextResponse.json(
        { error: 'Tu plan no admite alumnos adicionales' },
        { status: 400 }
      )
    }

    // Recrear el item con la misma forma que add.
    //
    // 🔴 proration_behavior 'none', NO 'always_invoice': el periodo en
    // curso ya se pago. Con always_invoice se cobraria dos veces por los
    // mismos dias.
    let subscriptionItemId: string
    try {
      const item = await stripe.subscriptionItems.create({
        subscription: sub.provider_sub_id,
        price: priceId,
        quantity: 1,
        discounts: [{ coupon: SEAT_DISCOUNT_COUPON }],
        proration_behavior: 'none',
      })
      subscriptionItemId = item.id
    } catch (stripeError) {
      // 8. Stripe fallo: la fila NO se toca y sigue en 'ending' con su
      //    acceso intacto. El usuario puede reintentar.
      console.error('[seats/reactivate] Stripe fallo:', stripeError)
      return NextResponse.json(
        { error: 'No pudimos reactivar el lugar. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // 7. Volver a 'active'. Service role: learners no tiene politica de
    //    UPDATE para `authenticated` (migracion 036).
    //
    //    🔴 access_until vuelve a null: una fila 'active' con una fecha
    //    de baja en el pasado es un dato que miente.
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error: updateError } = await admin
      .from('learners')
      .update({
        status: 'active',
        access_until: null,
        stripe_subscription_item_id: subscriptionItemId,
      })
      .eq('id', learnerId)

    if (updateError) {
      console.error(
        '[seats/reactivate] ITEM SIN REGISTRAR — item:', subscriptionItemId,
        'learner:', learnerId, updateError
      )
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, subscriptionItemId })

  } catch (err) {
    console.error('[seats/reactivate] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
