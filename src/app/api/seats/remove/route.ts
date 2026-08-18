/**
 * POST /api/seats/remove
 * ----------------------
 * Da de baja un asiento adicional.
 *
 * NO reembolsa. Quita la renovacion y conserva el acceso hasta el fin
 * del periodo ya pagado — la misma regla que la cancelacion de
 * suscripcion, y por la misma razon: ese tiempo ya se cobro.
 *
 * Request body: { learnerId: string }
 * Response:     { ok: true, accessUntil: string } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/payments/stripe'
import { trackServer } from '@/lib/analytics/track-server'

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const learnerId = (body as { learnerId?: string } | null)?.learnerId
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId requerido' }, { status: 400 })
    }

    // 2. El learner es de esta cuenta. Cliente del usuario: la RLS
    //    respalda el filtro, no lo sustituye.
    const { data: learner, error: learnerError } = await supabase
      .from('learners')
      .select('id, status, is_primary, stripe_subscription_item_id')
      .eq('id', learnerId)
      .eq('account_user_id', user.id)
      .maybeSingle()

    if (learnerError) {
      console.error('[seats/remove] lectura de learner fallo:', learnerError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!learner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. 🔴 El principal no se da de baja por aqui. Bajarlo dejaria una
    //    cuenta pagando asientos con 50% de descuento sin el lugar a
    //    precio de lista que justifica ese descuento.
    if (learner.is_primary) {
      return NextResponse.json(
        { error: 'El alumno principal no se da de baja aqui. Cancela la suscripcion.' },
        { status: 400 }
      )
    }

    // 4. Solo se da de baja lo que esta activo.
    if (learner.status !== 'active') {
      return NextResponse.json(
        { error: 'Ese alumno no esta activo' },
        { status: 409 }
      )
    }

    // 5. La suscripcion del titular manda la fecha de fin de acceso.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('provider_sub_id, current_period_end')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Sin suscripcion o sin fecha no hay acceso pagado que conservar.
    const accessUntil = sub?.current_period_end ?? new Date().toISOString()

    // 6. Quitar el item de la suscripcion para que no renueve.
    //
    //    🔴 proration_behavior 'none' a proposito: NO se genera credito.
    //    El periodo ya esta pagado y el acceso se conserva hasta que
    //    termine, asi que devolver dinero seria pagar dos veces por lo
    //    mismo.
    //
    //    Sin item id —cuenta de prueba sin Stripe— se salta sin fallar.
    if (learner.stripe_subscription_item_id) {
      try {
        await stripe.subscriptionItems.del(learner.stripe_subscription_item_id, {
          proration_behavior: 'none',
        })
      } catch (stripeError) {
        console.error('[seats/remove] Stripe fallo:', stripeError)
        return NextResponse.json(
          { error: 'No pudimos dar de baja el lugar. Intenta de nuevo.' },
          { status: 500 }
        )
      }
    }

    // 7. Marcar la fila. Service role: learners no tiene politica de
    //    UPDATE para `authenticated` (migracion 036).
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error: updateError } = await admin
      .from('learners')
      .update({
        status: 'ending',
        access_until: accessUntil,
      })
      .eq('id', learnerId)

    // 8. El item ya se borro en Stripe: la fila quedo en 'active' pero
    //    sin renovacion. occupied_seats la sigue contando y el usuario
    //    no puede reactivarla porque no esta en 'ending'.
    if (updateError) {
      console.error(
        '[seats/remove] ASIENTO SIN MARCAR — item borrado en Stripe:',
        learner.stripe_subscription_item_id,
        'learner:', learnerId, updateError
      )
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    try {
      const { count: nAsientos } = await admin
        .from('learners')
        .select('id', { count: 'exact', head: true })
        .eq('account_user_id', user.id)
        .eq('status', 'active')

      await trackServer(
        'asiento_removido',
        {
          n_asientos_despues: nAsientos ?? undefined,
          // NO se reembolsa: el acceso sigue hasta el fin del periodo ya
          // pagado, misma regla que la cancelacion. Esto mide cuanto tiempo
          // pagado queda sin usar.
          dias_de_acceso_restante: diasHasta(accessUntil),
        },
        { consent: await consentimientoDe(admin, user.id), userId: user.id }
      )
    } catch (err) {
      console.error('[seats/remove] analitica fallo:', err)
    }

    return NextResponse.json({ ok: true, accessUntil })

  } catch (err) {
    console.error('[seats/remove] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** Dias enteros hasta una fecha ISO futura. Solo analitica. */
function diasHasta(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const ms = new Date(iso).getTime() - Date.now()
  return ms >= 0 ? Math.floor(ms / 86_400_000) : 0
}

async function consentimientoDe(cliente: SupabaseClient, userId: string) {
  const { data } = await cliente
    .from('users')
    .select('cookie_consent_analytics, cookie_consent_marketing')
    .eq('id', userId)
    .maybeSingle()
  return {
    analytics: data?.cookie_consent_analytics as boolean | null | undefined,
    marketing: data?.cookie_consent_marketing as boolean | null | undefined,
  }
}
