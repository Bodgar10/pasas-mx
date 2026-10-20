import { notFound } from 'next/navigation'
import { getUsuario } from '@/lib/auth'
import { resolveLearner } from '@/lib/learners'
import { materiaPorSlug, temasPublicadosDeMateria } from '@/lib/catalogo-server'
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
  const { supabase, user } = await getUsuario()
  if (!user) return notFound()

  // Fetch subject + profile in parallel, subject is cached
  // (lib/catalogo-server: caché a nivel de módulo y SIN cookies)
  //
  // `profile` viene de `learners` pese al nombre. Sale de resolveLearner
  // y NO de is_primary: con is_primary la pagina ignoraba el ?a= y
  // siempre pintaba el avance del alumno 1.
  const [subject, profile] = await Promise.all([
    materiaPorSlug(subjectSlug),
    resolveLearner(supabase, user.id, sp),
  ])

  if (!subject) return notFound()

  // Cache topics — published topics change only when admin publishes
  const topics = await temasPublicadosDeMateria(subject.id, profile?.grade ?? 1)

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
