import { describe, it, expect, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * I2 — WEBHOOK DE STRIPE
 *
 * Es el único punto del sistema que ve todos los pagos. Lo que escriba mal
 * aquí queda mal para siempre: `billing_cycle` equivocado manda el aviso de
 * renovación de la LFPC con el ciclo y el monto de otro plan, y una fecha de
 * periodo inventada corta el acceso de alguien que pagó.
 *
 * ── SIN CUENTA DE STRIPE, Y AUN ASÍ DE VERDAD ──────────────────────────
 *
 * 🔴 La verificación de firma es REAL. `generateTestHeaderString` firma el
 * payload con el mismo algoritmo que usa Stripe y `constructEvent` lo
 * verifica igual que en producción — sin salir a la red. Si alguien rompe
 * esa comprobación, estas pruebas lo ven.
 *
 * Lo único fabricado es `subscriptions.retrieve`, que sí es una llamada HTTP.
 * Todo lo demás —el mapeo por PRICE_TO_PLAN, la lectura de periodos desde el
 * item, el rescate de la metadata, los INSERT y UPDATE— corre tal cual está
 * escrito, contra la base local.
 *
 * Lo que NO cubre: que Stripe acepte lo que le mandamos. Eso son las pruebas
 * de contrato, y esperan a la cuenta sandbox.
 */

const h = vi.hoisted(() => ({
  /** Lo que devolverá `stripe.subscriptions.retrieve`. Lo fija cada prueba. */
  suscripcion: { valor: null as unknown },
}))

vi.mock('@/lib/payments/stripe', async () => {
  const Stripe = (await vi.importActual<{ default: typeof import('stripe').Stripe }>('stripe')).default
  // Instancia real solo para su criptografía de webhooks. Nunca hace red.
  const real = new Stripe('sk_test_ficticia_no_se_usa_en_red', { apiVersion: '2026-04-22.dahlia' })

  return {
    stripe: {
      webhooks: real.webhooks,
      subscriptions: {
        retrieve: async () => h.suscripcion.valor,
      },
    },
  }
})

const { POST } = await import('@/app/api/webhooks/stripe/route')
const StripeSdk = (await import('stripe')).default
const firmador = new StripeSdk('sk_test_ficticia_no_se_usa_en_red', { apiVersion: '2026-04-22.dahlia' })

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const SECRETO = process.env.STRIPE_WEBHOOK_SECRET!
const PRICE_SEMESTRAL = process.env.STRIPE_PRICE_GRADE_SEMESTRAL!
const PRICE_MENSUAL = process.env.STRIPE_PRICE_GRADE_MONTHLY_V2!

const creados: string[] = []

afterEach(async () => {
  for (const id of creados.splice(0)) {
    await admin.from('subscriptions').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  h.suscripcion.valor = null
})

async function crearUsuario(): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `pago-${randomUUID()}@ejemplo-test.mx`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error) throw new Error(error.message)
  creados.push(data.user!.id)
  return data.user!.id
}

/** Objeto de suscripción como lo devuelve la API 2026-04-22.dahlia. */
function suscripcionStripe(opts: {
  priceId?: string
  unitAmount?: number
  inicio?: number
  fin?: number
  /** Omite `current_period_end` del item. Flag propio y no `fin: undefined`:
   *  un parámetro con valor undefined recibe su default, así que por ahí NO
   *  se puede quitar la clave. */
  sinFin?: boolean
  metadata?: Record<string, string>
  customer?: string
} = {}) {
  const {
    priceId = PRICE_SEMESTRAL,
    unitAmount = 79900,
    inicio = Math.floor(Date.now() / 1000),
    fin = Math.floor(Date.now() / 1000) + 180 * 86400,
    sinFin = false,
    metadata = {},
    customer = 'cus_test_123',
  } = opts

  return {
    id: 'sub_test_123',
    status: 'active',
    trial_end: null,
    customer,
    metadata,
    items: {
      data: [
        {
          price: { id: priceId, unit_amount: unitAmount },
          // 🔴 Los periodos viven en el ITEM desde la API dahlia, no en la
          // raíz. Leerlos de la raíz devuelve undefined SIN error.
          current_period_start: inicio,
          ...(sinFin ? {} : { current_period_end: fin }),
        },
      ],
    },
  }
}

