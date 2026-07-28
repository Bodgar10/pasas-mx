import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import TopicClient from './topic-client'

export default async function TopicPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: subject }, { data: topicBySlug }] = await Promise.all([
    supabase.from('subjects').select('*').eq('slug', subjectSlug).single(),
    supabase.from('topics').select('id').eq('slug', topicSlug).single(),
  ])

  if (!subject || !topicBySlug) return notFound()

  const [{ data: topic }, { data: userSubject }] = await Promise.all([
    supabase.from('topics').select('*').eq('id', topicBySlug.id).eq('subject_id', subject.id).single(),
    supabase.from('user_subjects').select('theme_id').eq('user_id', user?.id ?? '').eq('subject_id', subject.id).maybeSingle(),
  ])

  if (!topic) return notFound()

  const [
    { data: themedSections },
    { data: quizQuestions },
    { data: initialProgressData },
    { data: readEvents },
    { data: previousAnswers },
    { data: hordeRun },
  ] = await Promise.all([
    userSubject?.theme_id
      ? supabase.from('sections').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject.theme_id).is('user_id', null).order('display_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('quiz_questions').select('*').eq('topic_id', topic.id).eq('theme_id', userSubject?.theme_id ?? '').order('created_at', { ascending: true }),
    user ? supabase.from('topic_progress').select('*').eq('user_id', user.id).eq('topic_id', topic.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from('progress').select('metadata').eq('user_id', user.id).eq('topic_id', topic.id).eq('event_type', 'section_read') : Promise.resolve({ data: [] }),
    user ? supabase.from('progress').select('question_id, metadata, attempt').eq('user_id', user.id).eq('topic_id', topic.id).eq('event_type', 'quiz_answered').order('attempt', { ascending: false }) : Promise.resolve({ data: [] }),
    user ? supabase.from('horde_runs').select('best_wave, attempts').eq('user_id', user.id).eq('topic_id', topic.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  let sections = themedSections ?? []
  if (sections.length === 0) {
    const { data: baseSections } = await supabase
      .from('sections').select('*').eq('topic_id', topic.id).is('theme_id', null).is('user_id', null).order('display_order', { ascending: true })
    sections = baseSections ?? []
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
      initialProgress={initialProgressData ?? null}
      readSectionIds={readSectionIds}
      initialAnswers={initialAnswers}
      hordeHasBank={topic.horde_ready === true}
      hordeBestWave={hordeRun?.best_wave ?? 0}
      hordeAttempts={hordeRun?.attempts ?? 0}
    />
  )
}
