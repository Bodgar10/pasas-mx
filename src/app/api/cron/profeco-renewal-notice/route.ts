import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { FROM_EMAIL, SUPPORT_EMAIL } from '@/lib/email/resend'
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

    type Usuario = {
      full_name: string | null
      email: string
      cookie_consent_analytics?: boolean | null
      cookie_consent_marketing?: boolean | null
    }
    const usuarioDe = (sub: (typeof subscriptions)[number]) =>
      (Array.isArray(sub.users) ? sub.users[0] : sub.users) as unknown as Usuario | null

    // Sin correo no hay aviso posible: se salta igual que antes (sin error).
    const conCorreo = subscriptions.filter((sub) => !!usuarioDe(sub)?.email)

    /**
     * Asientos extra de TODAS las cuentas en una sola pasada (antes: un
     * conteo por suscripción, en serie). Mismos filtros que el conteo viejo:
     * solo los que van a renovar — un asiento en 'ending' conserva acceso
     * hasta access_until pero NO se factura de nuevo.
     *
     * Se trocea en grupos de 100 cuentas: así la URL del `.in()` no crece
     * sin techo y cada respuesta queda muy por debajo de las 1000 filas
     * de `max_rows`.
     *
     * 🔴 Si un trozo falla, sus cuentas NO se avisan hoy (quedan sin
     * `renewal_notice_sent_at` y van al detalle de errores). Antes un fallo
     * del conteo daba 0 asientos y el aviso salía con un monto MENOR al que
     * se cobra, que es justo lo que la LFPC prohíbe.
     */
    const asientosPorCuenta = new Map<string, number>()
    const cuentasSinConteo = new Set<string>()
    const userIds = [...new Set(conCorreo.map((sub) => sub.user_id as string))]
    const TROZO_CUENTAS = 100
    await Promise.all(
      Array.from({ length: Math.ceil(userIds.length / TROZO_CUENTAS) }, (_, i) =>
        userIds.slice(i * TROZO_CUENTAS, (i + 1) * TROZO_CUENTAS)
      ).map(async (trozo) => {
        const { data, error: errAsientos } = await supabase
          .from('learners')
          .select('account_user_id')
          .in('account_user_id', trozo)
          .eq('status', 'active')
          .eq('is_primary', false)
        if (errAsientos) {
          console.error('[PROFECO Cron] conteo de asientos falló:', errAsientos)
          for (const id of trozo) cuentasSinConteo.add(id)
          return
        }
        for (const l of data ?? []) {
          const id = l.account_user_id as string
          asientosPorCuenta.set(id, (asientosPorCuenta.get(id) ?? 0) + 1)
        }
      })
    )

    /**
     * 🔴 UN AVISO QUE FALLA NO PUEDE DEJAR SIN AVISAR A LOS SIGUIENTES.
     *
     * Con la LFPC de por medio esa lista tiene que llegar entera: cada
     * fila no avisada es un cobro sin preaviso. Por eso armar el correo
     * tiene su propio try/catch por suscripción (un `getTime()` sobre una
     * fecha inválida lanza) y el envío va por lotes con resultado por
     * correo, no todo-o-nada.
     *
     * No cambia a quién se avisa, ni qué se manda, ni cuándo.
     */
    type Aviso = {
      sub: (typeof subscriptions)[number]
      usuario: Usuario
      correo: { to: string; subject: string; html: string }
    }
    const avisos: Aviso[] = []

    for (const sub of conCorreo) {
      try {
        const usuario = usuarioDe(sub)!
        if (cuentasSinConteo.has(sub.user_id as string)) {
          errors.push(`Sub ${sub.id}: no se pudieron contar los asientos; aviso pospuesto`)
          continue
        }

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
        const asientosExtra = asientosPorCuenta.get(sub.user_id as string) ?? 0

        const planKeyStripe = PLAN_DB_A_STRIPE[sub.plan]
        const precioPorAsiento = planKeyStripe
          ? precioAsiento(planKeyStripe, (sub.billing_cycle ?? 'monthly') as BillingCycleDB)
          : 0

        const montoTitular = sub.price_mxn / 100
        const montoAsientos = asientosExtra * precioPorAsiento
        const amount = montoTitular + montoAsientos
        const totalAlumnos = asientosExtra + 1

        const renewalDate = new Date(sub.current_period_end).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })

        const html = renewalNoticeTemplate({
          userName: usuario.full_name?.split(' ')[0] ?? 'Estudiante',
          planName: `${planLabel} ${cycleLabel}`,
          amount,
          renewalDate,
          billingCycle: cycleLabel,
          totalAlumnos,
          montoTitular,
          montoAsientos,
        })

        avisos.push({
          sub,
          usuario,
          correo: {
            to: usuario.email,
            subject: `Tu suscripción de Pasas.mx se renueva el ${renewalDate}`,
            html,
          },
        })
      } catch (err) {
        // La fila queda SIN `renewal_notice_sent_at`: un reintento la
        // vuelve a tomar. El aviso se debe, no se descarta.
        console.error(`[PROFECO Cron] Error procesando ${sub.user_id}:`, err)
        errors.push(`Sub ${sub.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    /**
     * Envío con `resend.batch.send` (como arcade-recordatorio): UNA petición
     * por cada 100 correos, en vez de una por correo en serie. Además evita
     * el límite de peticiones por segundo de Resend, que mandar en paralelo
     * con `sendEmail` sí pisaría.
     *
     * 🔴 `batchValidation: 'permissive'`: con el modo estricto por defecto,
     * UN correo inválido tumba el lote entero y deja sin aviso a los otros 99.
     * En permisivo Resend devuelve el índice de cada fallo y el resto sale.
     *
     * Idempotencia: `renewal_notice_sent_at` se marca POR LOTE, justo
     * después de enviarlo y SOLO para los que salieron. Si la función se
     * corta a la mitad, el reintento no reenvía a los ya avisados.
     *
     * Mismo remitente y mismo reply-to que `sendEmail`.
     */
    const resend = new Resend(process.env.RESEND_API_KEY)
    const LOTE = 100

    for (let i = 0; i < avisos.length; i += LOTE) {
      const lote = avisos.slice(i, i + LOTE)
      let enviados: Aviso[] = []
      try {
        const { data, error: errLote } = await resend.batch.send(
          lote.map((a) => ({ from: FROM_EMAIL, replyTo: SUPPORT_EMAIL, ...a.correo })),
          { batchValidation: 'permissive' }
        )
        if (errLote || !data) {
          console.error('[PROFECO Cron] lote falló:', errLote)
          for (const a of lote) errors.push(`Failed for user ${a.sub.user_id}: ${JSON.stringify(errLote)}`)
          continue
        }
        const fallidos = new Map((data.errors ?? []).map((e) => [e.index, e.message]))
        enviados = lote.filter((_, idx) => !fallidos.has(idx))
        fallidos.forEach((mensaje, idx) => {
          errors.push(`Failed for user ${lote[idx]?.sub.user_id}: ${JSON.stringify(mensaje)}`)
        })
      } catch (err) {
        console.error('[PROFECO Cron] lote lanzó:', err)
        for (const a of lote) errors.push(`Sub ${a.sub.id}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }

      if (enviados.length === 0) continue

      // Marcar como enviados: un solo update por lote.
      const { error: errMarca } = await supabase
        .from('subscriptions')
        .update({ renewal_notice_sent_at: new Date().toISOString() })
        .in(
          'id',
          enviados.map((a) => a.sub.id)
        )
      if (errMarca) {
        // Los correos YA salieron: se cuentan como enviados, pero un
        // reintento los repetiría. Queda en la bitácora para verlo.
        console.error('[PROFECO Cron] no se pudo marcar el lote:', errMarca)
        errors.push(`Marca renewal_notice_sent_at falló (${enviados.length} ya avisados): ${errMarca.message}`)
      }
      sent += enviados.length

      /**
       * Solo cuando el correo SALIO de verdad. Es el mismo criterio que
       * `renewal_notice_sent_at`: se anuncia lo que ocurrio.
       *
       * `dias_antes` se calcula, no se escribe a mano: la ventana del cron
       * es de 8 a 9 dias —no de 5, pese al nombre del archivo— y una
       * constante aqui volveria a envejecer igual.
       *
       * `trackServer` nunca lanza; el catch es por si acaso.
       */
      try {
        await Promise.all(
          enviados.map(({ sub, usuario }) =>
            trackServer(
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
                  analytics: usuario.cookie_consent_analytics,
                  marketing: usuario.cookie_consent_marketing,
                },
                userId: sub.user_id as string,
              }
            )
          )
        )
      } catch (err) {
        console.error('[PROFECO Cron] analitica fallo:', err)
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
