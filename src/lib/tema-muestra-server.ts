import 'server-only'

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

export async function temaMuestraPorSlugs(subjectSlug: string, topicSlug: string): Promise<TemaMuestra | null> {
  const db = admin()
  const { data: subject } = await db
    .from('subjects')
    .select('id, slug, name, education_level, grades')
    .eq('slug', subjectSlug)
    .maybeSingle()
  if (!subject) return null

  const { data: topic } = await db
    .from('topics')
    .select('id, name, slug, difficulty, xp_reward, grade, published, horde_ready')
    .eq('subject_id', subject.id)
    .eq('slug', topicSlug)
    .maybeSingle()
  if (!topic || !topic.published) return null

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

/**
 * Secciones y quiz del tema en esa temática, con las mismas formas que lee
 * /guia/[subject]/[topic]/page.tsx. Sin la temática en la base, null.
 */
export async function contenidoMuestra(topicId: string, clave: ClaveTematica) {
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
