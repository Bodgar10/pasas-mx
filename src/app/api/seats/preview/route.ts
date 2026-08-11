/**
 * GET /api/seats/preview
 * ----------------------
 * Devuelve lo que costaria agregar un asiento HOY, sin cobrar nada.
 *
 * La pantalla lo necesita para prometer un monto exacto antes de que el
 * usuario confirme: el movimiento se hace contra una tarjeta ya
 * guardada, sin pantalla de Stripe, asi que el consentimiento informado
 * tiene que estar en nuestra UI.
 *
 * 🔴 El proration_behavior de aqui tiene que ser el MISMO que el de
 * /api/seats/add. Si difieren, se previsualiza una cosa y se cobra otra.
 *
 * Response:
 *   { proratedNow, recurringTotal, nextRenewal, seatPrice,
 *     billingCycle, currentSeats, prorationDate }
 *   Montos en PESOS con decimales, no en centavos.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import {
  STRIPE_SEAT_PRICES,
  MAX_SEATS,
  SEAT_DISCOUNT_COUPON,
  PLAN_DB_A_STRIPE,
  precioAsiento,
  type DurationKey,
  type BillingCycleDB,
} from '@/lib/payments/config'

export async function GET() {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Suscripcion del titular. Mismas condiciones y mismo error que
  //    /api/seats/add: si aqui se puede previsualizar, alla se puede
  //    cobrar, y al reves.
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('provider_sub_id, provider_customer_id, plan, billing_cycle, status, current_period_end')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subError) {
    console.error('[seats/preview] lectura de suscripcion fallo:', subError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!sub?.provider_sub_id) {
    return NextResponse.json(
      { error: 'Necesitas una suscripcion activa para agregar un alumno' },
      { status: 400 }
    )
  }

  // 3. Tope. Misma RPC que add: un asiento dado de baja sigue ocupando
  //    lugar mientras conserve acceso.
  const { data: ocupados, error: rpcError } = await supabase
    .rpc('occupied_seats', { p_account: user.id })

  if (rpcError) {
    console.error('[seats/preview] occupied_seats fallo:', rpcError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  const currentSeats = ocupados ?? 0
  if (currentSeats >= MAX_SEATS) {
    return NextResponse.json(
      { error: `Una cuenta admite hasta ${MAX_SEATS} alumnos` },
      { status: 409 }
    )
  }

  // 4. El asiento usa su propio price. Mismo que add: si aqui se
  //    previsualiza con uno y alla se cobra con otro, el monto que ve el
  //    usuario deja de ser el que se cobra.
  //
  //    planStripe se conserva para dos cosas: validar que el plan admite
  //    asientos ('exam' no esta en el mapa) y resolver el precio de
  //    lista con precioAsiento mas abajo.
  const planStripe = PLAN_DB_A_STRIPE[sub.plan]
  const priceId = STRIPE_SEAT_PRICES[sub.billing_cycle as DurationKey]

  if (!planStripe || !priceId) {
    console.error('[seats/preview] sin price para', sub.plan, sub.billing_cycle)
    return NextResponse.json(
      { error: 'Tu plan no admite alumnos adicionales' },
      { status: 400 }
    )
  }

  // 5. Precio de lista y precio de asiento, de PLAN_DISPLAY via
  //    precioAsiento. El asiento es exactamente la mitad, asi que el
  //    doble es la lista — sin repetir el numero en otro lado.
  const seatPrice = precioAsiento(planStripe, sub.billing_cycle as BillingCycleDB)
  const listaTitular = seatPrice * 2

  // Tras agregar: currentSeats + 1 asientos, de los cuales uno es el
  // titular a precio completo y el resto a mitad.
  const recurringTotal = listaTitular + currentSeats * seatPrice

  // 6. Vista previa. Se fija prorationDate y se devuelve: la doc avisa
  //    que Stripe prorratea al segundo, asi que sin anclar la fecha el
  //    monto que ve el usuario y el que se cobra difieren. `add` recibe
  //    este mismo valor en el body.
  const prorationDate = Math.floor(Date.now() / 1000)

  let proratedNowCentavos = 0
  try {
    const preview = await stripe.invoices.createPreview({
      customer: sub.provider_customer_id ?? undefined,
      subscription: sub.provider_sub_id,
      subscription_details: {
        // Item NUEVO: sin `id`, para que se previsualice una alta y no
        // la modificacion de uno existente.
        items: [{
          price: priceId,
          quantity: 1,
          discounts: [{ coupon: SEAT_DISCOUNT_COUPON }],
        }],
        proration_date: prorationDate,
        // El MISMO que usa add. Con create_prorations se previsualizaria
        // un cargo que no ocurre hoy.
        proration_behavior: 'always_invoice',
      },
    })

    // Solo las lineas de prorrateo. El resto de la factura previa es el
    // cargo normal del proximo periodo y no es lo que se esta agregando.
    //
    // 🔴 En esta version del SDK `proration` NO es campo de primer nivel
    // de la linea: vive bajo parent.*_details. El JSON de ejemplo de la
    // doc esta desactualizado; leer line.proration daria undefined
    // siempre y el total saldria en cero.
    for (const line of preview.lines.data) {
      const esProrrateo =
        line.parent?.subscription_item_details?.proration === true ||
        line.parent?.invoice_item_details?.proration === true
      if (esProrrateo) proratedNowCentavos += line.amount
    }
  } catch (error) {
    console.error('[seats/preview] Stripe fallo:', error)
    return NextResponse.json({ error: 'No pudimos calcular el costo' }, { status: 500 })
  }

  return NextResponse.json({
    // 7. Stripe devuelve centavos; la pantalla muestra pesos.
    proratedNow: proratedNowCentavos / 100,
    recurringTotal,
    nextRenewal: sub.current_period_end,
    seatPrice,
    billingCycle: sub.billing_cycle,
    currentSeats,
    prorationDate,
  })
}
