import { notFound } from 'next/navigation'
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

  // Batch 1: subject + profile in parallel
  const [{ data: subject }, { data: profile }] = await Promise.all([
    supabase.from('subjects').select('*').eq('slug', subjectSlug).single(),
    supabase
      .from('users')
      .select('grade, education_level')
      .eq('id', user.id)
      .single(),
  ])

  if (!subject) return notFound()

  // Batch 2: topics (needs subject.id + profile.grade)
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subject.id)
    .eq('published', true)
    .eq('grade', profile?.grade)
    .order('display_order', { ascending: true })

  // Batch 3: topicProgress (needs topic ids)
  const topicIds = (topics ?? []).map((t) => t.id)
  const { data: topicProgress } = topicIds.length
    ? await supabase
        .from('topic_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('topic_id', topicIds)
    : { data: [] }

  return (
    <SubjectClient
      subject={subject}
      topics={topics ?? []}
      topicProgress={topicProgress ?? []}
      profile={profile ?? { grade: 1, education_level: 'middle_school' }}
    />
  )
}
