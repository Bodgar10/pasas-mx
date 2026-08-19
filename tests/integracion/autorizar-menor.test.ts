import { describe, it, expect, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * I1 — AUTORIZACIÓN DE MENOR
 *
 * 🔴 ES EL FLUJO QUE SE ROMPIÓ ESTA SEMANA. Un cambio lo dejó sin estampar el
 * consentimiento y nadie se enteró hasta que alguien lo recorrió a mano en
 * producción.
 *
 * Solo escribe en `public.users`: no toca Stripe, no manda correos y cada
 * prueba borra lo que creó. Es la más barata de todas y la que más protege.
 *
 * ── POR QUÉ HAY MOCKS AQUÍ ─────────────────────────────────────────────
 *
 * `autorizarMenor` es un server action y usa dos APIs que solo existen dentro
 * del runtime de Next: `headers()` y `redirect()`. Fuera de una petición real
 * la primera lanza y la segunda no tiene a dónde ir.
 *
 * Los mocks reemplazan ESAS DOS y nada más. Todo lo demás —la lectura por
 * token, la validación de la declaración, el cálculo de la caducidad, el
 * UPDATE, la limpieza de `pending_checkout`— corre tal cual está escrito,
 * contra la base local de verdad. No se toca `src/`.
 *
 * 🔴 El mock de `redirect` LANZA, igual que el real. No es un detalle: el
 * código depende de eso para cortar la ejecución ("NO METAS ESTE CUERPO EN UN
 * try/catch" dice su propio comentario). Un mock que devolviera en vez de
 * lanzar dejaría seguir al código y probaría un flujo que no existe.
 */

const { RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    destino: string
    constructor(destino: string) {
      super(`NEXT_REDIRECT:${destino}`)
      this.name = 'RedirectError'
      this.destino = destino
    }
  }
  return { RedirectError }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectError(url)
  },
}))

vi.mock('next/headers', () => ({
  // Con dos IPs para comprobar de paso que el código se queda con la primera.
  headers: async () => new Headers({ 'x-forwarded-for': '187.190.1.1, 10.0.0.1' }),
}))

const { autorizarMenor } = await import('@/app/autorizar-menor/[token]/actions')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const IP_ESPERADA = '187.190.1.1'

/** Ids creados por la prueba en curso. Se borran en afterEach. */
const creados: string[] = []

afterEach(async () => {
  // 🔴 Cada prueba se lleva su basura. Una suite que deja filas es una suite
  // cuyo resultado depende del orden en que corrió.
  for (const id of creados.splice(0)) {
    await admin.auth.admin.deleteUser(id) // CASCADE borra public.users
  }
})

/** Menor con token de autorización, en el estado que pida la prueba. */
async function crearMenor(opts: {
  status?: 'pending' | 'granted'
  expiraEnDias?: number
  pendingCheckout?: Record<string, unknown> | null
} = {}) {
  const { status = 'pending', expiraEnDias = 7, pendingCheckout = null } = opts

  const email = `menor-${randomUUID()}@ejemplo-test.mx`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error) throw new Error(`no se pudo crear el usuario de prueba: ${error.message}`)

  const userId = data.user!.id
  creados.push(userId)

  const token = randomUUID()
  const { error: upError } = await admin
    .from('users')
    .update({
      parent_name: 'Tutor de Prueba',
      parent_email: email,
      parental_consent_status: status,
      parental_consent_token: token,
      parental_consent_token_expires_at: new Date(
        Date.now() + expiraEnDias * 24 * 60 * 60 * 1000
      ).toISOString(),
      ...(status === 'granted'
        ? { parental_consent_at: new Date('2026-01-01T00:00:00Z').toISOString() }
        : {}),
      pending_checkout: pendingCheckout,
    })
    .eq('id', userId)
  if (upError) throw new Error(`no se pudo preparar el menor: ${upError.message}`)

  return { userId, token, email }
}

