import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { NIVEL_ONBOARDING, gradoOnboarding } from '@/lib/horda-publica'
import { tematicaPorClave, type ClaveTematica } from '@/lib/tema-muestra'

/**
 * Lecturas de la muestra del tema (s42). Service role porque `sections` y
 * `quiz_questions` solo se leen con sesión (RLS). Solo LEEN: la muestra no
 * escribe progreso, XP ni rachas.
 *
 * 🔴 Solo temas que salen en el reto (`arcade_rounds`). La muestra existe para
 * quien acaba de fallar ese tema, no para abrir el temario entero por URL.
 *
 * CACHÉ (unstable_cache, 300 s, tag 'topics'). /tema es la puerta del embudo
 * desde el arcade y hacía seis viajes en serie por visita, todos sobre datos
 * de catálogo que no dependen de quién mira. El cliente es el de abajo
 * —service role, SIN cookies—, que es lo único que se puede meter en un
 * scope de caché (unstable_cache.md: nada de cookies ni headers dentro).
 * Service role se salta la RLS: los filtros que importan (`published`, tema
 * del reto, temática activa) están escritos a mano en cada consulta.
 * El tag es el mismo que usa el catálogo de la guía: un revalidateTag('topics')
 * al publicar refresca las dos cosas.
 */
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

export type TemaMuestra = {
  subject: { id: string; name: string; slug: string }
  topic: { id: string; name: string; slug: string; difficulty: number; xp_reward: number }
  hordeReady: boolean
  /** historia, biologia… (misma regla que el reto: arcade_materia_de_slug). */
  materia: string | null
  nivel: string | null
  grado: string | null
}

async function leerTemaMuestra(subjectSlug: string, topicSlug: string): Promise<TemaMuestra | null> {
  const db = admin()
  // Tema y materia en UNA consulta: `topics.slug` es UNIQUE, así que "el tema
  // con este slug cuya materia tiene este slug" es la misma fila que antes
  // salía de dos lecturas en serie.
  const { data: fila } = await db
    .from('topics')
    .select('id, name, slug, difficulty, xp_reward, grade, published, horde_ready, subjects!inner(id, slug, name, education_level, grades)')
    .eq('slug', topicSlug)
    .eq('subjects.slug', subjectSlug)
    .maybeSingle()
  if (!fila || !fila.published) return null
  const { subjects: subjectRel, ...topic } = fila
  const subject = subjectRel as unknown as {
    id: string
    slug: string
    name: string
    education_level: string | null
    grades: number[] | null
  }

  const [{ count }, { data: materia }] = await Promise.all([
    db.from('arcade_rounds').select('id', { count: 'exact', head: true }).eq('topic_id', topic.id),
    db.rpc('arcade_materia_de_slug', { p_slug: subject.slug }),
  ])
  if (!count) return null

  return {
    subject: { id: subject.id, name: subject.name, slug: subject.slug },
    topic: {
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      difficulty: topic.difficulty ?? 1,
      xp_reward: topic.xp_reward ?? 0,
    },
    hordeReady: topic.horde_ready === true,
    materia: typeof materia === 'string' ? materia : null,
    nivel: NIVEL_ONBOARDING[subject.education_level as string] ?? null,
    grado: gradoOnboarding(topic.grade ?? subject.grades?.[0]),
  }
}

export const temaMuestraPorSlugs = unstable_cache(leerTemaMuestra, ['tema-muestra-por-slugs'], {
  revalidate: 300,
  tags: ['topics'],
})

/**
 * Secciones y quiz del tema en esa temática, con las mismas formas que lee
 * /guia/[subject]/[topic]/page.tsx. Sin la temática en la base, null.
 */
async function leerContenidoMuestra(topicId: string, clave: ClaveTematica) {
  const tematica = tematicaPorClave(clave)
  if (!tematica) return null
  const db = admin()
  const { data: theme } = await db
    .from('themes')
    .select('id, name')
    .eq('name', tematica.nombre)
    .eq('active', true)
    .maybeSingle()
  if (!theme) return null

  const [{ data: sections }, { data: quiz }] = await Promise.all([
    db
      .from('sections')
      .select('id, type, title, content, data, display_order, audio_url, audio_duration')
      .eq('topic_id', topicId)
      .eq('theme_id', theme.id)
      .is('user_id', null)
      .order('display_order', { ascending: true }),
    db
      .from('quiz_questions')
      .select('id, question, options, correct_answer, explanation, difficulty, xp_reward')
      .eq('topic_id', topicId)
      .eq('theme_id', theme.id)
      .order('created_at', { ascending: true }),
  ])

  return { themeName: theme.name as string, sections: sections ?? [], quiz: quiz ?? [] }
}

/**
 * Misma caché que temaMuestraPorSlugs. 🔴 El orden de secciones
 * (display_order) y del quiz (created_at) se resuelve en la consulta y el
 * arreglo se guarda tal cual: la caché no reordena nada.
 */
export const contenidoMuestra = unstable_cache(leerContenidoMuestra, ['tema-muestra-contenido'], {
  revalidate: 300,
  tags: ['topics'],
})
