import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'
import { renewalNoticeTemplate } from '@/lib/email/templates/renewal-notice'
import { PLAN_DISPLAY, CICLO_LABEL, precioAsiento, PLAN_DB_A_STRIPE, type BillingCycleDB } from '@/lib/payments/config'
import { trackServer } from '@/lib/analytics/track-server'
import { iniciarCorrida, cerrarCorrida, resumirFallos } from '@/lib/cron-runs'

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

  // Bitácora. Va DESPUÉS del 401 —un atacante no debe poder llenar la
  // tabla— y ANTES de la consulta, para que las salidas tempranas por
  // error de BD y por lista vacía queden registradas.
  const corridaId = await iniciarCorrida(supabase, 'profeco-renewal-notice')

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
    const en8Dias = new Date()
    en8Dias.setDate(en8Dias.getDate() + 8)
    const en9Dias = new Date()
    en9Dias.setDate(en9Dias.getDate() + 9)

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
          email,
          cookie_consent_analytics,
          cookie_consent_marketing
        )
      `)
      .in('status', ['active', 'trialing'])
      // Las filas de sandbox no reciben correos de la LFPC: no
      // sirven a nadie y ensucian el conteo de la bitácora.
      .eq('is_test', false)
      .gte('current_period_end', en8Dias.toISOString())
      .lte('current_period_end', en9Dias.toISOString())
      .is('renewal_notice_sent_at', null)

    if (error) {
      console.error('[PROFECO Cron] DB error:', error)
      await cerrarCorrida(supabase, corridaId, { rowsProcessed: 0, error: `DB error: ${error.message}` })
      return Response.json({ error: 'DB error' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      // 🔴 La fila se cierra igual con 0. Es EXACTAMENTE el caso que antes
      // no se distinguía de "el cron no corrió".
      await cerrarCorrida(supabase, corridaId, { rowsProcessed: 0 })
      return Response.json({ ok: true, sent: 0, message: 'No renewals in 8-9 days' })
    }

    let sent = 0
    const errors: string[] = []

    for (const sub of subscriptions) {
      /**
       * 🔴 UN AVISO QUE FALLA NO PUEDE DEJAR SIN AVISAR A LOS SIGUIENTES.
       *
       * Antes no había try/catch por iteración: el bucle se apoyaba en que
       * `sendEmail` devuelve `{ ok }` en vez de lanzar. Pero el `.update()`
       * de `renewal_notice_sent_at` sí lanza si la conexión se cae, y un
       * `getTime()` sobre una fecha inválida también. Cualquiera de los dos
       * salía al catch exterior y ABORTABA EL RESTO DE LA LISTA.
       *
       * Con la LFPC de por medio esa lista tiene que llegar entera: cada
       * fila no avisada es un cobro sin preaviso. Mismo patrón que ya usa
       * pauses-ending.
       *
       * No cambia a quién se avisa, ni qué se manda, ni cuándo.
       */
      try {
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
      // 🔴 price_mxn es el precio del TITULAR. Los asientos adicionales
      // son line items aparte en Stripe y no estan en esa columna.
      // Anunciar solo el titular seria avisar un monto menor al que se
      // cobra, que es justo lo que la LFPC prohibe.
      //
      // Se cuentan solo los que van a renovar: un asiento en 'ending'
      // conserva acceso hasta access_until pero NO se factura de nuevo.
      const { count: asientosExtra } = await supabase
        .from('learners')
        .select('id', { count: 'exact', head: true })
        .eq('account_user_id', sub.user_id)
        .eq('status', 'active')
        .eq('is_primary', false)

      const planKeyStripe = PLAN_DB_A_STRIPE[sub.plan]
      const precioPorAsiento = planKeyStripe
        ? precioAsiento(planKeyStripe, (sub.billing_cycle ?? 'monthly') as BillingCycleDB)
        : 0

      const montoTitular = sub.price_mxn / 100
      const montoAsientos = (asientosExtra ?? 0) * precioPorAsiento
      const amount = montoTitular + montoAsientos
      const totalAlumnos = (asientosExtra ?? 0) + 1

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
        totalAlumnos,
        montoTitular,
        montoAsientos,
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

        /**
         * Solo cuando el correo SALIO de verdad (`result.ok`). Es el mismo
         * criterio que `renewal_notice_sent_at`: se anuncia lo que ocurrio.
         *
         * `dias_antes` se calcula, no se escribe a mano: la ventana del cron
         * es de 8 a 9 dias —no de 5, pese al nombre del archivo— y una
         * constante aqui volveria a envejecer igual.
         */
        try {
          const usuario = sub.users as unknown as {
            cookie_consent_analytics?: boolean | null
            cookie_consent_marketing?: boolean | null
          } | null

          await trackServer(
            'aviso_profeco_enviado',
            {
              dias_antes: Math.round(
                (new Date(sub.current_period_end).getTime() - Date.now()) / 86_400_000
              ),
              monto: sub.price_mxn,
              plan: sub.plan,
              ciclo: sub.billing_cycle,
            },
            {
              consent: {
                analytics: usuario?.cookie_consent_analytics,
                marketing: usuario?.cookie_consent_marketing,
              },
              userId: sub.user_id as string,
            }
          )
        } catch (err) {
          console.error('[PROFECO Cron] analitica fallo:', err)
        }
      } else {
        errors.push(`Failed for user ${sub.user_id}: ${JSON.stringify(result.error)}`)
      }
      } catch (err) {
        // La fila queda SIN `renewal_notice_sent_at`, así que el cron de
        // mañana la vuelve a intentar. Es el comportamiento correcto: el
        // aviso se debe, no se descarta.
        console.error(`[PROFECO Cron] Error procesando ${sub.user_id}:`, err)
        errors.push(`Sub ${sub.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    console.log(`[PROFECO Cron] Sent ${sent}/${subscriptions.length} renewal notices`)

    // `rows_processed` son FILAS PROCESADAS (`total`), no correos enviados
    // (`sent`). Con 10 suscripciones y 3 fallos, aquí van 10 y el detalle
    // de los 3 va en `error`.
    await cerrarCorrida(supabase, corridaId, {
      rowsProcessed: subscriptions.length,
      error: resumirFallos(errors, subscriptions.length),
    })

    return Response.json({
      ok: true,
      sent,
      total: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[PROFECO Cron] Unexpected error:', err)
    await cerrarCorrida(supabase, corridaId, {
      rowsProcessed: 0,
      error: `Excepción: ${err instanceof Error ? err.message : String(err)}`,
    })
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
