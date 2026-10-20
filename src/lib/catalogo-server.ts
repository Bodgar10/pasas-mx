import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

/**
 * CATÁLOGO CACHEADO — materias y temas publicados
 * ---------------------------------------------------------------------------
 * Vivían como `unstable_cache` DENTRO del componente de /dashboard y
 * /guia/[subject], cerrando sobre el cliente de Supabase ligado a las cookies
 * del request. Dos problemas:
 *
 *  1. La doc (unstable_cache.md) lo dice: "Accessing uncached data sources
 *     such as headers or cookies inside a cache scope is not supported". El
 *     resultado se guardaba con la sesión del primero que pasaba y se servía
 *     a todos los demás.
 *  2. Se recreaba la función cacheada en cada render.
 *
 * Aquí van a nivel de módulo con un cliente SIN cookies. Es service role
 * porque `subjects` y `topics` solo tienen política para `authenticated`
 * (001_initial_schema): con la publishable key y sin sesión volverían vacías.
 *
 * 🔴 service role se salta la RLS, así que el filtro que ponía la política se
 * escribe a mano: `topics: authenticated read published` → `.eq('published',
 * true)`. `subjects` no filtra nada (`using (true)`).
 *
 * Claves y tags se conservan: 'subjects' y 'topics', revalidate 300. La doc
 * de Next 16 dice que los argumentos ya forman parte de la clave; el array es
 * solo el prefijo.
 */
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

/** Materias de un nivel y grado, en orden de pantalla. Para /dashboard. */
export const materiasDeGrado = unstable_cache(
  async (educationLevel: string, grade: number) => {
    const { data } = await admin()
      .from('subjects')
      .select('id, slug, name, display_order')
      .eq('education_level', educationLevel)
      .contains('grades', [grade])
      .order('display_order')
    return data ?? []
  },
  ['catalogo-materias-de-grado'],
  { revalidate: 300, tags: ['subjects'] }
)

/** Una materia por slug, fila completa. null si no existe. Para /guia/[subject]. */
export const materiaPorSlug = unstable_cache(
  async (slug: string) => {
    const { data } = await admin().from('subjects').select('*').eq('slug', slug).maybeSingle()
    return data
  },
  ['catalogo-materia-por-slug'],
  { revalidate: 300, tags: ['subjects'] }
)

/** Temas publicados de una materia en un grado, en orden de pantalla. */
export const temasPublicadosDeMateria = unstable_cache(
  async (subjectId: string, grade: number) => {
    const { data } = await admin()
      .from('topics')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('published', true)
      .eq('grade', grade)
      .order('display_order', { ascending: true })
    return data ?? []
  },
  ['catalogo-temas-publicados'],
  { revalidate: 300, tags: ['topics'] }
)
