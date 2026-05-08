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

  const { data: subject } = await supabase
    .from('subjects')
    .select('*')
    .eq('slug', subjectSlug)
    .single()

  if (!subject) return notFound()

  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('slug', topicSlug)
    .eq('subject_id', subject.id)
    .single()

  if (!topic) return notFound()

  const { data: userSubject } = await supabase
    .from('user_subjects')
    .select('theme_id')
    .eq('user_id', user.id)
    .eq('subject_id', subject.id)
    .eq('plan_type', 'ai_personalized')
    .maybeSingle()

  if (!userSubject?.theme_id) return notFound()

  const { data: personalizedSections } = await supabase
    .from('sections')
    .select('*')
    .eq('topic_id', topic.id)
    .eq('theme_id', userSubject.theme_id)
    .eq('user_id', user.id)
    .order('display_order', { ascending: true })

  let sections = personalizedSections ?? []

  if (sections.length === 0) {
    const { data: themedSections } = await supabase
      .from('sections')
      .select('*')
      .eq('topic_id', topic.id)
      .eq('theme_id', userSubject.theme_id)
      .is('user_id', null)
      .order('display_order', { ascending: true })
    sections = themedSections ?? []
  }

  const { data: quizQuestions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('topic_id', topic.id)
    .eq('theme_id', userSubject.theme_id)
    .order('created_at', { ascending: true })

  const { data: initialProgressData } = await supabase
    .from('topic_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('topic_id', topic.id)
    .maybeSingle()

  const { data: readEvents } = await supabase
    .from('progress')
    .select('metadata')
    .eq('user_id', user.id)
    .eq('topic_id', topic.id)
    .eq('event_type', 'section_read')

  const readSectionIds = (readEvents ?? [])
    .map((e) => e.metadata?.section_id)
    .filter(Boolean) as string[]

  let initialAnswers: Record<string, string> = {}
  if (quizQuestions && quizQuestions.length > 0) {
    const { data: previousAnswers } = await supabase
      .from('progress')
      .select('question_id, metadata, attempt')
      .eq('user_id', user.id)
      .eq('topic_id', topic.id)
      .eq('event_type', 'quiz_answered')
      .order('attempt', { ascending: false })

    if (previousAnswers && previousAnswers.length > 0) {
      const maxAttempt = previousAnswers[0].attempt
      const latestAnswers = previousAnswers.filter((a) => a.attempt === maxAttempt)
      for (const row of latestAnswers) {
        if (row.question_id && row.metadata?.selected_answer) {
          initialAnswers[row.question_id] = row.metadata.selected_answer
        }
      }
    }
  }

  return (
    <TopicClient
      subject={{ id: subject.id, name: subject.name, slug: subject.slug }}
      topic={{
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        difficulty: topic.difficulty,
        xp_reward: topic.xp_reward,
      }}
      sections={sections}
      quizQuestions={quizQuestions ?? []}
      initialProgress={initialProgressData}
      readSectionIds={readSectionIds}
      initialAnswers={initialAnswers}
      isPersonalized={true}
    />
  )
}
