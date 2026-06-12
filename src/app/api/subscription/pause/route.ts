import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import { sendEmail } from '@/lib/email/resend'
import { pauseConfirmedTemplate } from '@/lib/email/templates/pause-confirmed'

const MAX_PAUSES_PER_YEAR = 2
const MAX_PAUSE_MONTHS = 3

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const months = Math.min(Math.max(1, parseInt(body.months ?? 1)), MAX_PAUSE_MONTHS)

    // Buscar suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id, status, pause_count_year, pause_count_lifetime, current_period_end')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
    }

    // Anti-abuso: máximo 2 pausas por año académico
    if ((subscription.pause_count_year ?? 0) >= MAX_PAUSES_PER_YEAR) {
      return NextResponse.json({
        error: 'Ya usaste tus 2 pausas de este año académico'
      }, { status: 403 })
    }

    // Calcular fecha de reactivación
    const pausedUntil = new Date()
    pausedUntil.setMonth(pausedUntil.getMonth() + months)

    // Pausar en Stripe usando pause_collection
    if (subscription.provider_sub_id) {
      await stripe.subscriptions.update(subscription.provider_sub_id, {
        pause_collection: {
          behavior: 'mark_uncollectible',
          resumes_at: Math.floor(pausedUntil.getTime() / 1000),
        },
      })
    }

    // Actualizar BD
    await supabase
      .from('subscriptions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        paused_until: pausedUntil.toISOString(),
        pause_count_lifetime: (subscription.pause_count_lifetime ?? 0) + 1,
        pause_count_year: (subscription.pause_count_year ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    // Enviar email de confirmación
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (user.email) {
        const pausedUntilFormatted = pausedUntil.toLocaleDateString('es-MX', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
        await sendEmail({
          to: user.email,
          subject: 'Tu cuenta está pausada — Pasas.mx',
          html: pauseConfirmedTemplate({
            userName: userProfile?.full_name?.split(' ')[0] ?? 'Estudiante',
            pausedUntil: pausedUntilFormatted,
            months,
          }),
        })
      }
    } catch (emailErr) {
      console.error('[subscription/pause] Error sending email:', emailErr)
    }

    console.log(`[subscription/pause] Usuario ${user.id} pausó ${months} mes(es) hasta ${pausedUntil.toISOString()}`)

    return NextResponse.json({
      ok: true,
      pausedUntil: pausedUntil.toISOString(),
      message: `Tu cuenta está pausada hasta ${pausedUntil.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    })

  } catch (err) {
    console.error('[subscription/pause] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — Reactivar pausa manualmente desde /perfil
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id')
      .eq('user_id', user.id)
      .eq('status', 'paused')
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No hay pausa activa' }, { status: 404 })
    }

    // Quitar pausa en Stripe
    if (subscription.provider_sub_id) {
      await stripe.subscriptions.update(subscription.provider_sub_id, {
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
      .eq('id', subscription.id)

    console.log(`[subscription/pause] Reactivación manual para user ${user.id}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[subscription/pause] DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
