import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardClient from './dashboard-client'

export type SubscriptionStatus = 'no_subscription' | 'expired' | 'active'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile and active subscription in parallel — both only need user.id
  const now = new Date().toISOString()
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, xp_total, streak_days, education_level, grade, onboarding_done, interests')
      .eq('id', user.id)
      .single(),
    supabase
      .from('subscriptions')
      .select('status, current_period_end, plan')
      .eq('user_id', user.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!profile?.onboarding_done) redirect('/onboarding')

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

  // Fetch subjects + userSubjects + lastActiveTopic all in parallel
  const [
    { data: subjects },
    { data: userSubjects },
    { data: lastActiveRows },
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, slug, name, display_order')
      .eq('education_level', profile.education_level)
      .contains('grades', [profile.grade])
      .order('display_order'),
    supabase
      .from('user_subjects')
      .select('subject_id, xp, theme_id')
      .eq('user_id', user.id),
    supabase.rpc('get_last_active_topic', { p_user_id: user.id }),
  ])

  const lastActiveRow = lastActiveRows?.[0] ?? null
  const lastActiveTopic: {
    topicName: string
    topicSlug: string
    subjectName: string
    subjectSlug: string
  } | null = lastActiveRow
    ? {
        topicName: lastActiveRow.topic_name,
        topicSlug: lastActiveRow.topic_slug,
        subjectName: lastActiveRow.subject_name,
        subjectSlug: lastActiveRow.subject_slug,
      }
    : null

  const isPersonalized = subscription?.plan === 'ai_personalized' && subscriptionStatus === 'active'

  return (
    <DashboardClient
      profile={{
        name: profile.full_name ?? user.email?.split('@')[0] ?? 'Estudiante',
        xp_total: profile.xp_total ?? 0,
        streak_days: profile.streak_days ?? 0,
        education_level: profile.education_level,
        grade: profile.grade,
        interests: (profile.interests as string[] | null) ?? [],
      }}
      subscriptionStatus={subscriptionStatus}
      subjects={subjects ?? []}
      userSubjects={userSubjects ?? []}
      lastActiveTopic={lastActiveTopic}
      isPersonalized={isPersonalized}
    />
  )
}
