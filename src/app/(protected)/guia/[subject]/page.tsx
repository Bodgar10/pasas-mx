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

  const { data: profile } = await supabase
    .from('users')
    .select('grade, education_level')
    .eq('id', user.id)
    .single()

  const { data: subject } = await supabase
    .from('subjects')
    .select('*')
    .eq('slug', subjectSlug)
    .single()

  if (!subject) return notFound()

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subject.id)
    .eq('published', true)
    .eq('grade', profile?.grade)
    .order('display_order', { ascending: true })

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
