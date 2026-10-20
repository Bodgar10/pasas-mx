import { redirect } from 'next/navigation'
import { getRol, getUsuario } from '@/lib/auth'
import InsightsClient from './insights-client'

export default async function InsightsPage() {
  // Mismo usuario y mismo rol que ya resolvió (admin)/layout.tsx en este
  // request: React cache() los devuelve sin repetir las consultas.
  const { supabase, user } = await getUsuario()
  if (!user) redirect('/login')

  if ((await getRol(user.id)) !== 'admin') redirect('/dashboard')

  // Cancelaciones con datos del usuario y suscripción
  const { data: cancellations } = await supabase
    .from('cancellation_reasons')
    .select(`
      id,
      reason_category,
      reason_detail,
      pause_offered,
      pause_accepted,
      created_at,
      users (full_name, email),
      subscriptions (plan, billing_cycle)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  // Pausas activas e históricas
  const { data: pauses } = await supabase
    .from('subscriptions')
    .select(`
      id,
      plan,
      billing_cycle,
      paused_at,
      paused_until,
      pause_count_lifetime,
      status,
      users (full_name, email)
    `)
    .not('paused_at', 'is', null)
    .order('paused_at', { ascending: false })
    .limit(100)

  return (
    <InsightsClient
      cancellations={(cancellations ?? []) as never}
      pauses={(pauses ?? []) as never}
    />
  )
}
