import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { resolveLearner } from '@/lib/learners'
import HordaClient from './horda-client'

export const dynamic = 'force-dynamic'

export default async function HordaPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string; topic: string }>
  searchParams: Promise<{ a?: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

  // horde_runs se llavea por learner_id desde la migracion 035. Con
  // user_id, dos hermanos en el mismo tema hacen que maybeSingle LANCE.
  const learner = await resolveLearner(supabase, user.id, sp)

  const { data: subject } = await supabase
    .from('subjects')
    .select('id, slug')
    .eq('slug', subjectSlug)
    .maybeSingle()
  if (!subject) return notFound()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, name, slug, horde_ready')
    .eq('slug', topicSlug)
    .eq('subject_id', subject.id)
    .maybeSingle()

  if (!topic || !topic.horde_ready) return notFound()

  const { data: run } = learner
    ? await supabase
        .from('horde_runs')
        .select('best_wave, attempts')
        .eq('learner_id', learner.id)
        .eq('topic_id', topic.id)
        .maybeSingle()
    : { data: null }

  return (
    <HordaClient
      topicId={topic.id}
      topicName={topic.name}
      subjectSlug={subject.slug}
      topicSlug={topic.slug}
      bestWave={run?.best_wave ?? 0}
      attempts={run?.attempts ?? 0}
      activeSlot={learner?.slot ?? 1}
    />
  )
}
