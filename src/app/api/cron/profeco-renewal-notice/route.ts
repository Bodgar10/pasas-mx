import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'
import { renewalNoticeTemplate } from '@/lib/email/templates/renewal-notice'
import { PLAN_DISPLAY, CICLO_LABEL } from '@/lib/payments/config'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // Autenticar el cron con CRON_SECRET
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    /**
     * Ventana de 8-9 días NATURALES.
     *
     * Los T&C piden 5 días hábiles. Contar hábiles de verdad obligaría a
     * mantener el calendario de festivos oficiales mexicanos y actualizarlo
     * cada año. Ocho naturales contienen 5 hábiles en cualquier posición de
     * la semana, así que se cumple el contrato sin calendario que mantener.
     *
     * ⚠️ La excepción son los ~8 festivos oficiales al año: si uno cae
     * dentro de la ventana, quedan 4 hábiles. Se asume a sabiendas — el
     * incumplimiento sería de un día y en fechas contadas. Si algún día
     * deja de ser aceptable, la solución es el calendario de festivos.
     *
     * 🔴 NO bajar de 8: con 7 naturales, un aviso de jueves solo deja
     * 4 hábiles antes del cobro.
     *
     * La ventana es de UN día de ancho (8 a 9) porque el cron corre a diario
     * y así cada suscripción cae exactamente una vez. El filtro
     * renewal_notice_sent_at cubre el resto.
     */
    const in5Days = new Date()
    in5Days.setDate(in5Days.getDate() + 8)
    const in6Days = new Date()
    in6Days.setDate(in6Days.getDate() + 9)

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
      const user = (Array.isArray(sub.users) ? sub.users[0] : sub.users) as { full_name: string; email: string } | null
      if (!user?.email) continue

      // Calcular nombre del plan para mostrar
      const planKey = sub.plan === 'grade' ? 'estandar_v2' : 'personalizado_v2'
      // 🔴 Las claves son los valores REALES de la base ('monthly' | ...).
      // El casteo original los comparaba contra los nombres en español, así que
      // 'monthly' caía al else y el aviso decía "Anual" a un cliente mensual.
      // El mapa vive en @/lib/payments/config: no volver a copiarlo aquí.
      const planLabel = PLAN_DISPLAY[planKey].label
      const cycleLabel = CICLO_LABEL[sub.billing_cycle ?? 'monthly'] ?? 'Mensual'
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
