import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardClient from './dashboard-client'

export type SubscriptionStatus = 'no_subscription' | 'expired' | 'active'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('name, xp_total, streak_days, education_level, grade, onboarding_done')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_done) redirect('/onboarding')

  // Fetch active subscription
  const now = new Date().toISOString()
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, plan')
    .eq('user_id', user.id)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Determine subscription status
  let subscriptionStatus: SubscriptionStatus = 'no_subscription'
  if (subscription) {
    const isActive = new Date(subscription.current_period_end) > new Date(now)
    subscriptionStatus = isActive ? 'active' : 'expired'
  }

  // Check if there's any past subscription (for expired state)
  let hasEverSubscribed = false
  if (subscriptionStatus === 'no_subscription') {
    const { data: pastSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    hasEverSubscribed = !!pastSub
    if (hasEverSubscribed) subscriptionStatus = 'expired'
  }

  // Fetch subjects for this user's education level and grade
  const { data: subjects } = await supabase
    .from('subjects')
    .select('slug, name, display_order')
    .eq('education_level', profile.education_level)
    .contains('grades', [profile.grade])
    .order('display_order')

  // Fetch user's subject progress
  const { data: userSubjects } = await supabase
    .from('user_subjects')
    .select('subject_id, xp, theme_id')
    .eq('user_id', user.id)

  return (
    <DashboardClient
      profile={{
        name: profile.name ?? user.email?.split('@')[0] ?? 'Estudiante',
        xp_total: profile.xp_total ?? 0,
        streak_days: profile.streak_days ?? 0,
        education_level: profile.education_level,
        grade: profile.grade,
      }}
      subscriptionStatus={subscriptionStatus}
      subjects={subjects ?? []}
      userSubjects={userSubjects ?? []}
    />
  )
}
