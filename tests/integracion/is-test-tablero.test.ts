import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { cargarFranja } from '@/app/(admin)/admin/metricas/_lib/datos'

/**
 * is_test — EL FILTRO DEL TABLERO
 *
 * 🔴 POR QUÉ IMPORTA: un número inflado por cuentas internas se lee como real
 * y guía decisiones. La migración 045 marcó como `is_test` las cuentas de
 * prueba y TODA suscripción anterior al 13-ago-2026, porque hasta esa fecha
 * el proyecto apuntaba a la sandbox de Stripe. Si el filtro se rompe, el MRR
 * del tablero incluye cobros que nunca existieron.
 *
 * 🔴 SE MIDEN DIFERENCIAS, NO ABSOLUTOS. `cargarFranja` cuenta toda la base,
 * así que afirmar "el MRR es 249" ataría la prueba a que la base esté vacía y
 * la haría fallar según el orden en que corriera. Midiendo el delta entre
 * antes y después de sembrar, el resultado es el mismo con la base vacía o
 * con mil filas.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const creados: string[] = []

afterEach(async () => {
  for (const id of creados.splice(0)) {
    await admin.from('subscriptions').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
})

/** Cuenta con suscripción activa, marcada o no como de prueba. */
async function cuentaConSuscripcion(esPrueba: boolean, montoCentavos: number) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `metrica-${randomUUID()}@ejemplo-test.mx`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error) throw new Error(error.message)
  const userId = data.user!.id
  creados.push(userId)

  await admin.from('users').update({ is_test: esPrueba }).eq('id', userId)

  const { error: sErr } = await admin.from('subscriptions').insert({
    user_id: userId,
    plan: 'grade',
    status: 'active',
    price_mxn: montoCentavos,
    billing_cycle: 'monthly',
    payment_provider: 'stripe',
    provider_sub_id: `sub_metrica_${randomUUID()}`,
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    is_test: esPrueba,
  })
  if (sErr) throw new Error(sErr.message)

  return userId
}

describe('is_test · toggle del tablero', () => {
  it('🔴 con el toggle APAGADO, las cuentas de prueba no suman al MRR ni a los altas', async () => {
    const antes = await cargarFranja(false)

    await cuentaConSuscripcion(false, 24900) // real
    await cuentaConSuscripcion(true, 99900) // de prueba, monto grande a propósito

    const despues = await cargarFranja(false)

    // Solo entra la real.
    expect(despues.mrr - antes.mrr).toBe(24900)
    expect(despues.cuentasActivas - antes.cuentasActivas).toBe(1)
    expect(despues.nuevos30 - antes.nuevos30).toBe(1)
  })

  it('🔴 con el toggle ENCENDIDO, entran las dos', async () => {
    const antes = await cargarFranja(true)

    await cuentaConSuscripcion(false, 24900)
    await cuentaConSuscripcion(true, 99900)

    const despues = await cargarFranja(true)

    expect(despues.mrr - antes.mrr).toBe(24900 + 99900)
    expect(despues.cuentasActivas - antes.cuentasActivas).toBe(2)
    expect(despues.nuevos30 - antes.nuevos30).toBe(2)
  })

  it('cuentasDePrueba cuenta las internas SIEMPRE, mire donde mire el toggle', async () => {
    // Es el contador que avisa de cuánta base es artificial. No depende del
    // toggle a propósito: si dependiera, con el toggle apagado marcaría cero
    // y parecería que no hay ninguna.
    const antes = await cargarFranja(false)

    await cuentaConSuscripcion(true, 10000)
    await cuentaConSuscripcion(true, 10000)

    const apagado = await cargarFranja(false)
    const encendido = await cargarFranja(true)

    expect(apagado.cuentasDePrueba - antes.cuentasDePrueba).toBe(2)
    expect(encendido.cuentasDePrueba).toBe(apagado.cuentasDePrueba)
  })

  it('una cuenta de prueba SIN suscripción sigue contando como alta de prueba, no como real', async () => {
    const antes = await cargarFranja(false)

    const { data } = await admin.auth.admin.createUser({
      email: `solo-user-${randomUUID()}@ejemplo-test.mx`,
      password: randomUUID(),
      email_confirm: true,
    })
    creados.push(data.user!.id)
    await admin.from('users').update({ is_test: true }).eq('id', data.user!.id)

    const despues = await cargarFranja(false)

    expect(despues.nuevos30 - antes.nuevos30).toBe(0)
    expect(despues.cuentasDePrueba - antes.cuentasDePrueba).toBe(1)
  })
})