/** Lee la fila tal como quedó. */
async function leerUsuario(userId: string) {
  const { data } = await admin
    .from('users')
    .select('parental_consent_status, parental_consent_at, parental_consent_ip, pending_checkout')
    .eq('id', userId)
    .single()
  return data!
}

/** Ejecuta el action y devuelve a dónde redirigió. Falla si no redirige. */
async function capturarRedirect(fn: () => Promise<unknown>): Promise<string> {
  let destino: string | null = null
  try {
    await fn()
  } catch (err) {
    if (err instanceof RedirectError) destino = err.destino
    else throw err
  }
  if (destino === null) throw new Error('se esperaba un redirect y la acción no redirigió')
  return destino
}

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

describe('I1 · autorizarMenor', () => {
  it('🔴 sin la declaración marcada: NO estampa nada y vuelve con ?estado=falta_declaracion', async () => {
    // El bug real: el checkbox no tenía `name`, así que nunca llegaba al
    // FormData y un POST armado a mano autorizaba la cuenta sin marcarlo.
    // Esta prueba manda exactamente ese POST.
    const { userId, token } = await crearMenor()

    const destino = await capturarRedirect(() => autorizarMenor(formulario({ token })))

    expect(destino).toBe(`/autorizar-menor/${token}?estado=falta_declaracion`)

    const fila = await leerUsuario(userId)
    expect(fila.parental_consent_status).toBe('pending')
    expect(fila.parental_consent_at).toBeNull()
    expect(fila.parental_consent_ip).toBeNull()
  })

  it('token válido con la declaración: estampa estado, fecha e IP', async () => {
    const { userId, token } = await crearMenor()
    const antes = Date.now()

    await capturarRedirect(() => autorizarMenor(formulario({ token, declaracion: 'on' })))

    const fila = await leerUsuario(userId)
    expect(fila.parental_consent_status).toBe('granted')
    expect(fila.parental_consent_ip).toBe(IP_ESPERADA)

    // La constancia tiene que ser de AHORA, no una fecha heredada.
    const estampada = new Date(fila.parental_consent_at!).getTime()
    expect(estampada).toBeGreaterThanOrEqual(antes - 1000)
    expect(estampada).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('token vencido: no estampa y avisa con ?estado=vencido', async () => {
    const { userId, token } = await crearMenor({ expiraEnDias: -1 })

    const destino = await capturarRedirect(() =>
      autorizarMenor(formulario({ token, declaracion: 'on' }))
    )

    expect(destino).toBe(`/autorizar-menor/${token}?estado=vencido`)

    const fila = await leerUsuario(userId)
    expect(fila.parental_consent_status).toBe('pending')
    expect(fila.parental_consent_at).toBeNull()
  })

  it('token inexistente: ?estado=invalido, sin confirmar a un extraño si el token existe', async () => {
    const inventado = randomUUID()

    const destino = await capturarRedirect(() =>
      autorizarMenor(formulario({ token: inventado, declaracion: 'on' }))
    )

    expect(destino).toBe(`/autorizar-menor/${inventado}?estado=invalido`)
  })

  it('🔴 segundo envío sobre una cuenta ya autorizada: idempotente, no re-estampa y sale a /bienvenida', async () => {
    // Un doble clic, un "Atrás y volver a mandar" o un reintento del navegador
    // tienen que acabar donde acaba el primer envío. Y la fecha original es la
    // constancia: volver a escribirla falsearía cuándo se autorizó.
    const { userId, token } = await crearMenor({
      status: 'granted',
      pendingCheckout: { plan: 'estandar_v2', duration: 'monthly', promo_slug: 'pasas1' },
    })
    const antes = await leerUsuario(userId)

    const destino = await capturarRedirect(() =>
      autorizarMenor(formulario({ token, declaracion: 'on' }))
    )

    expect(destino).toBe('/bienvenida?plan=estandar_v2&duration=monthly&promo=pasas1')

    const despues = await leerUsuario(userId)
    expect(despues.parental_consent_at).toBe(antes.parental_consent_at)
    expect(despues.parental_consent_ip).toBeNull()
  })
})
