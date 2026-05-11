import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import TopicClient from '@/app/(protected)/guia/[subject]/[topic]/topic-client'

export default async function PersonalizedTopicPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const [{ data: subject }, { data: topicBySlug }] = await Promise.all([
    supabase.from('subjects').select('*').eq('slug', subjectSlug).single(),
    supabase.from('topics').select('id').eq('slug', topicSlug).single(),
  ])

  if (!subject || !topicBySlug) return notFound()

  const [{ data: topic }, { data: userSubject }] = await Promise.all([
    supabase.from('topics').select('*').eq('id', topicBySlug.id).eq('subject_id', subject.id).single(),
    supabase.from('user_subjects').select('theme_id').eq('user_id', user.id).eq('subject_id', subject.id).eq('plan_type', 'ai_personalized').maybeSingle(),
  ])

  if (!topic || !userSubject?.theme_id) return notFound()

  const [
    { data: personalizedSections },
    { data: quizQuestions },
    { data: initialProgressData },
    { data: readEvents },
    { data: previousAnswers },
  ] = await Promise.all([
    supabase.from('sections').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).eq('user_id', user.id).order('display_order', { ascending: true }),
    supabase.from('quiz_questions').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).order('created_at', { ascending: true }),
    supabase.from('topic_progress').select('*').eq('user_id', user.id).eq('topic_id', topic.id).maybeSingle(),
    supabase.from('progress').select('metadata').eq('user_id', user.id).eq('topic_id', topic.id).eq('event_type', 'section_read'),
    supabase.from('progress').select('question_id, metadata, attempt').eq('user_id', user.id).eq('topic_id', topic.id).eq('event_type', 'quiz_answered').order('attempt', { ascending: false }),
  ])

  const needsGeneration = (personalizedSections ?? []).length === 0

  let sections = personalizedSections ?? []
  if (!needsGeneration && sections.length === 0) {
    const { data: themedSections } = await supabase
      .from('sections').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).is('user_id', null).order('display_order', { ascending: true })
    sections = themedSections ?? []
  }

  const readSectionIds = (readEvents ?? []).map((e) => e.metadata?.section_id).filter(Boolean) as string[]

  let initialAnswers: Record<string, string> = {}
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
