import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import PersonalizedSubjectClient from './personalized-subject-client'

export default async function PersonalizedSubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>
}) {
  const { subject: subjectSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const [{ data: subject }, { data: profile }] = await Promise.all([
    supabase.from('subjects').select('*').eq('slug', subjectSlug).single(),
    supabase.from('users').select('grade, education_level, interests').eq('id', user.id).single(),
  ])

  if (!subject) return notFound()

  const { data: userSubject } = await supabase
    .from('user_subjects')
    .select('xp, theme_id, initial_description')
    .eq('user_id', user.id)
    .eq('subject_id', subject.id)
    .maybeSingle()

  let weakTopicIds: string[] = []
  let strongTopicNames: string[] = []
  try {
    const parsed = JSON.parse(userSubject?.initial_description ?? '{}')
    weakTopicIds = parsed.weak_topic_ids ?? []
    strongTopicNames = parsed.strong ?? []
  } catch {}

  const [{ data: weakTopics }, { data: allTopics }] = await Promise.all([
    weakTopicIds.length
      ? supabase
          .from('topics')
          .select('id, name, slug, icon, difficulty, xp_reward')
          .in('id', weakTopicIds)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', subject.id)
      .eq('published', true)
      .eq('grade', profile?.grade)
      .order('display_order', { ascending: true }),
  ])

  const weakTopicIdSet = new Set(weakTopicIds)
  const strongTopics = (allTopics ?? []).filter(t => !weakTopicIdSet.has(t.id))

  const topicIds = (weakTopics ?? []).map(t => t.id)
  const { data: topicProgress } = await supabase
    .from('topic_progress')
    .select('topic_id, status, best_score')
    .eq('user_id', user.id)
    .in('topic_id', topicIds.length ? topicIds : ['00000000-0000-0000-0000-000000000000'])

  const themeName = (profile?.interests as string[] | null)?.[0] ?? 'tu temática'

  return (
    <PersonalizedSubjectClient
      subject={subject}
      weakTopics={weakTopics ?? []}
      strongTopics={strongTopics}
      topicProgress={topicProgress ?? []}
      subjectXp={userSubject?.xp ?? 0}
      themeName={themeName}
    />
  )
}
