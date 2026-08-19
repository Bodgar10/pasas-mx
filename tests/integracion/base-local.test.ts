import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Prueba de INFRAESTRUCTURA, no de producto.
 *
 * Comprueba que la base local responde y que el seed está cargado. No prueba
 * ninguna regla de negocio — para eso están las I1–I5, que aún no existen.
 *
 * Sirve para dos cosas: dar señal inmediata cuando alguien corre las pruebas
 * sin haber hecho `supabase start`, y ser el ancla que hace que la guarda de
 * `setup-integracion.ts` se ejecute de verdad.
 *
 * Los ids son los fijos de supabase/seed.sql.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

describe('base local', () => {
  it('responde y trae el catálogo del seed', async () => {
    const { data, error } = await admin.from('subjects').select('id, name, grades').order('name')

    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    expect(data!.map((s) => s.name)).toEqual(['Espanol Test', 'Historia Test', 'Matematicas Test'])
  })

  it('el seed reparte los subjects en dos grados, que es lo que hace probable el cambio de grado', async () => {
    const { data: grado1 } = await admin
      .from('subjects')
      .select('id')
      .eq('education_level', 'middle_school')
      .contains('grades', [1])

    const { data: grado2 } = await admin
      .from('subjects')
      .select('id')
      .eq('education_level', 'middle_school')
      .contains('grades', [2])

    expect(grado1).toHaveLength(2)
    expect(grado2).toHaveLength(1)
  })

  it('hay un topic sin publicar, para que el filtro published se pueda distinguir', async () => {
    const { data: todos } = await admin.from('topics').select('id')
    const { data: publicados } = await admin.from('topics').select('id').eq('published', true)

    expect(todos).toHaveLength(8)
    expect(publicados).toHaveLength(7)
  })

  it('preview_stats ve el contenido del seed en los dos grados', async () => {
    // Si esto devolviera ceros, /api/seats/change-grade cortaría por "hueco de
    // contenido" y la prueba de cambio de grado fallaría por falta de datos en
    // vez de por un bug. Ya pasó una vez: el seed llenaba subjects.grades pero
    // no topics.grade, que es por donde filtra esta RPC.
    const { data: g1 } = await admin.rpc('preview_stats', { p_nivel: 'middle_school', p_grado: 1 }).single()
    const { data: g2 } = await admin.rpc('preview_stats', { p_nivel: 'middle_school', p_grado: 2 }).single()

    expect(Number((g1 as { materias: number }).materias)).toBe(2)
    expect(Number((g1 as { temas: number }).temas)).toBe(5)
    expect(Number((g2 as { materias: number }).materias)).toBe(1)
    expect(Number((g2 as { temas: number }).temas)).toBe(2)
  })

  it('los themes del seed están, que es lo que necesita upsertPrimaryLearner', async () => {
    // Resuelve theme_id buscando por nombre con ilike. Sin una sola fila,
    // el learner nace sin temática y `user_subjects.theme_id` —que es NOT
    // NULL— hace fallar el insert del webhook.
    const { data, error } = await admin.from('themes').select('id, name').ilike('name', 'Videojuegos%')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe('11111111-1111-4111-8111-111111111101')
  })
})
