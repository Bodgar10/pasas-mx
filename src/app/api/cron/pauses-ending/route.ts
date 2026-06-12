import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/payments/stripe'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Buscar pausas que terminaron hoy o ayer (ventana de 48h para no perder ninguna)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: pausedSubs, error } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id, user_id, users(full_name, email)')
      .eq('status', 'paused')
      .lte('paused_until', now.toISOString())
      .gte('paused_until', yesterday.toISOString())

    if (error) {
      console.error('[pauses-ending] DB error:', error)
      return Response.json({ error: 'DB error' }, { status: 500 })
    }

    if (!pausedSubs || pausedSubs.length === 0) {
      return Response.json({ ok: true, reactivated: 0, message: 'No pauses ending today' })
    }

    let reactivated = 0
    const errors: string[] = []

    for (const sub of pausedSubs) {
      try {
        // Quitar pausa en Stripe — Stripe reactiva automáticamente
        if (sub.provider_sub_id) {
          await stripe.subscriptions.update(sub.provider_sub_id, {
            pause_collection: '',
          } as any)
        }

        // Actualizar BD
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            paused_at: null,
            paused_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id)

        reactivated++
        console.log(`[pauses-ending] Reactivada suscripción ${sub.id} para user ${sub.user_id}`)
      } catch (err) {
        console.error(`[pauses-ending] Error reactivando ${sub.id}:`, err)
        errors.push(`Sub ${sub.id}: ${String(err)}`)
      }
    }

    return Response.json({
      ok: true,
      reactivated,
      total: pausedSubs.length,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (err) {
    console.error('[pauses-ending] Unexpected error:', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
