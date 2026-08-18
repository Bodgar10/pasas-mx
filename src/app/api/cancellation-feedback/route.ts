import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { trackServer } from '@/lib/analytics/track-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { reason_category, reason_detail, pause_offered, pause_accepted } = body

    if (!reason_category) {
      return NextResponse.json({ error: 'reason_category requerido' }, { status: 400 })
    }

    // Buscar suscripción activa del usuario
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase
      .from('cancellation_reasons')
      .insert({
        user_id: user.id,
        subscription_id: subscription?.id ?? null,
        reason_category,
        reason_detail: reason_detail ?? null,
        pause_offered: pause_offered ?? false,
        pause_accepted: pause_accepted ?? false,
      })

    if (error) {
      console.error('[cancellation-feedback] DB error:', error)
      return NextResponse.json({ error: 'Error al guardar feedback' }, { status: 500 })
    }

    /**
     * `motivo_cancelacion` desde el SERVIDOR, no solo desde el cliente.
     *
     * El cliente tambien lo emite, pero este es el que cuenta: si la fila
     * llego a `cancellation_reasons`, este evento existe. Sin el, el motivo
     * viviria solo en PostHog y no habria forma de cuadrar el tablero de
     * admin —que lee la tabla— contra el embudo.
     *
     * Va DESPUES del insert y solo si no hubo error: se anuncia lo que de
     * verdad se guardo.
     */
    try {
      const { data: consentimiento } = await supabase
        .from('users')
        .select('cookie_consent_analytics, cookie_consent_marketing')
        .eq('id', user.id)
        .maybeSingle()

      await trackServer(
        'motivo_cancelacion',
        {
          motivo: reason_category,
          texto_libre: typeof reason_detail === 'string' && reason_detail.trim().length > 0,
          pausa_ofrecida: pause_offered ?? false,
          pausa_aceptada: pause_accepted ?? false,
          origen: 'servidor',
        },
        {
          consent: {
            analytics: consentimiento?.cookie_consent_analytics,
            marketing: consentimiento?.cookie_consent_marketing,
          },
          userId: user.id,
        }
      )
    } catch (err) {
      console.error('[cancellation-feedback] analitica fallo:', err)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cancellation-feedback] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
