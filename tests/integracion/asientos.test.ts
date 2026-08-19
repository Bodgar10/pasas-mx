import { describe, it, expect, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { MAX_SEATS } from '@/lib/payments/config'

/**
 * ASIENTOS — agregar, quitar y reactivar alumnos adicionales
 *
 * Lo que se prueba aquí es el CONTROL DE ACCESO y el TOPE, que es donde vive
 * el riesgo de negocio: sin ellos, una cuenta comparte login entre varias
 * familias, o alguien agrega un asiento sobre la suscripción de otro.
 *
 * 🔴 El tope se calcula con la RPC `occupied_seats`, no con un COUNT de
 * activos, y esa diferencia importa: un asiento dado de baja SIGUE ocupando
 * lugar mientras conserve acceso pagado. Contar solo `status='active'` dejaría
 * meter un cuarto alumno.
 *
 * Stripe va simulado. Lo que exige cuenta real —que rechace dos items con el
 * mismo price, y qué prorrateo cobra `always_invoice`— está anotado en la
 * lista de pruebas de contrato de webhook-stripe.test.ts.
 */

const h = vi.hoisted(() => ({
  cookies: { valor: [] as { name: string; value: string }[] },
  itemsCreados: { lista: [] as Record<string, unknown>[] },
  itemsBorrados: { lista: [] as string[] },
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => h.cookies.valor, set: () => {} }),
}))

vi.mock('@/lib/payments/stripe', () => ({
  stripe: {
    subscriptionItems: {
      create: async (args: Record<string, unknown>) => {
        h.itemsCreados.lista.push(args)
        return { id: `si_test_${h.itemsCreados.lista.length}` }
      },
      del: async (id: string) => {
        h.itemsBorrados.lista.push(id)
        return { id, deleted: true }
      },
      list: async () => ({ data: [] }),
    },
  },
}))

const { POST: agregarAsiento } = await import('@/app/api/seats/add/route')
const { POST: quitarAsiento } = await import('@/app/api/seats/remove/route')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const TEMA = '11111111-1111-4111-8111-111111111101'
const creados: string[] = []

