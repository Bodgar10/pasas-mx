import { describe, it, expect, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

/**
 * I5 — MATERIAS POR GRADO Y RESINCRONIZACIÓN
 *
 * 🔴 EL BUG QUE ESTO PROTEGE YA OCURRIÓ. La regla "qué materias le tocan a
 * este alumno" estaba copiada en dos endpoints y al tercero —el cambio de
 * grado— se le olvidó por completo: el alumno cambiaba de grado, conservaba
 * las materias del anterior y veía "Próximamente" en todo, con el contenido
 * existiendo.
 *
 * Ahora la regla vive en `materiasParaGrado` y la resincronización en la RPC
 * `resync_learner_grade`. Estas pruebas verifican las dos.
 *
 * Los ids del catálogo son los fijos de supabase/seed.sql:
 *   grado 1 → Matematicas Test, Espanol Test
 *   grado 2 → Historia Test
 */

const h = vi.hoisted(() => ({
  cookies: { valor: [] as { name: string; value: string }[] },
}))

// El endpoint usa `createClient()` de @/utils/supabase/server, que lee las
// cookies con `cookies()` de next/headers. Se sustituye SOLO esa API.
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => h.cookies.valor,
    set: () => {},
  }),
}))

const { POST: cambiarGrado } = await import('@/app/api/seats/change-grade/route')
const { materiasParaGrado } = await import('@/lib/learners')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MATEMATICAS = '22222222-2222-4222-8222-222222222201'
const ESPANOL = '22222222-2222-4222-8222-222222222202'
const HISTORIA = '22222222-2222-4222-8222-222222222203'
const TEMA_VIDEOJUEGOS = '11111111-1111-4111-8111-111111111101'

const creados: string[] = []

afterEach(async () => {
  for (const id of creados.splice(0)) {
    await admin.from('user_subjects').delete().eq('user_id', id)
    await admin.from('learners').delete().eq('account_user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  h.cookies.valor = []
})

/** Alumno de 1º con sus dos materias, y la sesión lista en las cookies. */
async function alumnoEnPrimero() {
  const email = `grado-${randomUUID()}@ejemplo-test.mx`
  const password = randomUUID()

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(error.message)
  const userId = data.user!.id
  creados.push(userId)

  await admin.from('users').update({ tos_accepted_at: new Date().toISOString(), onboarding_done: true }).eq('id', userId)

  const { data: learner, error: lError } = await admin
    .from('learners')
    .insert({
      account_user_id: userId,
      display_name: 'Alumno Test',
      slot: 1,
      is_primary: true,
      education_level: 'middle_school',
      grade: 1,
      theme_id: TEMA_VIDEOJUEGOS,
    })
    .select('id')
    .single()
  if (lError) throw new Error(lError.message)

  // Las materias que le tocan HOY, en 1º.
  const { error: usError } = await admin.from('user_subjects').insert(
    [MATEMATICAS, ESPANOL].map((subject_id) => ({
      user_id: userId,
      learner_id: learner.id,
      subject_id,
      theme_id: TEMA_VIDEOJUEGOS,
      plan_type: 'grade',
    }))
  )
  if (usError) throw new Error(usError.message)

  // Sesión real: las cookies las escribe @supabase/ssr.
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

  return { userId, learnerId: learner.id }
}

async function materiasDe(learnerId: string): Promise<string[]> {
  const { data } = await admin.from('user_subjects').select('subject_id').eq('learner_id', learnerId)
  return (data ?? []).map((r) => r.subject_id).sort()
}

function peticion(body: unknown) {
  return new Request('http://localhost:3000/api/seats/change-grade', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('I5 · materiasParaGrado', () => {
  it('devuelve solo las materias del nivel y grado pedidos', async () => {
    const grado1 = await materiasParaGrado(admin, 'middle_school', 1)
    const grado2 = await materiasParaGrado(admin, 'middle_school', 2)

    expect(grado1.map((m) => m.id).sort()).toEqual([MATEMATICAS, ESPANOL].sort())
    expect(grado2.map((m) => m.id)).toEqual([HISTORIA])
  })

  it('grado sin catálogo: array vacío, que NO es lo mismo que un error', async () => {
    const grado3 = await materiasParaGrado(admin, 'middle_school', 3)

    expect(grado3).toEqual([])
  })

  it('🔴 si la consulta falla, LANZA en vez de devolver [] en silencio', async () => {
    // Un `[]` por error de red es indistinguible de "este grado no tiene
    // catálogo", y quien llama toma decisiones opuestas en cada caso: una es
    // un bug de infraestructura y la otra un hueco que hay que reportar.
    // 'nivel_inventado' no existe en el enum education_level.
    await expect(materiasParaGrado(admin, 'nivel_inventado', 1)).rejects.toThrow()
  })
})

describe('I5 · change-grade', () => {
  it('🔴 al cambiar de grado, RESINCRONIZA user_subjects al catálogo nuevo', async () => {
    const { learnerId } = await alumnoEnPrimero()
    expect(await materiasDe(learnerId)).toEqual([MATEMATICAS, ESPANOL].sort())

    const res = await cambiarGrado(
      peticion({ learnerId, educationLevel: 'middle_school', grade: 2, reason: 'promocion_ciclo' })
    )

    expect(res.status).toBe(200)

    // Las de 1º se van, entra la de 2º. Sin esto el alumno vería
    // "Próximamente" en todo.
    expect(await materiasDe(learnerId)).toEqual([HISTORIA])

    const { data: learner } = await admin
      .from('learners')
      .select('grade, education_level')
      .eq('id', learnerId)
      .single()
    expect(learner!.grade).toBe(2)
    expect(learner!.education_level).toBe('middle_school')
  })

  it('mismo grado: responde sinCambio y no toca nada', async () => {
    const { learnerId } = await alumnoEnPrimero()

    const res = await cambiarGrado(
      peticion({ learnerId, educationLevel: 'middle_school', grade: 1 })
    )

    expect(await res.json()).toEqual({ ok: true, sinCambio: true })
    expect(await materiasDe(learnerId)).toEqual([MATEMATICAS, ESPANOL].sort())
  })

  it('learner de otra cuenta: 403, sin filtrar si existe', async () => {
    await alumnoEnPrimero() // deja la sesión de ESTA cuenta en las cookies
    const ajeno = randomUUID()

    const res = await cambiarGrado(
      peticion({ learnerId: ajeno, educationLevel: 'middle_school', grade: 2 })
    )

    expect(res.status).toBe(403)
  })

  it('nivel o grado inválidos: 400 antes de tocar la base', async () => {
    const { learnerId } = await alumnoEnPrimero()

    const nivelMal = await cambiarGrado(
      peticion({ learnerId, educationLevel: 'universidad', grade: 1 })
    )
    expect(nivelMal.status).toBe(400)

    const gradoMal = await cambiarGrado(
      peticion({ learnerId, educationLevel: 'middle_school', grade: 9 })
    )
    expect(gradoMal.status).toBe(400)
  })

  it('sin sesión: 401', async () => {
    h.cookies.valor = []

    const res = await cambiarGrado(
      peticion({ learnerId: randomUUID(), educationLevel: 'middle_school', grade: 2 })
    )

    expect(res.status).toBe(401)
  })
})
