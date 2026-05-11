import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import MetricasClient from './metricas-client'

export default async function MetricasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const last3m = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const last6m = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: allUsers },
    { data: allSubscriptions },
    { data: topicProgressData },
    { data: progressEvents },
    { data: allTopics },
    { data: allSubjects },
    { data: userSubjects },
  ] = await Promise.all([
    supabase.from('users').select('id, created_at, onboarding_done, education_level, grade, interests, xp_total, streak_days, last_active_at'),
    supabase.from('subscriptions').select('id, user_id, plan, status, price_mxn, current_period_end, cancelled_at, created_at'),
    supabase.from('topic_progress').select('user_id, topic_id, status, best_score, completed_at, updated_at'),
    supabase.from('progress').select('user_id, event_type, xp_earned, created_at').gte('created_at', last30d),
    supabase.from('topics').select('id, name, subject_id, grade'),
    supabase.from('subjects').select('id, name, slug'),
    supabase.from('user_subjects').select('user_id, subject_id, theme_id, plan_type, xp'),
  ])

  return (
    <MetricasClient
      allUsers={allUsers ?? []}
      allSubscriptions={allSubscriptions ?? []}
      topicProgressData={topicProgressData ?? []}
      progressEvents={progressEvents ?? []}
      allTopics={allTopics ?? []}
      allSubjects={allSubjects ?? []}
      userSubjects={userSubjects ?? []}
      timestamps={{ last24h, last30d, last3m, last6m }}
    />
  )
}
