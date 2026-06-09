import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'
import { renewalNoticeTemplate } from '@/lib/email/templates/renewal-notice'
import { PLAN_DISPLAY } from '@/lib/payments/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // Autenticar el cron con CRON_SECRET
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Buscar suscripciones que renuevan en 5-6 días y no han recibido aviso
    const in5Days = new Date()
    in5Days.setDate(in5Days.getDate() + 5)
    const in6Days = new Date()
    in6Days.setDate(in6Days.getDate() + 6)

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan,
        billing_cycle,
        price_mxn,
        current_period_end,
        user_id,
        users (
          full_name,
          email
        )
      `)
      .in('status', ['active', 'trialing'])
      .gte('current_period_end', in5Days.toISOString())
      .lte('current_period_end', in6Days.toISOString())
      .is('renewal_notice_sent_at', null)

    if (error) {
      console.error('[PROFECO Cron] DB error:', error)
      return Response.json({ error: 'DB error' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({ ok: true, sent: 0, message: 'No renewals in 5 days' })
    }

    let sent = 0
    const errors: string[] = []

    for (const sub of subscriptions) {
      const user = sub.users as { full_name: string; email: string } | null
      if (!user?.email) continue

      // Calcular nombre del plan para mostrar
      const planKey = sub.plan === 'grade' ? 'estandar_v2' : 'personalizado_v2'
      const cycleKey = (sub.billing_cycle ?? 'monthly') as 'mensual' | 'semestral' | 'anual'
      const planLabel = PLAN_DISPLAY[planKey].label
      const cycleLabel = cycleKey === 'mensual' ? 'Mensual' : cycleKey === 'semestral' ? 'Semestral' : 'Anual'
      const amount = Math.round(sub.price_mxn / 100)

      const renewalDate = new Date(sub.current_period_end).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      const html = renewalNoticeTemplate({
        userName: user.full_name?.split(' ')[0] ?? 'Estudiante',
        planName: `${planLabel} ${cycleLabel}`,
        amount,
        renewalDate,
        billingCycle: cycleLabel,
      })

      const result = await sendEmail({
        to: user.email,
        subject: `Tu suscripción de Pasas.mx se renueva el ${renewalDate}`,
        html,
      })

      if (result.ok) {
        // Marcar como enviado
        await supabase
          .from('subscriptions')
          .update({ renewal_notice_sent_at: new Date().toISOString() })
          .eq('id', sub.id)
        sent++
      } else {
        errors.push(`Failed for user ${sub.user_id}: ${JSON.stringify(result.error)}`)
      }
    }

    console.log(`[PROFECO Cron] Sent ${sent}/${subscriptions.length} renewal notices`)

    return Response.json({
      ok: true,
      sent,
      total: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[PROFECO Cron] Unexpected error:', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
