import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GenerandoClient from './generando-client'

export default async function GenerandoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userSubject } = await supabase
    .from('user_subjects')
    .select('subject_id, theme_id, initial_description')
    .eq('user_id', user.id)
    .eq('plan_type', 'ai_personalized')
    .order('purchased_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!userSubject) redirect('/dashboard')

  const [{ data: subject }, { data: theme }] = await Promise.all([
    supabase.from('subjects').select('id, name, slug').eq('id', userSubject.subject_id).single(),
    supabase.from('themes').select('id, name, icon').eq('id', userSubject.theme_id).single(),
  ])

  if (!subject) redirect('/dashboard')

  let weakTopicIds: string[] = []
  let weakTopicNames: string[] = []
  try {
    const parsed = JSON.parse(userSubject.initial_description ?? '{}')
    weakTopicIds = parsed.weak_topic_ids ?? []
    weakTopicNames = parsed.weak ?? []
  } catch {}

  const existingSections = weakTopicIds.length > 0
    ? await supabase
        .from('sections')
        .select('topic_id')
        .in('topic_id', weakTopicIds)
        .eq('theme_id', userSubject.theme_id)
        .eq('user_id', user.id)
    : { data: [] }

  const generatedTopicIds = new Set((existingSections.data ?? []).map(s => s.topic_id))
  const alreadyGenerated = weakTopicIds.every(id => generatedTopicIds.has(id))
  const hasAnySections = (existingSections.data ?? []).length > 0

  if ((alreadyGenerated || hasAnySections) && weakTopicIds.length > 0) {
    redirect(`/guia/personalizado/${subject.slug}`)
  }

  return (
    <GenerandoClient
      userId={user.id}
      subject={subject}
      theme={{ id: userSubject.theme_id, name: theme?.name ?? '', icon: theme?.icon ?? '✨' }}
      weakTopicIds={weakTopicIds}
      weakTopicNames={weakTopicNames}
    />
  )
}
