/**
 * GET /api/subscription/estado
 * ---------------------------------------------------------------------------
 * ¿Esta cuenta tuvo alguna suscripción alguna vez?
 *
 * Existe por una sola razón: el promotion code de las campañas es
 * `first_time_transaction`. A un cliente que vuelve, Stripe le rechazaría el
 * código y se caería la Checkout Session entera, así que
 * resolvePromoParaCheckout ya lo baja a precio de lista en el servidor. Este
 * endpoint es para que la PANTALLA tampoco le prometa el descuento antes de
 * llegar ahí: /planes y /bienvenida son 'use client' de arriba a abajo y no
 * pueden consultar la base en el render.
 *
 * 🔴 Es EXACTAMENTE la misma consulta que hace
 * /api/checkout/create-session al calcular `hasHadSubscription`:
 *   select('id').eq('user_id', user.id).limit(1)
 * No es un dato nuevo ni una columna paralela — es el mismo hecho leído desde
 * otra puerta. Si algún día cambia el criterio de "ya tuvo suscripción",
 * tienen que cambiar los dos a la vez o la pantalla y el cobro discreparán.
 *
 * 🔴 NO cuenta el estado de la suscripción. Una cancelada o vencida sigue
 * siendo una suscripción previa: para Stripe la transacción ya no es la
 * primera, y ese es el único criterio que importa aquí. Filtrar por
 * status='active' haría que un ex-cliente viera la promo y el checkout se le
 * cayera.
 *
 * Sin sesión: 401. No hay respuesta neutra que dar — quien pregunta esto
 * está a punto de pintar un precio, y "no sé" no es un precio.
 *
 * Response: { yaTuvoSuscripcion: boolean } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingSubs, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    // 🔴 Un error de lectura NO se traduce a `false`. El hook trata la
    // ausencia de respuesta como "ya tuvo" y oculta la promo; devolver 500 es
    // lo que dispara ese camino. Responder { yaTuvoSuscripcion: false } aquí
    // sería afirmar, sobre una consulta que falló, justo lo que hace que la
    // pantalla prometa un descuento.
    if (error) {
      console.error('[api/subscription/estado] lectura de subscriptions falló:', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ yaTuvoSuscripcion: (existingSubs?.length ?? 0) > 0 })
  } catch (error) {
    console.error('[api/subscription/estado] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
