import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import SubjectClient from './subject-client'

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>
}) {
  const { subject: subjectSlug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

  // Cache subject data — changes very rarely
  const getCachedSubject = unstable_cache(
    async (slug: string) => {
      const { data } = await supabase.from('subjects').select('*').eq('slug', slug).single()
      return data
    },
    ['subject', subjectSlug],
    { revalidate: 300, tags: ['subjects'] }
  )

  // Fetch subject + profile in parallel, subject is cached
  const [subject, { data: profile }] = await Promise.all([
    getCachedSubject(subjectSlug),
    supabase.from('users').select('grade, education_level').eq('id', user.id).single(),
  ])

  if (!subject) return notFound()

  // Cache topics — published topics change only when admin publishes
  const getCachedTopics = unstable_cache(
    async (subjectId: string, grade: number) => {
      const { data } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('published', true)
        .eq('grade', grade)
        .order('display_order', { ascending: true })
      return data ?? []
    },
    ['topics', subject.id, String(profile?.grade)],
    { revalidate: 300, tags: ['topics'] }
  )

  const topics = await getCachedTopics(subject.id, profile?.grade ?? 1)

  // Batch 3: topicProgress + userSubjectXp in parallel (both need subject.id / user.id)
  const topicIds = (topics ?? []).map((t) => t.id)
  const [
    { data: topicProgress },
    { data: userSubject },
  ] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topic_progress')
          .select('*')
          .eq('user_id', user.id)
          .in('topic_id', topicIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('user_subjects')
      .select('xp')
      .eq('user_id', user.id)
      .eq('subject_id', subject.id)
      .maybeSingle(),
  ])

  return (
    <SubjectClient
      subject={subject}
      topics={topics ?? []}
      topicProgress={topicProgress ?? []}
      profile={profile ?? { grade: 1, education_level: 'middle_school' }}
      subjectXp={userSubject?.xp ?? 0}
    />
  )
}
