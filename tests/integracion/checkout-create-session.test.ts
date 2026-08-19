import { describe, it, expect, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

/**
 * I3 — LA PUERTA DE COBRO
 *
 * 🔴 EL CANDADO CENTRAL de todo el sistema de promociones vive aquí. El
 * endpoint es público para cualquier usuario autenticado: un POST a mano con
 * { plan:'estandar_v2', duration:'annual', promo:'pasas1' } aplicaría el
 * descuento de una campaña mensual a un plan anual. La UI no protege nada —
 * solo decora. Lo que protege es el servidor, y es lo que se prueba aquí.
 *
 * Stripe va simulado: `sessions.create` y `promotionCodes.list` son llamadas
 * de red. Lo que se verifica es QUÉ SE LE MANDA a Stripe, que es donde vive
 * la decisión. Que Stripe acepte esos parámetros es una prueba de contrato y
 * espera a la cuenta sandbox (ver la lista en webhook-stripe.test.ts).
 */

const h = vi.hoisted(() => ({
  cookies: { valor: [] as { name: string; value: string }[] },
  /** Argumentos con los que se llamó a checkout.sessions.create. */
  sesionCreada: { args: null as Record<string, unknown> | null },
  /** Lo que devuelve promotionCodes.list. Vacío = Stripe no reconoce el código. */
  promotionCodes: { data: [] as { id: string }[] },
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => h.cookies.valor, set: () => {} }),
}))

vi.mock('@/lib/payments/stripe', () => ({
  stripe: {
    promotionCodes: {
      list: async () => ({ data: h.promotionCodes.data }),
    },
    checkout: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          h.sesionCreada.args = args
          return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }
        },
      },
    },
  },
}))

const { POST: crearSesion } = await import('@/app/api/checkout/create-session/route')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const creados: string[] = []
const promosCreadas: string[] = []

afterEach(async () => {
  for (const id of creados.splice(0)) {
    await admin.from('subscriptions').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  for (const slug of promosCreadas.splice(0)) {
    await admin.from('promo_campaigns').delete().eq('slug', slug)
  }
  h.cookies.valor = []
  h.sesionCreada.args = null
  h.promotionCodes.data = []
})

async function usuarioConSesion() {
  const email = `checkout-${randomUUID()}@ejemplo-test.mx`
  const password = randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(error.message)
  const userId = data.user!.id
  creados.push(userId)

  const almacen = new Map<string, string>()
  const cliente = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...almacen].map(([name, value]) => ({ name, value })),
        setAll: (cs) => cs.forEach(({ name, value }) => almacen.set(name, value)),
      },
    }
  )
  const { error: loginError } = await cliente.auth.signInWithPassword({ email, password })
  if (loginError) throw new Error(loginError.message)
  h.cookies.valor = [...almacen].map(([name, value]) => ({ name, value }))

  return userId
}

/** Campaña vigente que cubre SOLO el ciclo indicado. */
async function crearCampana(ciclos: string[], planes = ['estandar_v2']) {
  const slug = `test-${randomUUID().slice(0, 8)}`
  const { error } = await admin.from('promo_campaigns').insert({
    slug,
    activa: true,
    codigo_visible: 'TESTCODE',
    planes,
    ciclos,
    descuento_tipo: 'monto',
    descuento_valor: 248,
    cta_label: 'Empieza por $1',
  })
  if (error) throw new Error(error.message)
  promosCreadas.push(slug)
  return slug
}

function peticion(body: unknown) {
  return new Request('http://localhost:3000/api/checkout/create-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('I3 · candados que cortan antes de Stripe', () => {
  it('sin sesión: 401', async () => {
    h.cookies.valor = []

    const res = await crearSesion(peticion({ plan: 'estandar_v2', duration: 'monthly' }))

    expect(res.status).toBe(401)
    expect(h.sesionCreada.args).toBeNull()
  })

  it('plan o duration inválidos: 400', async () => {
    await usuarioConSesion()

    const sinPlan = await crearSesion(peticion({ duration: 'monthly' }))
    expect(sinPlan.status).toBe(400)

    const planRaro = await crearSesion(peticion({ plan: 'plan_inventado', duration: 'monthly' }))
    expect(planRaro.status).toBe(400)

    const cicloRaro = await crearSesion(peticion({ plan: 'estandar_v2', duration: 'trimestral' }))
    expect(cicloRaro.status).toBe(400)

    expect(h.sesionCreada.args).toBeNull()
  })

  it('🔴 personalizado_v2 con el flag apagado: 400, aunque la UI ya no lo ofrezca', async () => {
    // El endpoint es público para cualquier autenticado: sin este candado, un
    // POST a mano abre el checkout de un producto que no vendemos.
    await usuarioConSesion()

    const res = await crearSesion(peticion({ plan: 'personalizado_v2', duration: 'monthly' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Plan no disponible' })
    expect(h.sesionCreada.args).toBeNull()
  })
})

describe('I3 · el candado de la promoción', () => {
  it('🔴 campaña que NO cubre el ciclo pedido: la sesión sale SIN descuento', async () => {
    // Campaña mensual, checkout anual. La promo se ignora y el checkout abre
    // a precio de lista, con el campo de código disponible.
    const slug = await crearCampana(['mensual'])
    await usuarioConSesion()
    h.promotionCodes.data = [{ id: 'promo_no_deberia_usarse' }]

    const res = await crearSesion(
      peticion({ plan: 'estandar_v2', duration: 'annual', promo: slug })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      promo_aplicada: null,
    })

    const args = h.sesionCreada.args!
    expect(args.discounts).toBeUndefined()
    expect(args.allow_promotion_codes).toBe(true)
  })

  it('campaña que SÍ cubre el ciclo: la sesión lleva el promotion code', async () => {
    const slug = await crearCampana(['anual'])
    await usuarioConSesion()
    h.promotionCodes.data = [{ id: 'promo_correcto_123' }]

    const res = await crearSesion(
      peticion({ plan: 'estandar_v2', duration: 'annual', promo: slug })
    )

    expect(res.status).toBe(200)
    expect((await res.json()).promo_aplicada).toBe(slug)

    const args = h.sesionCreada.args!
    expect(args.discounts).toEqual([{ promotion_code: 'promo_correcto_123' }])
    // 🔴 Excluyentes: Stripe rechaza la sesión si van los dos.
    expect(args.allow_promotion_codes).toBeUndefined()
  })

  it('🔴 campaña viva pero sin código activo en Stripe: 409, se corta la venta', async () => {
    // El usuario ya vio "$1" en pantalla. Abrir el checkout a precio de lista
    // sería anunciar un precio y cobrar otro.
    const slug = await crearCampana(['mensual'])
    await usuarioConSesion()
    h.promotionCodes.data = [] // Stripe no reconoce el código

    const res = await crearSesion(
      peticion({ plan: 'estandar_v2', duration: 'monthly', promo: slug })
    )

    expect(res.status).toBe(409)
    expect(h.sesionCreada.args).toBeNull()
  })

  it('sin promo: allow_promotion_codes queda abierto para el código de escuelas', async () => {
    await usuarioConSesion()

    await crearSesion(peticion({ plan: 'estandar_v2', duration: 'monthly' }))

    const args = h.sesionCreada.args!
    expect(args.allow_promotion_codes).toBe(true)
    expect(args.discounts).toBeUndefined()
    // Primera compra: lleva trial.
    expect((args.subscription_data as { trial_period_days?: number }).trial_period_days).toBe(7)
  })
})
