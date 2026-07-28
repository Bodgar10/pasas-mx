import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import HordaClient from './horda-client'

export const dynamic = 'force-dynamic'

export default async function HordaPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

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

  const { data: run } = await supabase
    .from('horde_runs')
    .select('best_wave, attempts')
    .eq('user_id', user.id)
    .eq('topic_id', topic.id)
    .maybeSingle()

  return (
    <HordaClient
      topicId={topic.id}
      topicName={topic.name}
      subjectSlug={subject.slug}
      topicSlug={topic.slug}
      bestWave={run?.best_wave ?? 0}
      attempts={run?.attempts ?? 0}
    />
  )
}