/** Firma el payload como lo haría Stripe y lo manda al handler. */
async function enviarEvento(evento: Record<string, unknown>, opts: { firmaValida?: boolean } = {}) {
  const { firmaValida = true } = opts
  const payload = JSON.stringify(evento)

  const signature = firmaValida
    ? firmador.webhooks.generateTestHeaderString({ payload, secret: SECRETO })
    : 't=1,v1=firma_falsa'

  return POST(
    new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
      body: payload,
    })
  )
}

function eventoCheckout(metadata: Record<string, string>) {
  return {
    id: `evt_${randomUUID()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        subscription: 'sub_test_123',
        amount_total: 79900,
        total_details: { amount_discount: 0 },
        metadata,
      },
    },
  }
}

async function leerSuscripcion(userId: string) {
  const { data } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
  return data
}

describe('I2 · checkout.session.completed', () => {
  it('🔴 escribe la suscripción con el billing_cycle de PRICE_TO_PLAN, no con el default', async () => {
    // Sin esto la columna se queda en su DEFAULT 'monthly' y un cliente
    // semestral recibe el aviso de renovación de la LFPC diciendo "Mensual"
    // con el monto del semestre.
    const userId = await crearUsuario()
    const inicio = Math.floor(Date.now() / 1000)
    const fin = inicio + 180 * 86400

    h.suscripcion.valor = suscripcionStripe({
      priceId: PRICE_SEMESTRAL,
      unitAmount: 79900,
      inicio,
      fin,
      metadata: { promo_slug: 'pasas1', utm_source: 'tiktok', utm_medium: 'cpc' },
    })

    const res = await enviarEvento(
      eventoCheckout({ user_id: userId, plan: 'estandar_v2', duration: 'semestral' })
    )

    expect(res.status).toBe(200)

    const fila = await leerSuscripcion(userId)
    expect(fila).not.toBeNull()
    expect(fila!.plan).toBe('grade')
    expect(fila!.billing_cycle).toBe('semestral')
    expect(fila!.price_mxn).toBe(79900)
    expect(fila!.status).toBe('active')
    expect(fila!.provider_sub_id).toBe('sub_test_123')
    expect(fila!.provider_customer_id).toBe('cus_test_123')

    // Periodos leídos del ITEM, al segundo.
    expect(new Date(fila!.current_period_start).getTime()).toBe(inicio * 1000)
    expect(new Date(fila!.current_period_end).getTime()).toBe(fin * 1000)

    // La campaña con la que se vendió, y el canal rescatado de la metadata.
    expect(fila!.promo_slug).toBe('pasas1')
    expect(fila!.acquisition).toEqual({ utm_source: 'tiktok', utm_medium: 'cpc' })
  })

  it('🔴 sin promo ni canal en la metadata: promo_slug y acquisition quedan NULL, no se inventan', async () => {
    // NULL es un dato correcto: significa "tráfico orgánico" o "sin campaña".
    // Rellenarlo con 'direct' sería indistinguible de una atribución real y
    // ensuciaría todo reporte por canal desde el primer día.
    const userId = await crearUsuario()
    h.suscripcion.valor = suscripcionStripe({ priceId: PRICE_MENSUAL, metadata: {} })

    await enviarEvento(eventoCheckout({ user_id: userId, plan: 'estandar_v2', duration: 'monthly' }))

    const fila = await leerSuscripcion(userId)
    expect(fila!.billing_cycle).toBe('monthly')
    expect(fila!.promo_slug).toBeNull()
    expect(fila!.acquisition).toBeNull()
  })

  it('sin user_id en la metadata: no escribe nada y responde 200', async () => {
    // 200 a propósito: reintentar no arreglaría un evento al que le falta el
    // dato. Se registra y se sigue.
    h.suscripcion.valor = suscripcionStripe()

    const res = await enviarEvento(eventoCheckout({ plan: 'estandar_v2', duration: 'monthly' }))

    expect(res.status).toBe(200)
    const { count } = await admin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('provider_sub_id', 'sub_test_123')
    expect(count).toBe(0)
  })

  it('🔴 item sin current_period_end: falla con 500 en vez de inventar una fecha', async () => {
    // El `?? now + 30d` que había antes escribió fechas inventadas durante
    // meses sin un solo error en los logs. Ahora revienta, que es lo correcto:
    // un 500 hace que Stripe reintente y deja rastro.
    const userId = await crearUsuario()
    h.suscripcion.valor = suscripcionStripe({ sinFin: true })

    const res = await enviarEvento(
      eventoCheckout({ user_id: userId, plan: 'estandar_v2', duration: 'monthly' })
    )

    expect(res.status).toBe(500)
    expect(await leerSuscripcion(userId)).toBeNull()
  })

  it('firma inválida: 400 y no llega a mirar el contenido', async () => {
    h.suscripcion.valor = suscripcionStripe()

    const res = await enviarEvento(eventoCheckout({ user_id: randomUUID() }), { firmaValida: false })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid signature' })
  })
})

describe('I2 · renovación y cancelación', () => {
  /** Inserta una suscripción ya existente, como la que dejó un alta previa. */
  async function sembrarSuscripcion(userId: string, subId: string) {
    const hace30 = new Date(Date.now() - 30 * 86400_000).toISOString()
    const { error } = await admin.from('subscriptions').insert({
      user_id: userId,
      plan: 'grade',
      status: 'active',
      price_mxn: 24900,
      billing_cycle: 'monthly',
      payment_provider: 'stripe',
      provider_sub_id: subId,
      current_period_start: hace30,
      current_period_end: new Date(Date.now() - 60_000).toISOString(),
    })
    if (error) throw new Error(error.message)
  }

  it('invoice.paid: adelanta el periodo y deja la suscripción activa', async () => {
    const userId = await crearUsuario()
    await sembrarSuscripcion(userId, 'sub_renueva_1')

    const inicio = Math.floor(Date.now() / 1000)
    const fin = inicio + 30 * 86400
    h.suscripcion.valor = suscripcionStripe({ inicio, fin })

    const res = await enviarEvento({
      id: `evt_${randomUUID()}`,
      object: 'event',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_test_1',
          object: 'invoice',
          subscription: 'sub_renueva_1',
          billing_reason: 'subscription_cycle',
          amount_paid: 24900,
        },
      },
    })

    expect(res.status).toBe(200)
    const fila = await leerSuscripcion(userId)
    expect(fila!.status).toBe('active')
    expect(new Date(fila!.current_period_end).getTime()).toBe(fin * 1000)
  })

  it('customer.subscription.deleted: marca cancelada y sella la fecha', async () => {
    const userId = await crearUsuario()
    await sembrarSuscripcion(userId, 'sub_cancela_1')

    const res = await enviarEvento({
      id: `evt_${randomUUID()}`,
      object: 'event',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_cancela_1', object: 'subscription' } },
    })

    expect(res.status).toBe(200)
    const fila = await leerSuscripcion(userId)
    expect(fila!.status).toBe('cancelled')
    expect(fila!.cancelled_at).not.toBeNull()
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════
 * PENDIENTE — PRUEBAS DE CONTRATO CONTRA STRIPE REAL
 *
 * Las de arriba prueban NUESTRA lógica. Estas probarían que nuestras
 * suposiciones sobre Stripe siguen siendo ciertas, y solo se pueden escribir
 * con la cuenta sandbox configurada (9 price IDs, cupón SEAT_50 y los
 * promotion codes de las campañas).
 *
 * Se anotan aquí para no tener que redescubrirlas:
 *
 *   1. Los periodos siguen viniendo en el ITEM y no en la raíz de
 *      Subscription. Es la suposición más frágil de todo el webhook: cambió
 *      en la API 2026-04-22.dahlia y leerla del sitio viejo devuelve
 *      undefined SIN error.
 *
 *   2. `discounts` y `allow_promotion_codes` NO pueden coexistir en una
 *      Checkout Session. El código lo resuelve con un spread ternario; si
 *      Stripe lo permitiera algún día, ese ternario sobra.
 *
 *   3. Un promotion code con `first_time_transaction` es RECHAZADO para un
 *      cliente que ya compró — y tumba la sesión entera, no solo el
 *      descuento. Es la razón de que resolvePromoParaCheckout devuelva null
 *      cuando `yaTuvoSuscripcion`.
 *
 *   4. Stripe rechaza dos subscription items con el mismo price en una misma
 *      suscripción. Es la razón de que existan STRIPE_SEAT_PRICES aparte.
 *
 *   5. El cupón SEAT_50 existe con ESE id exacto y es `forever`, no `once`.
 *      Con `once` el asiento subiría a precio de lista en la primera
 *      renovación.
 *
 *   6. `proration_behavior: 'always_invoice'` cobra HOY al agregar un
 *      asiento, en vez de dejarlo para la siguiente factura.
 *
 *   7. La firma de los webhooks reales pasa `constructEvent` con el
 *      `whsec_` de la cuenta. Aquí se prueba con uno ficticio: el algoritmo
 *      es el mismo, pero no que el secreto configurado sea el correcto.
 * ═══════════════════════════════════════════════════════════════════════
 */
