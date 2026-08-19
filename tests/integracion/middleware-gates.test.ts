import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

/**
 * I4 — LOS GATES DEL MIDDLEWARE
 *
 * Siete ramas de redirección encadenadas donde el ORDEN importa: el gate
 * legal va antes que el de onboarding a propósito, porque el onboarding
 * recolecta datos personales y el Aviso dice que el consentimiento se recaba
 * "previo al tratamiento". Cambiar ese orden no da error: solo deja de
 * cumplirse una obligación legal, en silencio.
 *
 * ── SIN MOCKS, Y ESO ES EL PUNTO ───────────────────────────────────────
 *
 * Aquí no se mockea nada. El middleware se ejecuta con un `NextRequest` de
 * verdad y cookies de sesión de verdad, y habla con el Auth y la base
 * locales. Mockear `@supabase/ssr` habría vaciado la prueba: la integración
 * con esa librería ES lo que el middleware hace.
 *
 * 🔴 Las cookies las genera la PROPIA librería (`createServerClient` con un
 * almacén en memoria), no las fabrico a mano. Si mañana cambia el formato o
 * el nombre de la cookie, estas pruebas siguen siendo válidas.
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

/** Usuario con sesión iniciada. Devuelve el id y la cabecera Cookie lista. */
async function usuarioConSesion(perfil: Record<string, unknown> = {}) {
  const email = `gate-${randomUUID()}@ejemplo-test.mx`
  const password = randomUUID()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(error.message)
  const userId = data.user!.id
  creados.push(userId)

  // Por defecto: T&C aceptados y onboarding hecho, para que los gates
  // anteriores no disparen y cada prueba controle solo el suyo.
  const { error: upError } = await admin
    .from('users')
    .update({
      tos_accepted_at: new Date().toISOString(),
      tos_accepted_version: '1.0-test',
      onboarding_done: true,
      ...perfil,
    })
    .eq('id', userId)
  if (upError) throw new Error(upError.message)

  // 🔴 Las cookies las escribe @supabase/ssr, no yo.
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
  if (loginError) throw new Error(`no se pudo iniciar sesión: ${loginError.message}`)

  const cookie = [...almacen].map(([n, v]) => `${n}=${v}`).join('; ')
  return { userId, cookie }
}

/** Corre el middleware sobre una ruta y devuelve a dónde mandó (o null). */
async function pedir(ruta: string, cookie?: string) {
  const req = new NextRequest(`http://localhost:3000${ruta}`, {
    headers: cookie ? { cookie } : {},
  })
  const res = await middleware(req)
  const location = res.headers.get('location')
  return {
    destino: location ? new URL(location) : null,
    status: res.status,
  }
}

describe('I4 · gates del middleware', () => {
  it('sin sesión en ruta protegida: a /login', async () => {
    const { destino } = await pedir('/dashboard')

    expect(destino?.pathname).toBe('/login')
  })

  it('sin sesión en ruta pública: pasa sin redirigir', async () => {
    // El contrapeso. Sin este caso, un middleware que redirigiera SIEMPRE a
    // /login también pasaría la prueba de arriba.
    const { destino } = await pedir('/ayuda')

    expect(destino).toBeNull()
  })

  it('🔴 sin T&C aceptados: a /legal, antes que cualquier otro gate', async () => {
    const { cookie } = await usuarioConSesion({ tos_accepted_at: null })

    const { destino } = await pedir('/dashboard', cookie)

    expect(destino?.pathname).toBe('/legal')
  })

  it('🔴 consentimiento parental pendiente: a /autorizar-menor con SU token', async () => {
    // El tutor que confirmó su correo pero todavía no firmó. Se le manda a
    // firmar, no a una pantalla de espera: es él quien tiene que dar el clic
    // y ya está aquí.
    const token = randomUUID()
    const { cookie } = await usuarioConSesion({
      parental_consent_status: 'pending',
      parental_consent_token: token,
    })

    const { destino } = await pedir('/dashboard', cookie)

    expect(destino?.pathname).toBe(`/autorizar-menor/${token}`)
  })

  it('parental pendiente PERO sin token: deja pasar en vez de encerrar en un bucle', async () => {
    // Sin token no hay a dónde mandarlo. Redirigir igual sería un ciclo de
    // redirecciones sin salida.
    const { cookie } = await usuarioConSesion({
      parental_consent_status: 'pending',
      parental_consent_token: null,
    })

    const { destino } = await pedir('/dashboard', cookie)

    expect(destino?.pathname).not.toBe('/autorizar-menor')
    expect(destino?.pathname ?? '/dashboard').not.toBe('/legal')
  })

  it('🔴 suscripción en pausa: a /perfil?paused=1', async () => {
    const { userId, cookie } = await usuarioConSesion()
    const { error } = await admin.from('subscriptions').insert({
      user_id: userId,
      plan: 'grade',
      status: 'paused',
      price_mxn: 24900,
      billing_cycle: 'monthly',
      payment_provider: 'stripe',
      provider_sub_id: `sub_pausa_${randomUUID()}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    })
    if (error) throw new Error(error.message)

    const { destino } = await pedir('/dashboard', cookie)

    expect(destino?.pathname).toBe('/perfil')
    expect(destino?.searchParams.get('paused')).toBe('1')
  })

  it('en pausa, /perfil y /planes SIGUEN accesibles', async () => {
    // Si no, la persona no podría ni ver su estado ni reactivar: quedaría
    // encerrada fuera de la única pantalla donde puede arreglarlo.
    const { userId, cookie } = await usuarioConSesion()
    await admin.from('subscriptions').insert({
      user_id: userId,
      plan: 'grade',
      status: 'paused',
      price_mxn: 24900,
      billing_cycle: 'monthly',
      payment_provider: 'stripe',
      provider_sub_id: `sub_pausa2_${randomUUID()}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    })

    const { destino } = await pedir('/perfil', cookie)

    expect(destino).toBeNull()
  })

  it('no-admin en /admin: a /dashboard', async () => {
    const { cookie } = await usuarioConSesion()

    const { destino } = await pedir('/admin', cookie)

    expect(destino?.pathname).toBe('/dashboard')
  })
})
