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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // First get user's theme for this subject
  const { data: userSubject } = await supabase
    .from('user_subjects')
    .select('theme_id')
    .eq('user_id', user?.id ?? '')
    .eq('subject_id', subject.id)
    .single()

  // Fetch sections for user's theme, fallback to base content
  let sections = null

  if (userSubject?.theme_id) {
    const { data: themedSections } = await supabase
      .from('sections')
      .select('*')
      .eq('topic_id', topic.id)
      .eq('theme_id', userSubject.theme_id)
      .is('user_id', null)
      .order('display_order', { ascending: true })

    sections = themedSections
  }

  // Fallback to base content if no themed sections exist
  if (!sections || sections.length === 0) {
    const { data: baseSections } = await supabase
      .from('sections')
      .select('*')
      .eq('topic_id', topic.id)
      .is('theme_id', null)
      .is('user_id', null)
      .order('display_order', { ascending: true })

    sections = baseSections
  }

  const { data: quizQuestions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('topic_id', topic.id)
    .eq('theme_id', userSubject?.theme_id)
    .order('created_at', { ascending: true })

  let initialProgress = null
  let readSectionIds: string[] = []

  if (user) {
    const { data } = await supabase
      .from('topic_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('topic_id', topic.id)
      .maybeSingle()
    initialProgress = data

    const { data: readEvents } = await supabase
      .from('progress')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('topic_id', topic.id)
      .eq('event_type', 'section_read')

    readSectionIds = (readEvents ?? [])
      .map((e) => e.metadata?.section_id)
      .filter(Boolean) as string[]
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
      sections={sections ?? []}
      quizQuestions={quizQuestions ?? []}
      initialProgress={initialProgress}
      readSectionIds={readSectionIds}
    />
  )
}
