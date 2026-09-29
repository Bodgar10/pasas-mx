import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { NIVEL_ONBOARDING, OLEADAS_GRATIS, esMateriaPublica, gradoOnboarding } from '@/lib/horda-publica'

/**
 * Lecturas de la Horda pública. Service role porque `horde_questions` no
 * tiene política para anon (migración 027): el navegador nunca ve la tabla,
 * y estas funciones jamás devuelven `correct_answer` ni preguntas de la
 * oleada 4 en adelante.
 *
 * Solo LEEN. No escriben en horde_runs, progress ni learners: la partida
 * pública vive en el navegador.
 */
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

export type TemaPublico = {
  topicId: string
  topicName: string
  topicSlug: string
  subjectSlug: string
  subjectName: string
  nivel: string | null
  grado: string | null
}

export type PreguntaPublica = {
  id: string
  wave: number
  question: string
  options: { letter: string; text: string }[]
}

/** El tema, solo si es de una materia pública, está publicado y tiene Horda. */
export async function temaPorSlugs(subjectSlug: string, topicSlug: string): Promise<TemaPublico | null> {
  if (!esMateriaPublica(subjectSlug)) return null
  const db = admin()
  const { data: subject } = await db
    .from('subjects')
    .select('id, slug, name, education_level, grades')
    .eq('slug', subjectSlug)
    .maybeSingle()
  if (!subject) return null

  const { data: topic } = await db
    .from('topics')
    .select('id, name, slug, grade, published, horde_ready')
    .eq('subject_id', subject.id)
    .eq('slug', topicSlug)
    .maybeSingle()
  if (!topic || !topic.published || !topic.horde_ready) return null

  return {
    topicId: topic.id,
    topicName: topic.name,
    topicSlug: topic.slug,
    subjectSlug: subject.slug,
    subjectName: subject.name,
    nivel: NIVEL_ONBOARDING[subject.education_level as string] ?? null,
    grado: gradoOnboarding(topic.grade ?? subject.grades?.[0]),
  }
}

/** Valida por id (lo que mandan las APIs): mismo criterio que temaPorSlugs. */
async function esTemaPublico(topicId: string): Promise<boolean> {
  const { data } = await admin()
    .from('topics')
    .select('published, horde_ready, subjects!inner(slug)')
    .eq('id', topicId)
    .maybeSingle()
  const slug = (data?.subjects as unknown as { slug: string } | null)?.slug
  return !!data && data.published && data.horde_ready && !!slug && esMateriaPublica(slug)
}

export async function preguntasDeOleada(topicId: string, wave: number): Promise<PreguntaPublica[] | null> {
  if (!Number.isInteger(wave) || wave < 1 || wave > OLEADAS_GRATIS) return null
  if (!(await esTemaPublico(topicId))) return null
  const { data } = await admin()
    .from('horde_questions')
    .select('id, wave, question, options')
    .eq('topic_id', topicId)
    .eq('wave', wave)
  return (data as PreguntaPublica[] | null) ?? null
}

export async function revisarRespuesta(
  topicId: string,
  questionId: string,
  letter: string
): Promise<{ correct: boolean; explanation: string; hint: string | null } | null> {
  if (!(await esTemaPublico(topicId))) return null
  const { data: q } = await admin()
    .from('horde_questions')
    .select('wave, correct_answer, hint, explanation')
    .eq('id', questionId)
    .eq('topic_id', topicId)
    .maybeSingle()
  // La oleada 4+ no se revisa aquí: sus preguntas nunca salen por la ruta pública.
  if (!q || q.wave > OLEADAS_GRATIS) return null
  const correct = q.correct_answer === letter
  return { correct, explanation: q.explanation, hint: correct ? null : q.hint }
}

/** Todos los temas públicos, para el sitemap. */
export async function temasPublicos(): Promise<{ subjectSlug: string; topicSlug: string }[]> {
  const { data } = await admin()
    .from('topics')
    .select('slug, published, horde_ready, subjects!inner(slug)')
    .eq('published', true)
    .eq('horde_ready', true)
  return (data ?? [])
    .map((t) => ({
      subjectSlug: (t.subjects as unknown as { slug: string }).slug,
      topicSlug: t.slug as string,
    }))
    .filter((t) => esMateriaPublica(t.subjectSlug))
}
