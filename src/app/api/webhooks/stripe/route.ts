/**
 * POST /api/webhooks/stripe
 * -------------------------
 * Handles Stripe webhook events and syncs subscription state to Supabase.
 *
 * To reuse in another project:
 *   - Update the Supabase table name if your subscriptions table differs
 *   - Update PRICE_TO_PLAN in config.ts with your own price IDs
 *   - Add or remove event handlers in the switch block as needed
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET — from Stripe Dashboard → Webhooks → Signing secret
 *
 * Events handled:
 *   checkout.session.completed  → INSERT new subscription row
 *   invoice.paid                → UPDATE period dates on renewal
 *   customer.subscription.deleted → UPDATE status to cancelled
 */

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/payments/stripe'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { PRICE_TO_PLAN, CICLO_LABEL } from '@/lib/payments/config'
import { sendEmail } from '@/lib/email/resend'
import { welcomeTemplate } from '@/lib/email/templates/welcome'
import { paymentReceiptTemplate } from '@/lib/email/templates/payment-receipt'
import { sendMetaCapiEvent } from '@/lib/marketing/meta-capi'
import { CLAVES_ATRIBUCION } from '@/lib/payments/metadata-checkout'
import { trackServer } from '@/lib/analytics/track-server'
import { getActiveLearnerId, materiasParaGrado } from '@/lib/learners'
import { sendTikTokEvent } from '@/lib/marketing/tiktok-events'
import Stripe from 'stripe'

// Use service role client to bypass RLS in webhook handler
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Missing Supabase service role credentials')
  return createSupabaseClient(url, key)
}

/**
 * Cuantas renovaciones lleva la suscripcion, contando desde el alta.
 *
 * Derivado del tiempo transcurrido y del ciclo: no hay tabla de cobros, asi
 * que este es el numero honesto disponible. 1 = primera renovacion.
 */
function cicloNumero(creadaIso: string | null | undefined, ciclo: string | null | undefined): number | undefined {
  if (!creadaIso) return undefined
  const meses: Record<string, number> = { monthly: 1, semestral: 6, annual: 12 }
  const paso = meses[ciclo ?? 'monthly'] ?? 1
  const transcurridos = (Date.now() - new Date(creadaIso).getTime()) / (30 * 86_400_000)
  return Math.max(1, Math.floor(transcurridos / paso))
}

/**
 * Resuelve a quien pertenece una suscripcion de Stripe y con que
 * consentimiento cuenta, para los eventos que NO nacen de un checkout y por
 * tanto no traen `user_id` en la metadata.
 *
 * Devuelve null si no hay fila: un evento de una suscripcion que no
 * conocemos no se mide contra nadie.
 */
async function resolverDestinatario(
  supabase: SupabaseClient,
  providerSubId: string
): Promise<{ userId: string; consent: { analytics: boolean | null; marketing: boolean | null } } | null> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('provider_sub_id', providerSubId)
    .maybeSingle()

  if (!sub?.user_id) return null

  const { data: usuario } = await supabase
    .from('users')
    .select('cookie_consent_analytics, cookie_consent_marketing')
    .eq('id', sub.user_id)
    .maybeSingle()

  return {
    userId: sub.user_id,
    consent: {
      analytics: usuario?.cookie_consent_analytics ?? null,
      marketing: usuario?.cookie_consent_marketing ?? null,
    },
  }
}

/**
 * Extrae el bloque de canal de la metadata de Stripe.
 *
 * Devuelve NULL —no `{}`— cuando no hay ni una clave: una fila con `{}` se
 * lee como "se midio y no habia canal", que es distinto de "no se midio".
 * Con NULL, `WHERE acquisition IS NULL` separa limpio lo viejo y lo organico
 * de lo atribuido.
 */
function construirAcquisition(
  metadata: Record<string, string> | null | undefined
): Record<string, string> | null {
  if (!metadata) return null
  const bloque: Record<string, string> = {}
  for (const clave of CLAVES_ATRIBUCION) {
    const valor = metadata[clave]
    if (valor) bloque[clave] = valor
  }
  return Object.keys(bloque).length > 0 ? bloque : null
}

