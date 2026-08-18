import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/payments/stripe'
import { trackServer } from '@/lib/analytics/track-server'
import { iniciarCorrida, cerrarCorrida, resumirFallos } from '@/lib/cron-runs'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Bitácora. DESPUÉS del 401 y ANTES de la consulta: así quedan cubiertas
  // la salida por error de BD y la de lista vacía, que es la que en s30
  // hizo imposible saber si este cron funcionaba.
  const corridaId = await iniciarCorrida(supabase, 'pauses-ending')

  try {
    // Buscar pausas que terminaron hoy o ayer (ventana de 48h para no perder ninguna)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: pausedSubs, error } = await supabase
      .from('subscriptions')
      // `paused_at`, `plan`, `billing_cycle` y los dos consentimientos: solo
      // analitica.
      .select('id, provider_sub_id, user_id, paused_at, plan, billing_cycle, users(full_name, email, cookie_consent_analytics, cookie_consent_marketing)')
      .eq('status', 'paused')
      .lte('paused_until', now.toISOString())
      .gte('paused_until', yesterday.toISOString())

    if (error) {
      console.error('[pauses-ending] DB error:', error)
      await cerrarCorrida(supabase, corridaId, { rowsProcessed: 0, error: `DB error: ${error.message}` })
      return Response.json({ error: 'DB error' }, { status: 500 })
    }

    if (!pausedSubs || pausedSubs.length === 0) {
      // 🔴 ESTE es el caso de s30: el cron corre a diario y casi siempre no
      // encuentra a nadie. Sin esta fila, "corrió y no había pausas" era
      // idéntico a "no corrió", y estuvimos semanas sin saber cuál era.
      await cerrarCorrida(supabase, corridaId, { rowsProcessed: 0 })
      return Response.json({ ok: true, reactivated: 0, message: 'No pauses ending today' })
    }

    let reactivated = 0
    const errors: string[] = []

    for (const sub of pausedSubs) {
      try {
        // Quitar pausa en Stripe + aplicar cupón de reactivación (50% off, una vez)
        if (sub.provider_sub_id) {
          const reactivationCoupon = process.env.STRIPE_COUPON_REACTIVATION_50
          await stripe.subscriptions.update(sub.provider_sub_id, {
            pause_collection: '',
            ...(reactivationCoupon ? { discounts: [{ coupon: reactivationCoupon }] } : {}),
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

        /**
         * 🔴 `via: 'cron'` y `con_cupon` segun la variable de entorno.
         *
         * Este cron reactiva a TODO el que llega al final de la pausa: la
         * persona no decide nada. Por eso no existe un "reactivo: bool" con
         * dos valores — lo que si distingue es ESTA via de la manual del
         * perfil, donde alguien vuelve por su cuenta y sin descuento.
         *
         * `con_cupon` refleja el 50% que se acaba de aplicar arriba. Si la
         * variable no esta puesta, no se aplico y aqui va false: se anuncia
         * lo que ocurrio, no lo que deberia ocurrir.
         */
        try {
          const usuario = sub.users as unknown as {
            cookie_consent_analytics?: boolean | null
            cookie_consent_marketing?: boolean | null
          } | null

          const ctx = {
            consent: {
              analytics: usuario?.cookie_consent_analytics,
              marketing: usuario?.cookie_consent_marketing,
            },
            userId: sub.user_id as string,
          }

          const conCupon = !!process.env.STRIPE_COUPON_REACTIVATION_50

          await trackServer(
            'pausa_terminada',
            {
              meses_pausados: mesesEntre(sub.paused_at as string | null),
              via: 'cron',
              con_cupon: conCupon,
              plan: sub.plan,
              ciclo: sub.billing_cycle,
              anticipada: false,
            },
            ctx
          )

          await trackServer(
            'reactivacion',
            {
              dias_inactivo: diasEntre(sub.paused_at as string | null),
              plan: sub.plan,
              con_cupon: conCupon,
              via: 'cron',
            },
            ctx
          )
        } catch (err) {
          console.error(`[pauses-ending] analitica fallo en ${sub.id}:`, err)
        }
      } catch (err) {
        console.error(`[pauses-ending] Error reactivando ${sub.id}:`, err)
        errors.push(`Sub ${sub.id}: ${String(err)}`)
      }
    }

    // Filas PROCESADAS, no reactivadas con éxito: `reactivated` es el
    // trabajo completado y va en la respuesta, no en la bitácora.
    await cerrarCorrida(supabase, corridaId, {
      rowsProcessed: pausedSubs.length,
      error: resumirFallos(errors, pausedSubs.length),
    })

    return Response.json({
      ok: true,
      reactivated,
      total: pausedSubs.length,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (err) {
    console.error('[pauses-ending] Unexpected error:', err)
    await cerrarCorrida(supabase, corridaId, {
      rowsProcessed: 0,
      error: `Excepción: ${err instanceof Error ? err.message : String(err)}`,
    })
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** Dias enteros desde una fecha ISO. Solo analitica. */
function diasEntre(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const ms = Date.now() - new Date(iso).getTime()
  return ms >= 0 ? Math.floor(ms / 86_400_000) : undefined
}

/** Meses aproximados (30 dias). Solo analitica. */
function mesesEntre(iso: string | null | undefined): number | undefined {
  const dias = diasEntre(iso)
  return dias == null ? undefined : Math.round(dias / 30)
}
