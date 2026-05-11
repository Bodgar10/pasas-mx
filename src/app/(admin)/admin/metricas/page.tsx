import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
    serviceSupabase.from('users').select('id, email, created_at, onboarding_done, education_level, grade, interests, xp_total, streak_days, last_active_at'),
    serviceSupabase.from('subscriptions').select('id, user_id, plan, status, price_mxn, current_period_end, cancelled_at, created_at'),
    serviceSupabase.from('topic_progress').select('user_id, topic_id, status, best_score, completed_at, updated_at'),
    serviceSupabase.from('progress').select('user_id, event_type, xp_earned, created_at').gte('created_at', last30d),
    serviceSupabase.from('topics').select('id, name, subject_id, grade'),
    serviceSupabase.from('subjects').select('id, name, slug'),
    serviceSupabase.from('user_subjects').select('user_id, subject_id, theme_id, plan_type, xp'),
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
