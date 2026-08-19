import { describe, it, expect, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * REGISTRO — LA RAMA "CORREO POR CONFIRMAR"
 *
 * 🔴 ES LA RAMA CON MÁS TRÁFICO EN PRODUCCIÓN Y HASTA HOY NO SE PODÍA
 * REPRODUCIR EN LOCAL. Con `enable_confirmations = false`, `signUp` devuelve
 * la sesión al instante y `registroAction` toma siempre el camino contrario.
 *
 * Es también la rama que escribe `pending_checkout` —el puente que lleva el
 * plan y el slug de campaña a través del correo— y la que crea el alumno
 * primario. Las dos cosas se rompieron esta semana por el otro lado del
 * mismo flujo.
 *
 * ── LOS CORREOS NO SALEN A NINGÚN BUZÓN ────────────────────────────────
 * Mailpit los captura todos en 127.0.0.1:54324 y los expone por API REST.
 * Esta prueba lee el correo de ahí para comprobar que se mandó de verdad.
 */

const h = vi.hoisted(() => ({
  cookies: { almacen: new Map<string, string>() },
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '187.190.1.1' }),
  cookies: async () => ({
    getAll: () => [...h.cookies.almacen].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => h.cookies.almacen.set(name, value),
  }),
}))

const { registroAction } = await import('@/app/(auth)/registro/actions')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MAILPIT = 'http://127.0.0.1:54324'
const correosCreados: string[] = []

afterEach(async () => {
  for (const email of correosCreados.splice(0)) {
    const { data } = await admin.from('users').select('id').eq('email', email).maybeSingle()
    if (data?.id) {
      await admin.from('user_subjects').delete().eq('user_id', data.id)
      await admin.from('learners').delete().eq('account_user_id', data.id)
      await admin.auth.admin.deleteUser(data.id)
    }
  }
  h.cookies.almacen.clear()
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => {})
})

/** Fecha de nacimiento de alguien que hoy tiene esa edad. */
function nacidoHace(anios: number): string {
  const hoy = new Date()
  const d = new Date(hoy.getFullYear() - anios, hoy.getMonth(), hoy.getDate())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formularioRegistro(email: string, extra: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('email', email)
  fd.set('password', randomUUID())
  fd.set('full_name', 'Persona de Prueba')
  fd.set('birthdate', nacidoHace(35))
  fd.set('tos_accepted', 'on')
  fd.set('registrante', 'alumno')
  fd.set('onboarding_data', JSON.stringify({ level: 'Secundaria', grade: '1°', theme: 'Videojuegos Test' }))
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

async function correosPara(email: string) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
  const json = (await res.json()) as { messages: { Subject: string; To: { Address: string }[] }[] }
  return json.messages ?? []
}

describe('registro · rama "correo por confirmar"', () => {
  it('🔴 con plan pendiente: guarda pending_checkout con plan, ciclo Y slug de campaña', async () => {
    // El enlace del correo abre OTRA pestaña, y sessionStorage es por pestaña:
    // la base es el único sitio donde el slug sobrevive al salto. Si se
    // pierde, la persona vuelve del correo y se le cobra precio de lista con
    // un "Add promotion code" vacío al lado.
    const email = `registro-${randomUUID()}@ejemplo-test.mx`
    correosCreados.push(email)

    const estado = await registroAction(null, formularioRegistro(email, {
      pending_plan: 'estandar_v2',
      pending_duration: 'semestral',
      promo_slug: '  PASAS1  ',
    }))

    expect(estado).toEqual({ emailSent: true, email })

    const { data: fila } = await admin
      .from('users')
      .select('pending_checkout, onboarding_done, education_level, grade')
      .eq('email', email)
      .single()

    expect(fila!.pending_checkout).toMatchObject({
      plan: 'estandar_v2',
      duration: 'semestral',
      // Normalizado igual que en PromoPersistence: es la PK de promo_campaigns.
      promo_slug: 'pasas1',
    })
  })

  it('🔴 onboarding_done queda en TRUE en el propio registro, no esperando al callback', async () => {
    // El callback tiene varias salidas antes de escribir el flag —redirige a
    // /autorizar-menor, o el enlace se consume por el prefetch del cliente de
    // correo—. Cualquiera dejaba el flag en false para siempre con los datos
    // ya guardados, y el usuario entraba en un ciclo /onboarding ↔ /dashboard
    // del que no salía ni pagando.
    const email = `registro-${randomUUID()}@ejemplo-test.mx`
    correosCreados.push(email)

    await registroAction(null, formularioRegistro(email))

    const { data: fila } = await admin
      .from('users')
      .select('onboarding_done, education_level, grade, tos_accepted_at, tos_accepted_ip')
      .eq('email', email)
      .single()

    expect(fila!.onboarding_done).toBe(true)
    expect(fila!.education_level).toBe('middle_school')
    expect(fila!.grade).toBe(1)
    // La constancia legal, con la IP que calculó el servidor.
    expect(fila!.tos_accepted_at).not.toBeNull()
    expect(fila!.tos_accepted_ip).toBe('187.190.1.1')
  })

  it('🔴 el alumno primario nace AQUÍ, no en el callback', async () => {
    const email = `registro-${randomUUID()}@ejemplo-test.mx`
    correosCreados.push(email)

    await registroAction(null, formularioRegistro(email))

    const { data: user } = await admin.from('users').select('id').eq('email', email).single()
    const { data: learners } = await admin
      .from('learners')
      .select('slot, is_primary, education_level, grade, display_name')
      .eq('account_user_id', user!.id)

    expect(learners).toHaveLength(1)
    expect(learners![0]).toMatchObject({
      slot: 1,
      is_primary: true,
      education_level: 'middle_school',
      grade: 1,
      display_name: 'Persona de Prueba',
    })
  })

  it('el correo de confirmación se manda de verdad (capturado por Mailpit)', async () => {
    const email = `registro-${randomUUID()}@ejemplo-test.mx`
    correosCreados.push(email)

    await registroAction(null, formularioRegistro(email))

    const mensajes = await correosPara(email)
    expect(mensajes.length).toBeGreaterThan(0)
    expect(mensajes[0].To.map((t) => t.Address)).toContain(email)
  })

  it('sin plan pendiente: pending_checkout queda NULL, no un objeto vacío', async () => {
    const email = `registro-${randomUUID()}@ejemplo-test.mx`
    correosCreados.push(email)

    await registroAction(null, formularioRegistro(email))

    const { data: fila } = await admin
      .from('users')
      .select('pending_checkout')
      .eq('email', email)
      .single()

    expect(fila!.pending_checkout).toBeNull()
  })

  it('menor que dice ser el alumno: se rechaza ANTES de crear la cuenta', async () => {
    // parseConsent corre antes del signUp, así que un error aquí significa
    // que no queda una fila huérfana en auth.users.
    const email = `menor-rechazo-${randomUUID()}@ejemplo-test.mx`

    const estado = await registroAction(null, formularioRegistro(email, {
      birthdate: nacidoHace(15),
      registrante: 'alumno',
    }))

    expect(estado).toHaveProperty('error')
    const { data: fila } = await admin.from('users').select('id').eq('email', email).maybeSingle()
    expect(fila).toBeNull()
  })
})
