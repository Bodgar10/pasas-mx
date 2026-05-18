import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import TopicAdminClient from './topic-admin-client'

export default async function TopicAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string; topic: string }>
  searchParams: Promise<{ grade?: string; level?: string; themeId?: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const { grade: gradeParam, level, themeId: themeIdParam } = await searchParams
  const grade = Number(gradeParam ?? 1)

  const supabase = await createClient()

  const getCachedSubject = unstable_cache(
    async (slug: string) => {
      const { data } = await supabase.from('subjects').select('*').eq('slug', slug).single()
      return data
    },
    ['admin-subject', subjectSlug],
    { revalidate: 300, tags: ['subjects'] }
  )

  const getCachedThemes = unstable_cache(
    async () => {
      const { data } = await supabase.from('themes').select('*').eq('active', true)
      return data ?? []
    },
    ['admin-themes'],
    { revalidate: 300, tags: ['themes'] }
  )

  const [subject, themes] = await Promise.all([
    getCachedSubject(subjectSlug),
    getCachedThemes(),
  ])

  if (!subject) return notFound()

  const activeThemes = themes ?? []
  const selectedThemeId = themeIdParam ?? activeThemes[0]?.id ?? ''

  // Batch 2: topic (needs subject.id)
  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('slug', topicSlug)
    .eq('subject_id', subject.id)
    .single()

  if (!topic) return notFound()

  // Batch 3: sections + quiz + completedCount all in parallel (all need topic.id)
  const [
    { data: sections },
    { data: quizQuestions },
    { count: completedCount },
  ] = await Promise.all([
    supabase
      .from('sections')
      .select('*')
      .eq('topic_id', topic.id)
      .eq('theme_id', selectedThemeId)
      .order('display_order', { ascending: true }),
    supabase
      .from('quiz_questions')
      .select('*')
      .eq('topic_id', topic.id)
      .eq('theme_id', selectedThemeId)
      .order('created_at', { ascending: true }),
    supabase
      .from('topic_progress')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', topic.id)
      .eq('status', 'completed'),
  ])

  return (
    <TopicAdminClient
      subject={{ id: subject.id, name: subject.name, slug: subject.slug }}
      topic={{
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        difficulty: topic.difficulty,
        xp_reward: topic.xp_reward,
        published: topic.published,
      }}
      sections={sections ?? []}
      quizQuestions={quizQuestions ?? []}
      themes={activeThemes}
      selectedThemeId={selectedThemeId}
      grade={grade}
      level={level ?? ''}
      completedCount={completedCount ?? 0}
    />
  )
}
