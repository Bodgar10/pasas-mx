import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PerfilClient from './perfil-client'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('users').select('full_name, email, xp_total, streak_days').eq('id', user.id).single(),
    supabase.from('subscriptions').select('plan, status, current_period_end, cancelled_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  return (
    <PerfilClient
      profile={{
        fullName: profile?.full_name ?? '',
        email: user.email ?? '',
        xpTotal: profile?.xp_total ?? 0,
        streakDays: profile?.streak_days ?? 0,
      }}
      subscription={subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelledAt: subscription.cancelled_at,
      } : null}
    />
  )
}
