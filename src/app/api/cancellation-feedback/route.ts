import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cancellation-feedback] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
