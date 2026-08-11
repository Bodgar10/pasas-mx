import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { resolveLearner } from '@/lib/learners'
import SubjectClient from './subject-client'

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string }>
  searchParams: Promise<{ a?: string }>
}) {
  const { subject: subjectSlug } = await params
  const sp = await searchParams
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
  //
  // `profile` viene de `learners` pese al nombre. Sale de resolveLearner
  // y NO de is_primary: con is_primary la pagina ignoraba el ?a= y
  // siempre pintaba el avance del alumno 1.
  const [subject, profile] = await Promise.all([
    getCachedSubject(subjectSlug),
    resolveLearner(supabase, user.id, sp),
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
          .eq('learner_id', profile?.id ?? '')
          .in('topic_id', topicIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('user_subjects')
      .select('xp')
      .eq('learner_id', profile?.id ?? '')
      .eq('subject_id', subject.id)
      .maybeSingle(),
  ])

  // `Learner` declara grade y education_level nullables; SubjectClient los
  // espera no-nulos. Se aplican los MISMOS defaults que ya tenia el caso
  // "sin profile" de antes, para no cambiar el comportamiento: la
  // nulabilidad siempre estuvo ahi, solo que el select sin tipar la
  // hacia invisible.
  const profileProps = {
    grade: profile?.grade ?? 1,
    education_level: profile?.education_level ?? 'middle_school',
  }

  return (
    <SubjectClient
      subject={subject}
      topics={topics ?? []}
      topicProgress={topicProgress ?? []}
      profile={profileProps}
      subjectXp={userSubject?.xp ?? 0}
      activeSlot={profile?.slot ?? 1}
    />
  )
}