afterEach(async () => {
  for (const id of creados.splice(0)) {
    await admin.from('user_subjects').delete().eq('user_id', id)
    await admin.from('learners').delete().eq('account_user_id', id)
    await admin.from('subscriptions').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  h.cookies.valor = []
  h.itemsCreados.lista = []
  h.itemsBorrados.lista = []
})

/** Titular con suscripción viva y sesión iniciada. */
async function titular(opts: { conSuscripcion?: boolean } = {}) {
  const { conSuscripcion = true } = opts
  const email = `asiento-${randomUUID()}@ejemplo-test.mx`
  const password = randomUUID()

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(error.message)
  const userId = data.user!.id
  creados.push(userId)

  await admin.from('users').update({ tos_accepted_at: new Date().toISOString(), onboarding_done: true }).eq('id', userId)

  if (conSuscripcion) {
    const { error: sErr } = await admin.from('subscriptions').insert({
      user_id: userId,
      plan: 'grade',
      status: 'active',
      price_mxn: 24900,
      billing_cycle: 'monthly',
      payment_provider: 'stripe',
      provider_sub_id: `sub_asiento_${randomUUID()}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    })
    if (sErr) throw new Error(sErr.message)
  }

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
  const { error: lErr } = await cliente.auth.signInWithPassword({ email, password })
  if (lErr) throw new Error(lErr.message)
  h.cookies.valor = [...almacen].map(([name, value]) => ({ name, value }))

  return userId
}

async function crearLearner(
  userId: string,
  opts: { slot: number; status: string; accessUntil?: string | null; itemId?: string | null }
) {
  const { data, error } = await admin
    .from('learners')
    .insert({
      account_user_id: userId,
      display_name: `Alumno ${opts.slot}`,
      slot: opts.slot,
      is_primary: opts.slot === 1,
      education_level: 'middle_school',
      grade: 1,
      theme_id: TEMA,
      status: opts.status,
      access_until: opts.accessUntil ?? null,
      stripe_subscription_item_id: opts.itemId ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

function peticion(url: string, body: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('asientos · controles de acceso', () => {
  it('sin learnerId: 400', async () => {
    await titular()
    const res = await agregarAsiento(peticion('/api/seats/add', {}))
    expect(res.status).toBe(400)
  })

  it('learner de otra cuenta: 403, y no se crea nada en Stripe', async () => {
    await titular()
    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId: randomUUID() }))

    expect(res.status).toBe(403)
    expect(h.itemsCreados.lista).toHaveLength(0)
  })

  it('alumno que ya está activo: 409', async () => {
    const userId = await titular()
    const learnerId = await crearLearner(userId, { slot: 2, status: 'active' })

    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Ese alumno ya esta activo' })
  })

  it('🔴 dado de baja pero con acceso vigente: 409, no se cobra dos veces el mismo periodo', async () => {
    const userId = await titular()
    const learnerId = await crearLearner(userId, {
      slot: 2,
      status: 'ending',
      accessUntil: new Date(Date.now() + 5 * 86400_000).toISOString(),
    })

    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId }))

    expect(res.status).toBe(409)
    expect(h.itemsCreados.lista).toHaveLength(0)
  })

  it('sin suscripción activa: 400 — no se vende un asiento a mitad de precio a quien no pagó el primero', async () => {
    const userId = await titular({ conSuscripcion: false })
    const learnerId = await crearLearner(userId, { slot: 2, status: 'inactive' })

    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId }))

    expect(res.status).toBe(400)
    expect(h.itemsCreados.lista).toHaveLength(0)
  })
})

describe('asientos · el tope', () => {
  it(`🔴 con ${MAX_SEATS} lugares ocupados: 409 y no se cobra`, async () => {
    const userId = await titular()
    // Tres ocupados: dos activos y uno de baja que CONSERVA acceso — ese
    // tercero es el que un COUNT de 'active' no vería.
    await crearLearner(userId, { slot: 1, status: 'active' })
    await crearLearner(userId, { slot: 2, status: 'active' })
    await crearLearner(userId, {
      slot: 3,
      status: 'ending',
      accessUntil: new Date(Date.now() + 5 * 86400_000).toISOString(),
    })
    const cuarto = await crearLearner(userId, { slot: 4, status: 'inactive' })

    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId: cuarto }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: `Una cuenta admite hasta ${MAX_SEATS} alumnos` })
    expect(h.itemsCreados.lista).toHaveLength(0)
  })

  it('un asiento de baja YA VENCIDO deja lugar libre', async () => {
    const userId = await titular()
    await crearLearner(userId, { slot: 1, status: 'active' })
    await crearLearner(userId, { slot: 2, status: 'active' })
    await crearLearner(userId, {
      slot: 3,
      status: 'ending',
      accessUntil: new Date(Date.now() - 86400_000).toISOString(), // venció ayer
    })
    const nuevo = await crearLearner(userId, { slot: 4, status: 'inactive' })

    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId: nuevo }))

    // Ya no choca con el tope: el vencido no ocupa lugar.
    expect(res.status).toBe(200)
    expect(h.itemsCreados.lista).toHaveLength(1)
  })
})

describe('asientos · alta y baja', () => {
  it('alta: activa el alumno, guarda el item de Stripe y le siembra sus materias', async () => {
    const userId = await titular()
    const learnerId = await crearLearner(userId, { slot: 2, status: 'inactive' })

    const res = await agregarAsiento(peticion('/api/seats/add', { learnerId }))
    expect(res.status).toBe(200)

    // El cupón oculto va en el ITEM, no en la suscripción: en la suscripción
    // descontaría también el asiento del titular.
    expect(h.itemsCreados.lista[0]).toMatchObject({
      quantity: 1,
      discounts: [{ coupon: 'SEAT_50' }],
      proration_behavior: 'always_invoice',
    })

    const { data: learner } = await admin
      .from('learners')
      .select('status, stripe_subscription_item_id')
      .eq('id', learnerId)
      .single()
    expect(learner!.status).toBe('active')
    expect(learner!.stripe_subscription_item_id).toBe('si_test_1')

    // Las materias de su grado, sembradas por materiasParaGrado.
    const { count } = await admin
      .from('user_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('learner_id', learnerId)
    expect(count).toBe(2) // grado 1 del seed: Matemáticas y Español
  })

  it('🔴 baja: pasa a "ending" con acceso hasta el fin del periodo ya pagado', async () => {
    const userId = await titular()
    const learnerId = await crearLearner(userId, {
      slot: 2,
      status: 'active',
      itemId: 'si_existente_1',
    })

    const res = await quitarAsiento(peticion('/api/seats/remove', { learnerId }))
    expect(res.status).toBe(200)

    const { data: learner } = await admin
      .from('learners')
      .select('status, access_until')
      .eq('id', learnerId)
      .single()

    // No se corta el acceso al instante: se conserva lo que ya se pagó.
    expect(learner!.status).toBe('ending')
    expect(learner!.access_until).not.toBeNull()
    expect(new Date(learner!.access_until!).getTime()).toBeGreaterThan(Date.now())

    // Y el item deja de facturar en la siguiente renovación.
    expect(h.itemsBorrados.lista).toContain('si_existente_1')
  })
})
