import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import { sendEmail } from '@/lib/email/resend'
import { cancellationConfirmedTemplate } from '@/lib/email/templates/cancellation-confirmed'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Buscar suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, provider_sub_id, current_period_end')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
    }

    // Si tiene suscripción real en Stripe, cancelar ahí
    if (subscription.provider_sub_id) {
      await stripe.subscriptions.update(subscription.provider_sub_id, {
        cancel_at_period_end: true,
      })
    }

    // Siempre actualizar BD (cubre cuentas de prueba sin Stripe)
    await supabase
      .from('subscriptions')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', subscription.id)

    // ⚠️ Si algun dia se agrega un endpoint para revertir la cancelacion
    // dentro del periodo, tiene que devolver estos asientos a 'active'
    // con access_until en null. Hoy no existe: el flujo manda a /planes.
    //
    // Los asientos adicionales pasan a 'ending' con la misma fecha de
    // acceso que el titular: mueren cuando muere la suscripcion.
    //
    // Sin esto quedaban en 'active' para siempre y occupied_seats los
    // seguia contando, dejando la cuenta bloqueada en el tope de 3
    // aunque ya no hubiera nada activo.
    //
    // El primario NO se toca: su acceso lo gobierna la suscripcion.
    //
    // Service role a proposito: learners no tiene politica de UPDATE
    // para authenticated (migracion 036). Este archivo escribe
    // `subscriptions` con el cliente del usuario porque esa tabla si la
    // tiene; learners no puede copiar ese patron.
    if (subscription.current_period_end) {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { error: asientosError } = await admin
        .from('learners')
        .update({
          status: 'ending',
          access_until: subscription.current_period_end,
        })
        .eq('account_user_id', user.id)
        .eq('is_primary', false)
        .eq('status', 'active')

      if (asientosError) {
        console.error('[subscription/cancel] no se marcaron los asientos:', asientosError)
      }
    }

    // Enviar email de confirmación de cancelación
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const userEmail = user.email
      if (userEmail) {
        const accessUntil = subscription.current_period_end
          ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric',
            })
          : 'el fin del período actual'

        await sendEmail({
          to: userEmail,
          subject: 'Cancelación confirmada — Pasas.mx',
          html: cancellationConfirmedTemplate({
            userName: userProfile?.full_name?.split(' ')[0] ?? 'Estudiante',
            accessUntil,
          }),
        })
      }
    } catch (emailErr) {
      console.error('[subscription/cancel] Error sending email:', emailErr)
    }

    console.log(`[subscription/cancel] Cancelación programada para user ${user.id}`)

    return NextResponse.json({
      ok: true,
      message: 'Tu suscripción se cancelará al final del período actual. Conservas acceso hasta entonces.',
    })

  } catch (err) {
    console.error('[subscription/cancel] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