export async function POST(request: Request) {
  // 1. Read raw body and signature
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // 2. Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhooks/stripe] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceClient()

  try {
    switch (event.type) {

      // -----------------------------------------------------------------------
      // New subscription created after successful checkout
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session        = event.data.object as Stripe.Checkout.Session
        const userId         = session.metadata?.user_id
        const subscriptionId = session.subscription as string

        if (!userId || !subscriptionId) {
          console.warn('[webhooks/stripe] Missing user_id or subscription_id in metadata')
          break
        }

        // Fetch full subscription object from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const subData = subscription as unknown as {
          items: {
            data: {
              price: { id: string; unit_amount: number }
              // 🔴 Los periodos viven AQUÍ, no en la raíz de Subscription.
              // Se movieron al item en la API 2026-04-22.dahlia, que es la
              // que fija src/lib/payments/stripe.ts. Leerlos de la raíz
              // devuelve undefined SIN error.
              current_period_start: number
              current_period_end: number
            }[]
          }
          customer: string
        }

        const priceId   = subData.items.data[0]?.price.id
        const planInfo  = PRICE_TO_PLAN[priceId] ?? { plan: 'grade', duration: 'monthly' }
        const priceAmount = subData.items.data[0]?.price.unit_amount ?? 0

        // Periodos desde el ITEM. Sin fallback a propósito: el `?? now + 30d`
        // anterior escribió fechas inventadas durante meses sin un solo error
        // en los logs. Si Stripe deja de mandar esto, queremos enterarnos.
        const item = subData.items.data[0]
        if (!item?.current_period_end) {
          console.error('[webhooks/stripe] Sin periodo en el item', subscriptionId)
          throw new Error('Subscription item sin current_period_end')
        }

        const periodStart = new Date(item.current_period_start * 1000).toISOString()
        const periodEnd   = new Date(item.current_period_end   * 1000).toISOString()

        const fullSub = subscription as unknown as {
          status: string
          trial_end: number | null
        }
        const isTrial = fullSub.status === 'trialing' || !!fullSub.trial_end
        const trialEndsAt = fullSub.trial_end ? new Date(fullSub.trial_end * 1000).toISOString() : null
        const subStatus = isTrial ? 'trialing' : 'active'

        await supabase.from('subscriptions').insert({
          user_id:              userId,
          plan:                 planInfo.plan,
          status:               subStatus,
          price_mxn:            priceAmount,
          // 🔴 Sin esto la columna se queda en su DEFAULT 'monthly' y un
          // cliente semestral recibe el aviso de renovación de la LFPC
          // diciendo "Mensual" con el monto del semestre. Los valores de
          // PRICE_TO_PLAN ya son 'monthly' | 'semestral' | 'annual', los
          // mismos del enum de la base.
          billing_cycle:        planInfo.duration,
          payment_provider:     'stripe',
          provider_sub_id:      subscriptionId,
          provider_customer_id: subData.customer,
          current_period_start: periodStart,
          current_period_end:   periodEnd,
          trial_ends_at:        trialEndsAt,
          // Campaña con la que se vendió. Sale de subscription_data.metadata,
          // que ponen las dos puertas de checkout solo cuando la promoción se
          // aplicó de verdad.
          //
          // 🔴 Sin fallback. Si no viene, queda NULL, y NULL significa "sin
          // promoción" — es un dato correcto. Inventar un valor aquí es
          // exactamente lo que se quitó en la s27 con los periodos.
          promo_slug:           subscription.metadata?.promo_slug ?? null,
          // Canal de origen, rescatado de la metadata que pusieron las dos
          // puertas de checkout (construirMetadataCheckout).
          //
          // 🔴 NULL si no viene, y NULL es un dato correcto: trafico organico,
          // o un pago anterior a este cambio. No se inventa 'direct' — seria
          // indistinguible de una atribucion real y ensuciaria todo reporte
          // por canal desde el primer dia.
          //
          // `promo_slug` NO se mete aqui dentro: ya tiene su columna desde la
          // migracion 043 y duplicarlo daria dos verdades que se pueden
          // contradecir.
          acquisition:          construirAcquisition(subscription.metadata),
          metadata: {
            duration: planInfo.duration,
            price_id: priceId,
          },
        })

        console.log(`[webhooks/stripe] Subscription created for user ${userId}`)

        // ── pago_exitoso ────────────────────────────────────────────────
        //
        // 🔴 NACE AQUI, no en el dashboard. `checkout_completed` de
        // dashboard-client.tsx se pierde si la persona cierra antes de volver
        // del redirect de Stripe, se duplica al recargar, y manda plan y
        // precio ESCRITOS A MANO. Este es el unico punto que ve todos los
        // pagos y ninguno de mas. Aquel queda congelado; este es el bueno.
        //
        // `checkout_event_id` cierra el circulo con el `checkout_iniciado`
        // que disparo el navegador: es lo que permite medir cuantos checkouts
        // abiertos acaban en cobro, y no solo cuantas personas pagaron.
        try {
          const { data: consentPago } = await supabase
            .from('users')
            .select('cookie_consent_analytics, cookie_consent_marketing')
            .eq('id', userId)
            .single()

          const totales = (session as unknown as {
            amount_total?: number | null
            total_details?: { amount_discount?: number | null } | null
          })
          const amountDiscount = totales.total_details?.amount_discount ?? 0
          const amountTotal = totales.amount_total ?? 0

          await trackServer(
            'pago_exitoso',
            {
              plan: planInfo.plan,
              ciclo: planInfo.duration,
              // 🔴 Lo COBRADO por Stripe, no el precio de lista. Con trial de
              // 7 dias esto es 0 y `es_trial` lo explica: sin esa distincion,
              // "ingresos nuevos" cuenta pruebas gratuitas como ventas.
              monto_cobrado: amountTotal,
              amount_discount: amountDiscount,
              es_trial: isTrial,
              checkout_event_id: subscription.metadata?.checkout_event_id ?? undefined,
            },
            {
              consent: {
                analytics: consentPago?.cookie_consent_analytics,
                marketing: consentPago?.cookie_consent_marketing,
              },
              userId,
              // 🔴 NO se pasa el checkout_event_id como eventId.
              //
              // `pago_exitoso` esta mapeado a Subscribe/CompletePayment... y
              // el bloque de abajo YA los manda. Reusar aqui el id del
              // checkout haria que Meta recibiera dos eventos con el mismo
              // eventID y descartara uno de los dos en silencio.
              // Ver la nota de duplicacion mas abajo.
            }
          )

          // ── cupon_aplicado / checkout_sin_cupon ──────────────────────
          //
          // Lo unico observable del cupon. El codigo se teclea DENTRO del
          // Checkout de Stripe y el rechazo ocurre en su dominio: no hay
          // webhook ni campo que diga "intento uno y no valia".
          //
          // La diferencia entre estos dos acota cuanta gente lo intento: si
          // se abren 100 sesiones con el campo de codigo visible y solo 12
          // acaban con descuento, las otras 88 o no lo intentaron o fallaron.
          if (amountDiscount > 0) {
            await trackServer(
              'cupon_aplicado',
              { monto_descuento: amountDiscount, plan: planInfo.plan },
              {
                consent: {
                  analytics: consentPago?.cookie_consent_analytics,
                  marketing: consentPago?.cookie_consent_marketing,
                },
                userId,
              }
            )
          } else if (!subscription.metadata?.promo_slug) {
            // Sin promo servida por nosotros y sin descuento: la sesion se
            // abrio con `allow_promotion_codes: true` y se completo a precio
            // completo.
            await trackServer(
              'checkout_sin_cupon',
              { plan: planInfo.plan, ciclo: planInfo.duration },
              {
                consent: {
                  analytics: consentPago?.cookie_consent_analytics,
                  marketing: consentPago?.cookie_consent_marketing,
                },
                userId,
              }
            )
          }
        } catch (err) {
          // Nunca tumba el webhook: la suscripcion ya esta escrita arriba.
          console.error('[webhooks/stripe] pago_exitoso fallo:', err)
        }

        // Disparar eventos server-side a Meta y TikTok
        try {
          const { data: userForTracking } = await supabase
            .from('users')
            .select('email, cookie_consent_marketing')
            .eq('id', userId)
            .single()

          // 🔴 Meta y TikTok son TRANSFERENCIAS (art. 35 LFPDPPP). Sin el
          // consentimiento del banner no sale nada, aunque el pago sí ocurra.
          //
          // Se exige === true a propósito: NULL significa "nunca contestó el
          // banner", que NO es un sí. Fail-closed, igual que en el cliente.
          if (userForTracking?.email && userForTracking.cookie_consent_marketing === true) {
            const amount = priceAmount / 100
            await Promise.all([
              sendMetaCapiEvent('Subscribe', {
                email: userForTracking.email,
                value: amount,
                currency: 'MXN',
                contentName: planInfo.plan,
                eventSourceUrl: 'https://pasas.mx/planes',
              }),
              sendTikTokEvent('CompletePayment', {
                email: userForTracking.email,
                value: amount,
                currency: 'MXN',
                contentName: planInfo.plan,
                eventUrl: 'https://pasas.mx/planes',
              }),
            ])
          }
        } catch (trackingErr) {
          console.error('[webhooks/stripe] Tracking error:', trackingErr)
        }

        // Enviar email de bienvenida
        try {
          const { data: userProfile } = await supabase
            .from('users')
            .select('full_name, email, parent_name')
            .eq('id', userId)
            .single()

          if (userProfile?.email) {
            const trialEndsAtFormatted = fullSub.trial_end
              ? new Date(fullSub.trial_end * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'N/A'

            await sendEmail({
              to: userProfile.email,
              subject: '¡Bienvenido a Pasas.mx! 🎮',
              html: welcomeTemplate({
                studentName: userProfile.full_name?.split(' ')[0] ?? 'Estudiante',
                parentName: userProfile.parent_name?.split(' ')[0] ?? null,
                planName: planInfo.plan === 'grade' ? 'Estándar' : 'Personalizado',
                trialEndsAt: trialEndsAtFormatted,
                // priceAmount viene en CENTAVOS de Stripe.
                amount: Math.round(priceAmount / 100),
                billingCycle: CICLO_LABEL[planInfo.duration] ?? 'Mensual',
              }),
            })
          }
        } catch (emailErr) {
          console.error('[webhooks/stripe] Error sending welcome email:', emailErr)
        }

        // For grade plan, create user_subjects for every subject matching the user's level and grade
        if (planInfo.plan === 'grade') {
          try {
            const { data: userProfile } = await supabase
              .from('users')
              .select('education_level, grade, interests')
              .eq('id', userId)
              .single()

            if (userProfile?.education_level && userProfile?.grade) {
              const themeName = userProfile.interests?.[0] ?? null

              // El alumno tiene que existir ANTES de comprarle materias.
              // user_subjects.learner_id es NOT NULL: sin esto el insert
              // truena, el catch lo traga, y el usuario paga sin recibir
              // nada. Se aborta con throw para que Stripe reintente en
              // vez de dar el pago por bueno.
              const learnerId = await getActiveLearnerId(supabase, userId)
              if (!learnerId) {
                console.error('[webhooks/stripe] Usuario pago sin alumno:', userId)
                throw new Error('Sin alumno activo al crear user_subjects')
              }

              // Resolve theme UUID from name.
              // ilike, no eq: una diferencia de mayuscula devolvia NULL y
              // el insert reventaba contra theme_id NOT NULL.
              // maybeSingle, no single: cero filas no es un error aqui.
              let themeId: string | null = null
              if (themeName) {
                const { data: themeRow } = await supabase
                  .from('themes')
                  .select('id')
                  .ilike('name', themeName)
                  .maybeSingle()
                themeId = themeRow?.id ?? null
              }

              if (!themeId) {
                console.error('[webhooks/stripe] Tematica sin resolver:', themeName, userId)
                throw new Error('No se pudo resolver la tematica')
              }

              // 🔴 s32 — La regla "que materias le tocan a este alumno" vive
              // en `materiasParaGrado`, compartida con /api/seats/add y con
              // /api/seats/change-grade. Estaba copiada aqui y en add, y a
              // change-grade se le olvido por completo: por eso un cambio de
              // grado dejaba al alumno con el catalogo del grado anterior.
              //
              // La funcion LANZA si la consulta falla, en vez de devolver [].
              // Antes ese error se ignoraba y el pago se daba por bueno sin
              // crear una sola materia; ahora sube al catch de abajo, que
              // devuelve 500 y hace que Stripe reintente.
              const subjects = await materiasParaGrado(
                supabase,
                userProfile.education_level,
                userProfile.grade
              )

              if (subjects.length > 0) {
                const userSubjectsRows = subjects.map((subject) => ({
                  user_id: userId,
                  learner_id: learnerId,
                  subject_id: subject.id,
                  theme_id: themeId,
                  plan_type: 'grade',
                  xp: 0,
                  streak_days: 0,
                  purchased_at: new Date().toISOString(),
                }))

                const { error: subjectsError } = await supabase
                  .from('user_subjects')
                  .upsert(userSubjectsRows, { onConflict: 'learner_id,subject_id' })

                if (subjectsError) {
                  console.error('[webhooks/stripe] Error insertando user_subjects:', subjectsError)
                  throw subjectsError
                }

                console.log(`[webhooks/stripe] Created ${userSubjectsRows.length} user_subjects for user ${userId}`)
              }
            }
          } catch (err) {
            // Se re-lanza a proposito. El catch externo devuelve 500 y eso
            // es lo que hace que Stripe reintente el webhook.
            //
            // Aqui ya se cobro el dinero. Tragarse el error significa un
            // cliente pagando por un dashboard vacio, sin una sola alarma:
            // exactamente el patron de los tres bugs de facturacion de s27,
            // donde el fallo estaba en datos que nadie miraba.
            //
            // Los otros try/catch de este handler (correos, tracking) SI se
            // tragan su error a proposito: un correo que no sale no invalida
            // un pago. Este bloque es el acceso al producto.
            console.error('[webhooks/stripe] Error creating user_subjects:', err)
            throw err
          }
        }

        // If ai_personalized plan, trigger content generation in background
        if (planInfo.plan === 'ai_personalized') {
          try {
            const { data: userSubject } = await supabase
              .from('user_subjects')
              .select('subject_id, initial_description, theme_id')
              .eq('user_id', userId)
              .eq('plan_type', 'ai_personalized')
              .order('purchased_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (userSubject?.subject_id && userSubject?.initial_description) {
              let weakTopicIds: string[] = []
              try {
                const parsed = JSON.parse(userSubject.initial_description)
                weakTopicIds = parsed.weak_topic_ids ?? []
              } catch {}

              if (weakTopicIds.length > 0) {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasas.mx'
                fetch(`${baseUrl}/api/personalized/generate-plan`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId,
                    subjectId: userSubject.subject_id,
                    themeId: userSubject.theme_id,
                    weakTopicIds,
                  }),
                }).catch(err => console.error('[webhooks/stripe] generate-plan fetch error:', err))
                console.log(`[webhooks/stripe] Triggered personalized plan generation for user ${userId}`)
              }
            }
          } catch (err) {
            console.error('[webhooks/stripe] Error triggering personalized plan:', err)
          }
        }

        break
      }

      // -----------------------------------------------------------------------
      // Subscription renewed — update period dates
      // -----------------------------------------------------------------------
      case 'invoice.paid': {
        const invoice        = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription: string }).subscription
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const subData = subscription as unknown as {
          items: { data: { current_period_start: number; current_period_end: number }[] }
        }
        // Periodos desde el item (API 2026-04-22.dahlia). Ver el insert.
        const item = subData.items.data[0]
        if (!item?.current_period_end) {
          console.error('[webhooks/stripe] Sin periodo en el item', subscriptionId)
          throw new Error('Subscription item sin current_period_end')
        }
        const rawEnd = item.current_period_end
        const periodStart = new Date(item.current_period_start * 1000).toISOString()
        const periodEnd   = new Date(rawEnd * 1000).toISOString()

        await supabase
          .from('subscriptions')
          .update({
            status:                 'active',
            current_period_start:   periodStart,
            current_period_end:     periodEnd,
            // 🔴 El aviso de la LFPC se debe UNA VEZ POR CICLO.
            // El cron filtra por `renewal_notice_sent_at IS NULL`,
            // así que sin este reset cada suscripción recibe un
            // solo aviso en toda su vida y queda muda para siempre.
            // Va aquí porque es el único punto donde el periodo
            // avanza por renovación real. Con billing_reason
            // 'subscription_create' el campo ya estaba NULL, así
            // que el reset es inocuo y no hay que condicionarlo.
            renewal_notice_sent_at: null,
            updated_at:             new Date().toISOString(),
          })
          .eq('provider_sub_id', subscriptionId)

        /**
         * `renovacion_exitosa` — el cobro que dice si el producto retiene.
         *
         * 🔴 `ciclo_n` distingue la PRIMERA renovacion de la decima. La
         * primera es la unica que responde "¿aguanta el producto un ciclo
         * completo?"; la decima ya solo confirma lo que se sabia. Sin este
         * campo las dos son la misma fila.
         *
         * Se deriva de `billing_reason`: `subscription_create` es el alta,
         * `subscription_cycle` es una renovacion. El numero sale de contar
         * cuantos ciclos han pasado desde el alta de la suscripcion.
         */
        try {
          const facturaRenov = invoice as unknown as {
            billing_reason?: string | null
            amount_paid?: number | null
          }

          if (facturaRenov.billing_reason === 'subscription_cycle') {
            const { data: filaSub } = await supabase
              .from('subscriptions')
              .select('user_id, plan, billing_cycle, created_at')
              .eq('provider_sub_id', subscriptionId)
              .maybeSingle()

            if (filaSub?.user_id) {
              const { data: consentimientoRenov } = await supabase
                .from('users')
                .select('cookie_consent_analytics, cookie_consent_marketing')
                .eq('id', filaSub.user_id)
                .maybeSingle()

              const { count: nAsientos } = await supabase
                .from('learners')
                .select('id', { count: 'exact', head: true })
                .eq('account_user_id', filaSub.user_id)
                .eq('status', 'active')

              await trackServer(
                'renovacion_exitosa',
                {
                  ciclo_n: cicloNumero(filaSub.created_at, filaSub.billing_cycle),
                  plan: filaSub.plan,
                  ciclo: filaSub.billing_cycle,
                  monto: facturaRenov.amount_paid ?? undefined,
                  n_asientos: nAsientos ?? undefined,
                },
                {
                  consent: {
                    analytics: consentimientoRenov?.cookie_consent_analytics,
                    marketing: consentimientoRenov?.cookie_consent_marketing,
                  },
                  userId: filaSub.user_id,
                }
              )
            }
          }
        } catch (err) {
          console.error('[webhooks/stripe] renovacion_exitosa fallo:', err)
        }

        // ── pago_recuperado ─────────────────────────────────────────────
        //
        // `attempt_count > 1` significa que este cobro NO salio a la primera:
        // Stripe reintento y esta vez funciono. Es dinero que estuvo a punto
        // de perderse, y sin este evento es indistinguible de un cobro normal.
        //
        // No hace falta escuchar nada nuevo: `invoice.paid` ya llega.
        try {
          const facturaDatos = invoice as unknown as {
            attempt_count?: number | null
            created?: number | null
            status_transitions?: { finalized_at?: number | null } | null
          }
          const intentos = facturaDatos.attempt_count ?? 1
          if (intentos > 1) {
            const destino = await resolverDestinatario(supabase, subscriptionId)
            if (destino) {
              const creada = facturaDatos.created ? facturaDatos.created * 1000 : null
              await trackServer(
                'pago_recuperado',
                {
                  intentos,
                  // Dias desde que se emitio la factura hasta que se cobro.
                  // Es lo mas cercano a "cuanto tardo en recuperarse" que se
                  // puede saber sin guardar el momento del primer fallo.
                  dias_desde_fallo: creada
                    ? Math.round((Date.now() - creada) / 86_400_000)
                    : undefined,
                },
                { consent: destino.consent, userId: destino.userId }
              )
            }
          }
        } catch (err) {
          console.error('[webhooks/stripe] pago_recuperado fallo:', err)
        }

        // Enviar email de recibo de pago
        try {
          const { data: subRow } = await supabase
            .from('subscriptions')
            .select('user_id, plan, billing_cycle, price_mxn, users(full_name, email)')
            .eq('provider_sub_id', subscriptionId)
            .maybeSingle()

          const user = (Array.isArray(subRow?.users) ? subRow?.users[0] : subRow?.users) as { full_name: string; email: string } | null
          if (user?.email) {
            const amount = Math.round((subRow?.price_mxn ?? 0) / 100)
            const cycleLabel = CICLO_LABEL[subRow?.billing_cycle ?? 'monthly'] ?? 'Mensual'
            const nextRenewal = new Date(rawEnd * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

            await sendEmail({
              to: user.email,
              subject: `Pago confirmado — Pasas.mx $${amount} MXN`,
              html: paymentReceiptTemplate({
                userName: user.full_name?.split(' ')[0] ?? 'Estudiante',
                planName: subRow?.plan === 'grade' ? 'Estándar' : 'Personalizado',
                amount,
                billingCycle: cycleLabel,
                nextRenewal,
                invoiceId: (invoice as any).id ?? '',
              }),
            })
          }
        } catch (emailErr) {
          console.error('[webhooks/stripe] Error sending receipt email:', emailErr)
        }

        console.log(`[webhooks/stripe] Subscription renewed: ${subscriptionId}`)
        break
      }

      // -----------------------------------------------------------------------
      // Subscription cancelled — mark as cancelled in DB
      // -----------------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Buscar la suscripción en BD para verificar si tiene cancellation_reason
        const { data: subRow } = await supabase
          .from('subscriptions')
          .select('id, user_id')
          .eq('provider_sub_id', subscription.id)
          .maybeSingle()

        if (subRow) {
          // Verificar si el usuario dejó feedback de cancelación
          const { data: feedback } = await supabase
            .from('cancellation_reasons')
            .select('id')
            .eq('user_id', subRow.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!feedback) {
            // Sin feedback — notificar admin en consola (TODO: email cuando Resend esté listo)
            console.warn(`[webhooks/stripe] Cancelación sin feedback para user ${subRow.user_id}`)
          }
        }

        await supabase
          .from('subscriptions')
          .update({
            status:       'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at:   new Date().toISOString(),
          })
          .eq('provider_sub_id', subscription.id)

        /**
         * 🔴 NO se manda correo de cancelación desde aquí.
         *
         * Este evento llega cuando el periodo YA VENCIÓ, así que
         * "sigues teniendo acceso hasta X" es falso por definición.
         * Además leía current_period_end de la raíz del objeto —
         * undefined en la API 2026-04-22.dahlia — con un ?? 0 que
         * lo convertía en el 1 de enero de 1970.
         *
         * La confirmación la manda /api/subscription/cancel en el
         * momento en que el usuario cancela, con la fecha leída de
         * Supabase y validada. Los otros dos disparadores de este
         * evento (refund-request y admin/delete-user) no deben
         * avisar nada.
         */

        console.log(`[webhooks/stripe] Subscription cancelled: ${subscription.id}`)
        break
      }

      // -----------------------------------------------------------------------
      // Subscription paused by Stripe (pause_collection activated)
      // -----------------------------------------------------------------------
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from('subscriptions')
          .update({
            status: 'paused',
            paused_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('provider_sub_id', subscription.id)

        console.log(`[webhooks/stripe] Subscription paused: ${subscription.id}`)
        break
      }

      // -----------------------------------------------------------------------
      // Subscription updated — detectar reactivación de pausa
      // -----------------------------------------------------------------------
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const subAny = subscription as any

        // Si pause_collection es null/undefined → se reactivó
        const wasResumed = !subAny.pause_collection
        const isNowActive = subscription.status === 'active' || subscription.status === 'trialing'

        if (wasResumed && isNowActive) {
          const subData = subscription as unknown as {
            items: { data: { current_period_start: number; current_period_end: number }[] }
          }
          // Periodos desde el item (API 2026-04-22.dahlia). Ver el insert.
          const item = subData.items.data[0]
          if (!item?.current_period_end) {
            console.error('[webhooks/stripe] Sin periodo al reanudar', subscription.id)
            break
          }
          const rawStart = item.current_period_start
          const rawEnd = item.current_period_end

          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              paused_at: null,
              paused_until: null,
              current_period_start: new Date(rawStart * 1000).toISOString(),
              current_period_end: new Date(rawEnd * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('provider_sub_id', subscription.id)

          console.log(`[webhooks/stripe] Subscription resumed: ${subscription.id}`)
        }
        break
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔴 LOS TRES DE ABAJO NO ESTAN ACTIVADOS EN STRIPE (s36).
      //
      // El codigo esta escrito y probado de tipos, pero Stripe NO los manda
      // hasta que se marquen en el endpoint del dashboard. Mientras no se
      // activen, estos `case` simplemente nunca entran — no rompen nada y no
      // cambian lo que ya llega.
      //
      // Activarlos cambia lo que Stripe envia a PRODUCCION, asi que es una
      // decision aparte. Los eventos exactos van listados en el reporte.
      // ═══════════════════════════════════════════════════════════════

      // Requiere activar `invoice.payment_failed`
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription: string }).subscription
        if (!subscriptionId) break

        const destino = await resolverDestinatario(supabase, subscriptionId)
        if (!destino) break

        // El motivo del rechazo vive en el PaymentIntent, no en la factura.
        const detalle = (invoice as unknown as {
          attempt_count?: number | null
          last_finalization_error?: { code?: string; message?: string } | null
        })

        await trackServer(
          'pago_fallido',
          {
            decline_code: detalle.last_finalization_error?.code ?? undefined,
            motivo: detalle.last_finalization_error?.message ?? undefined,
            intento_n: detalle.attempt_count ?? 1,
          },
          { consent: destino.consent, userId: destino.userId }
        )

        /**
         * `suscripcion_past_due` — sin `dias_en_past_due`, a proposito.
         *
         * 🔴 La base NUNCA entra en ese estado: nadie escribe `past_due`.
         * La UI lo pinta (perfil-client) y el dashboard lo lee, pero no hay
         * un solo UPDATE que lo ponga. Mandar `dias_en_past_due` seria
         * inventar la duracion de un estado que no existe.
         *
         * Lo que si es real: el numero de intento y el motivo del rechazo.
         */
        try {
          const { data: filaSub } = await supabase
            .from('subscriptions')
            .select('plan, price_mxn')
            .eq('provider_sub_id', subscriptionId)
            .maybeSingle()

          await trackServer(
            'suscripcion_past_due',
            {
              intento_n: detalle.attempt_count ?? 1,
              decline_code: detalle.last_finalization_error?.code ?? undefined,
              plan: filaSub?.plan,
              monto: filaSub?.price_mxn,
            },
            { consent: destino.consent, userId: destino.userId }
          )
        } catch (err) {
          console.error('[webhooks/stripe] suscripcion_past_due fallo:', err)
        }

        // 🔴 SOLO se mide. NO se toca `status` ni se manda correo: Stripe
        // reintenta varias veces antes de rendirse, y marcar past_due al
        // primer fallo cortaria el acceso de alguien a quien se le va a
        // cobrar bien en dos dias. Ese comportamiento es otra decision.
        console.log(`[webhooks/stripe] Pago fallido en ${subscriptionId}`)
        break
      }

      // Requiere activar `checkout.session.expired`
      case 'checkout.session.expired': {
        const sesion = event.data.object as Stripe.Checkout.Session
        const userId = sesion.metadata?.user_id
        if (!userId) break

        const { data: usuario } = await supabase
          .from('users')
          .select('cookie_consent_analytics, cookie_consent_marketing')
          .eq('id', userId)
          .maybeSingle()

        const creada = sesion.created ? sesion.created * 1000 : null

        // 🔴 EL UNICO RASTRO POSIBLE DE UN CHECKOUT ABANDONADO. La sesion
        // vive solo en Stripe: sin este evento, alguien que abre el checkout
        // y no paga no deja absolutamente nada en la base. Stripe la expira
        // a las 24h.
        await trackServer(
          'checkout_abandonado',
          {
            plan: sesion.metadata?.plan ?? undefined,
            ciclo: sesion.metadata?.duration ?? undefined,
            minutos_desde_creacion: creada
              ? Math.round((Date.now() - creada) / 60_000)
              : undefined,
            checkout_event_id: sesion.metadata?.checkout_event_id ?? undefined,
          },
          {
            consent: {
              analytics: usuario?.cookie_consent_analytics,
              marketing: usuario?.cookie_consent_marketing,
            },
            userId,
          }
        )
        break
      }

      // Requiere activar `charge.dispute.created`
      case 'charge.dispute.created': {
        const disputa = event.data.object as Stripe.Dispute
        const cargoId = typeof disputa.charge === 'string' ? disputa.charge : disputa.charge?.id
        if (!cargoId) break

        // La disputa no trae la suscripcion: hay que subir por el cargo.
        const cargo = await stripe.charges.retrieve(cargoId)
        const customerId = typeof cargo.customer === 'string' ? cargo.customer : cargo.customer?.id
        if (!customerId) break

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('provider_customer_id', customerId)
          .maybeSingle()
        if (!sub?.user_id) break

        const { data: usuario } = await supabase
          .from('users')
          .select('cookie_consent_analytics, cookie_consent_marketing')
          .eq('id', sub.user_id)
          .maybeSingle()

        await trackServer(
          'chargeback',
          { monto: disputa.amount, motivo: disputa.reason },
          {
            consent: {
              analytics: usuario?.cookie_consent_analytics,
              marketing: usuario?.cookie_consent_marketing,
            },
            userId: sub.user_id,
          }
        )

        // 🔴 SOLO se mide. Una disputa NO cancela la suscripcion aqui: si el
        // caso se gana, habriamos cortado el acceso de un cliente legitimo.
        console.error(`[webhooks/stripe] CONTRACARGO ${disputa.id} — ${disputa.reason}`)
        break
      }

      default:
        // Unhandled event type — safe to ignore
        console.log(`[webhooks/stripe] Unhandled event type: ${event.type}`)
    }

  } catch (error) {
    console.error('[webhooks/stripe] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
