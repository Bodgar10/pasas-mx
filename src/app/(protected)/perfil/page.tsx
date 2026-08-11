import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PerfilClient from './perfil-client'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 🔴 NO se usa getAccountLearners aqui: esa funcion filtra por status
  // 'active' y aqui hacen falta TAMBIEN los 'ending', o el usuario no
  // puede reactivar un lugar que dio de baja. Se excluye solo
  // 'inactive', que son filas a medio crear sin cobro ni acceso.
  const [{ data: profile }, { data: learner }, { data: subscription }, { data: alumnos }] = await Promise.all([
    supabase.from('users').select('full_name, email').eq('id', user.id).single(),
    supabase.from('learners').select('xp_total, streak_days').eq('account_user_id', user.id).eq('is_primary', true).maybeSingle(),
    supabase.from('subscriptions').select('plan, status, current_period_end, cancelled_at, paused_until, billing_cycle').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from('learners')
      .select('id, slot, display_name, education_level, grade, is_primary, status, access_until')
      .eq('account_user_id', user.id)
      .neq('status', 'inactive')
      .order('slot', { ascending: true }),
  ])

  return (
    <PerfilClient
      profile={{
        fullName: profile?.full_name ?? '',
        email: user.email ?? '',
        xpTotal: learner?.xp_total ?? 0,
        streakDays: learner?.streak_days ?? 0,
      }}
      alumnos={alumnos ?? []}
      subscription={subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelledAt: subscription.cancelled_at,
        pausedUntil: subscription.paused_until ?? null,
        billingCycle: subscription.billing_cycle ?? null,
      } : null}
    />
  )
}
