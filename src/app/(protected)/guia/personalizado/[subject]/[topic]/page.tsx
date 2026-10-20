import { notFound } from 'next/navigation'
import { getUsuario } from '@/lib/auth'
import TopicClient from '@/app/(protected)/guia/[subject]/[topic]/topic-client'

/** Mismo tope y mismo motivo que en /guia/[subject]/[topic]/page.tsx. */
const TOPE_RESPUESTAS_PREVIAS = 200

export default async function PersonalizedTopicPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const { supabase, user } = await getUsuario()
  if (!user) return notFound()

  // Tema + materia en UNA consulta (`subjects!inner`; `topics.slug` es
  // UNIQUE) y, en paralelo, la materia contratada filtrada por el slug de la
  // materia en vez de por su id: la misma fila, sin esperar a la materia.
  const [{ data: topicConMateria }, { data: userSubject }] = await Promise.all([
    supabase
      .from('topics')
      .select('*, subjects!inner(id, name, slug)')
      .eq('slug', topicSlug)
      .eq('subjects.slug', subjectSlug)
      .maybeSingle(),
    supabase
      .from('user_subjects')
      .select('theme_id, subjects!inner(slug)')
      .eq('user_id', user.id)
      .eq('subjects.slug', subjectSlug)
      .eq('plan_type', 'ai_personalized')
      .maybeSingle(),
  ])

  if (!topicConMateria || !userSubject?.theme_id) return notFound()
  const { subjects: subjectRel, ...topic } = topicConMateria
  const subject = subjectRel as unknown as { id: string; name: string; slug: string }

  const [
    { data: personalizedSections },
    { data: quizQuestions },
    { data: initialProgressData },
    { data: readEvents },
    { data: previousAnswers },
  ] = await Promise.all([
    supabase.from('sections').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).eq('user_id', user.id).order('display_order', { ascending: true }),
    supabase.from('quiz_questions').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).order('created_at', { ascending: true }).order('id', { ascending: true }),
    supabase.from('topic_progress').select('*').eq('user_id', user.id).eq('topic_id', topic.id).maybeSingle(),
    supabase.from('progress').select('metadata').eq('user_id', user.id).eq('topic_id', topic.id).eq('event_type', 'section_read'),
    supabase.from('progress').select('question_id, metadata, attempt').eq('user_id', user.id).eq('topic_id', topic.id).eq('event_type', 'quiz_answered').order('attempt', { ascending: false }).limit(TOPE_RESPUESTAS_PREVIAS),
  ])

  const needsGeneration = (personalizedSections ?? []).length === 0

  let sections = personalizedSections ?? []
  if (!needsGeneration && sections.length === 0) {
    const { data: themedSections } = await supabase
      .from('sections').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).is('user_id', null).order('display_order', { ascending: true })
    sections = themedSections ?? []
  }

  const readSectionIds = (readEvents ?? []).map((e) => e.metadata?.section_id).filter(Boolean) as string[]

  const initialAnswers: Record<string, string> = {}
  if (previousAnswers && previousAnswers.length > 0) {
    const maxAttempt = previousAnswers[0].attempt
    const latestAnswers = previousAnswers.filter((a) => a.attempt === maxAttempt)
    for (const row of latestAnswers) {
      if (row.question_id && row.metadata?.selected_answer) {
        initialAnswers[row.question_id] = row.metadata.selected_answer
      }
    }
  }

  return (
    <TopicClient
      subject={{ id: subject.id, name: subject.name, slug: subject.slug }}
      topic={{ id: topic.id, name: topic.name, slug: topic.slug, difficulty: topic.difficulty, xp_reward: topic.xp_reward }}
      sections={sections}
      quizQuestions={quizQuestions ?? []}
      initialProgress={initialProgressData}
      readSectionIds={readSectionIds}
      initialAnswers={initialAnswers}
      isPersonalized={true}
      needsGeneration={needsGeneration}
      generationData={needsGeneration ? {
        userId: user.id,
        subjectId: subject.id,
        themeId: userSubject.theme_id,
        topicId: topic.id,
        weakTopicIds: [topic.id],
      } : undefined}
    />
  )
}
