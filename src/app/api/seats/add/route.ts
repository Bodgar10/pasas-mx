/**
 * POST /api/seats/add
 * -------------------
 * Agrega un asiento a la suscripcion existente del titular.
 *
 * NO es un Checkout. Un asiento adicional es una modificacion de la
 * suscripcion que ya existe: el metodo de pago esta guardado, asi que
 * el cargo prorrateado sale de inmediato contra la tarjeta del titular
 * sin pantalla de Stripe.
 *
 * 🔴 Eso es cierto SOLO por `proration_behavior: 'always_invoice'`.
 * NO revertir a 'create_prorations' pensando que es equivalente: ese
 * modo crea las partidas de prorrateo pero las deja PENDIENTES hasta la
 * siguiente factura. En un plan anual, quien agrega un asiento el dia 2
 * no pagaria nada durante once meses. Y PROFECO exige informar monto y
 * fecha del cargo: "se sumara a tu factura de febrero" no es informar.
 *
 * El endpoint NO crea la fila de learners. La pantalla la crea antes
 * con status 'inactive', grado y tematica ya elegidos; aqui solo se
 * cobra y se activa.
 *
 * Request body: { learnerId: string, prorationDate?: number }
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
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Body
  //
  //    `prorationDate` es el timestamp que devolvio /api/seats/preview.
  //    Stripe prorratea al segundo, asi que sin anclarlo el monto que la
  //    pantalla prometio y el que se cobra difieren por los segundos que
  //    el usuario tardo en confirmar. Es opcional: sin el, Stripe usa el
  //    momento actual.
  const body = await request.json().catch(() => null)
  const { learnerId, prorationDate } =
    (body as { learnerId?: string; prorationDate?: number } | null) ?? {}
  if (!learnerId) {
    return NextResponse.json({ error: 'learnerId requerido' }, { status: 400 })
  }

  // 3. El learner es de esta cuenta. Se consulta con el cliente del
  //    usuario a proposito: la RLS respalda el filtro, no lo sustituye.
  //    No se confia en el id del body.
  const { data: learner, error: learnerError } = await supabase
    .from('learners')
    .select('id, status, access_until, account_user_id, education_level, grade, theme_id')
    .eq('id', learnerId)
    .eq('account_user_id', user.id)
    .maybeSingle()

  if (learnerError) {
    console.error('[seats/add] lectura de learner fallo:', learnerError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!learner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Tres estados, tres caminos. Solo se cobra un 'inactive'.
  if (learner.status === 'active') {
    return NextResponse.json({ error: 'Ese alumno ya esta activo' }, { status: 409 })
  }
  if (learner.status === 'ending') {
    const accesoVigente = learner.access_until
      ? new Date(learner.access_until) > new Date()
      : false

    // Con acceso vigente ya esta pagado hasta esa fecha: cobrarlo otra
    // vez seria un cargo duplicado por el mismo periodo. Reactivar es
    // otra operacion y no pasa por aqui.
    // Vencido, en cambio, es equivalente a 'inactive' y sigue de largo
    // hasta el cobro.
    if (accesoVigente) {
      return NextResponse.json(
        { error: 'Ese alumno esta dado de baja pero conserva acceso. Reactivalo desde tu perfil.' },
        { status: 409 }
      )
    }
  } else if (learner.status !== 'inactive') {
    return NextResponse.json({ error: 'Estado invalido' }, { status: 409 })
  }

  // 5. Suscripcion del titular. Debe estar viva: no se vende un asiento
  //    a mitad de precio a quien no ha pagado el primero.
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('provider_sub_id, plan, billing_cycle, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subError) {
    console.error('[seats/add] lectura de suscripcion fallo:', subError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!sub?.provider_sub_id) {
    return NextResponse.json(
      { error: 'Necesitas una suscripcion activa para agregar un alumno' },
      { status: 400 }
    )
  }

  // 6. Tope. Via RPC: un asiento dado de baja sigue ocupando lugar
  //    mientras conserve acceso, y contar status='active' no lo ve.
  const { data: ocupados, error: rpcError } = await supabase
    .rpc('occupied_seats', { p_account: user.id })

  if (rpcError) {
    console.error('[seats/add] occupied_seats fallo:', rpcError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if ((ocupados ?? 0) >= MAX_SEATS) {
    return NextResponse.json(
      { error: `Una cuenta admite hasta ${MAX_SEATS} alumnos` },
      { status: 409 }
    )
  }

  // 7. El asiento usa su PROPIO price, con el mismo monto de lista.
  //
  //    🔴 No puede reusar el del titular: Stripe rechaza dos items con
  //    el mismo price en una suscripcion. El 50% lo sigue poniendo el
  //    cupon, asi que el monto anunciado no cambia.
  //
  //    El asiento hereda el ciclo sin opcion. Si un mensual pudiera
  //    agregar asientos anuales al 50%, compraria el mensual barato,
  //    agregaria tres anuales y cancelaria el mensual al mes siguiente.
  //
  //    PLAN_DB_A_STRIPE se conserva solo para VALIDAR que el plan admite
  //    asientos: 'exam' no esta en el mapa y cae aqui.
  const planStripe = PLAN_DB_A_STRIPE[sub.plan]
  const priceId = STRIPE_SEAT_PRICES[sub.billing_cycle as DurationKey]

  if (!planStripe || !priceId) {
    console.error('[seats/add] sin price para', sub.plan, sub.billing_cycle)
    return NextResponse.json(
      { error: 'Tu plan no admite alumnos adicionales' },
      { status: 400 }
    )
  }

  // 8. Stripe. subscriptionItems.create y NO subscriptions.update:
  //    agrega por construccion —no puede pisar los items existentes
  //    porque no los menciona— y devuelve el item nuevo directo en vez
  //    de obligar a buscarlo dentro de un array. Esa busqueda es
  //    exactamente la suposicion que costo los tres bugs de facturacion
  //    de la s27.
  //
  //    El cupon va en el ITEM. En la suscripcion descontaria tambien el
  //    asiento del titular.
  //
  //    'always_invoice' y NO 'create_prorations': ver el 🔴 del docblock.
  //    Este es el parametro que hace que el cargo salga hoy.
  let subscriptionItemId: string | null = null
  try {
    const item = await stripe.subscriptionItems.create({
      subscription: sub.provider_sub_id,
      price: priceId,
      quantity: 1,
      discounts: [{ coupon: SEAT_DISCOUNT_COUPON }],
      proration_behavior: 'always_invoice',
      ...(prorationDate ? { proration_date: prorationDate } : {}),
    })
    subscriptionItemId = item.id
  } catch (error) {
    console.error('[seats/add] Stripe fallo:', error)

    // `create` lanza antes de devolver el id, asi que no lo tenemos.
    // Pero el item pudo quedar creado antes de que fallara el cobro:
    // dejarlo ahi significa facturar en la proxima renovacion por un
    // asiento que nunca se activo. Se busca por price.
    try {
      const items = await stripe.subscriptionItems.list({
        subscription: sub.provider_sub_id,
        limit: 100,
      })

      // El item huerfano es uno con el mismo price que NO esta
      // registrado en ningun learner de esta cuenta.
      //
      // 🔴 Este filtro es esencial: el asiento hereda SIEMPRE el price
      // del titular, asi que sin el se borraria un asiento que si esta
      // pagado y activo.
      const { data: registrados } = await supabase
        .from('learners')
        .select('stripe_subscription_item_id')
        .eq('account_user_id', user.id)
        .not('stripe_subscription_item_id', 'is', null)

      const conocidos = new Set(
        (registrados ?? []).map(r => r.stripe_subscription_item_id)
      )

      const huerfano = items.data.find(
        it => it.price?.id === priceId && !conocidos.has(it.id)
      )

      if (huerfano) {
        await stripe.subscriptionItems.del(huerfano.id, {
          proration_behavior: 'none',
        })
        console.error('[seats/add] item huerfano borrado:', huerfano.id)
      }
    } catch (rollbackError) {
      console.error('[seats/add] rollback fallo:', rollbackError)
    }

    // La tarjeta rechazada es del usuario y se puede reintentar con
    // otra; un fallo nuestro no. Mezclarlos deja al usuario sin saber
    // que hacer.
    const esTarjeta =
      typeof error === 'object' && error !== null &&
      (error as { type?: string }).type === 'StripeCardError'

    if (esTarjeta) {
      const mensaje = (error as { message?: string }).message
      return NextResponse.json(
        { error: mensaje || 'Tu banco rechazo el cargo. Intenta con otra tarjeta.', cardError: true },
        { status: 402 }
      )
    }

    return NextResponse.json({ error: 'No pudimos procesar el cargo' }, { status: 500 })
  }

  // 9. Activar SOLO despues de que Stripe confirmo. Si el cargo falla,
  //    la fila se queda en 'inactive' y nadie obtuvo acceso: nada de
  //    dar acceso primero y cobrar despues.
  //
  //    Service role porque learners es de solo lectura para el cliente
  //    (ver migracion 036).
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error: activarError } = await admin
    .from('learners')
    .update({
      status: 'active',
      access_until: null,
      seat_added_at: new Date().toISOString(),
      stripe_subscription_item_id: subscriptionItemId,
    })
    .eq('id', learnerId)

  if (activarError) {
    // El cargo YA salio. No se mueve al webhook: customer.subscription
    // .updated no dice que item se agrego ni de que learner es, y
    // habria que buscarlo por un subscription_item_id que esta fila
    // todavia no tiene escrito.
    //
    // El 409 de idempotencia del paso 4 deja al usuario reintentar sin
    // doble cargo; este log marca el caso raro para conciliarlo a mano.
    console.error(
      '[seats/add] COBRO SIN ACTIVAR — se intento revertir el item:', subscriptionItemId,
      'learner:', learnerId, activarError
    )

    // Mismo rollback que arriba: el asiento no se activo, asi que no
    // debe seguir en la suscripcion facturando en la proxima renovacion.
    // Aqui el cargo YA salio y el borrado del item no lo reembolsa: el
    // reembolso se concilia a mano con este log.
    try {
      await stripe.subscriptionItems.del(subscriptionItemId, {
        proration_behavior: 'none',
      })
    } catch (rollbackError) {
      console.error(
        '[seats/add] ITEM HUERFANO — no se pudo borrar:', subscriptionItemId,
        rollbackError
      )
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // El webhook de Stripe crea las materias del primer asiento al pagar.
  // Los asientos adicionales no pasan por ese webhook, asi que las
  // materias hay que crearlas aqui o el alumno entra a un dashboard
  // donde todo dice "Contenido próximamente".
  if (learner.education_level && learner.grade != null && learner.theme_id) {
    const { data: materias } = await admin
      .from('subjects')
      .select('id')
      .eq('education_level', learner.education_level)
      .contains('grades', [learner.grade])

    if (materias && materias.length > 0) {
      const filas = materias.map((m) => ({
        user_id: user.id,
        learner_id: learnerId,
        subject_id: m.id,
        theme_id: learner.theme_id,
        plan_type: 'grade',
        xp: 0,
        streak_days: 0,
        purchased_at: new Date().toISOString(),
      }))

      const { error: materiasError } = await admin
        .from('user_subjects')
        .upsert(filas, { onConflict: 'learner_id,subject_id' })

      if (materiasError) {
        // El cobro ya salio y el alumno ya esta activo. No se revierte:
        // se registra para conciliar, porque volver atras dejaria al
        // usuario pagando sin alumno en vez de con alumno sin materias.
        console.error('[seats/add] alumno activo SIN materias:', learnerId, materiasError)
      }
    }
  }

  return NextResponse.json({ ok: true, subscriptionItemId })
}
