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
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { PRICE_TO_PLAN } from '@/lib/payments/config'
import { sendEmail } from '@/lib/email/resend'
import { cancellationConfirmedTemplate } from '@/lib/email/templates/cancellation-confirmed'
import { welcomeTemplate } from '@/lib/email/templates/welcome'
import { paymentReceiptTemplate } from '@/lib/email/templates/payment-receipt'
import { sendMetaCapiEvent } from '@/lib/marketing/meta-capi'
import { sendTikTokEvent } from '@/lib/marketing/tiktok-events'
import Stripe from 'stripe'

// Use service role client to bypass RLS in webhook handler
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Missing Supabase service role credentials')
  return createSupabaseClient(url, key)
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
          items: { data: { price: { id: string; unit_amount: number } }[] }
          customer: string
          current_period_start?: number
          current_period_end?: number
          billing_cycle_anchor?: number
        }

        const priceId   = subData.items.data[0]?.price.id
        const planInfo  = PRICE_TO_PLAN[priceId] ?? { plan: 'grade', duration: 'monthly' }
        const priceAmount = subData.items.data[0]?.price.unit_amount ?? 0

        // Calculate period dates — use billing_cycle_anchor as fallback
        const now = Math.floor(Date.now() / 1000)
        const rawStart = subData.current_period_start ?? subData.billing_cycle_anchor ?? now
        const rawEnd   = subData.current_period_end   ?? (now + 30 * 24 * 60 * 60)

        const periodStart = new Date(rawStart * 1000).toISOString()
        const periodEnd   = new Date(rawEnd   * 1000).toISOString()

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
          payment_provider:     'stripe',
          provider_sub_id:      subscriptionId,
          provider_customer_id: subData.customer,
          current_period_start: periodStart,
          current_period_end:   periodEnd,
          trial_ends_at:        trialEndsAt,
          metadata: {
            duration: planInfo.duration,
            price_id: priceId,
          },
        })

        console.log(`[webhooks/stripe] Subscription created for user ${userId}`)

        // Disparar eventos server-side a Meta y TikTok
        try {
          const { data: userForTracking } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()

          if (userForTracking?.email) {
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
            .select('full_name, email')
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
                userName: userProfile.full_name?.split(' ')[0] ?? 'Estudiante',
                planName: planInfo.plan === 'grade' ? 'Estándar' : 'Personalizado',
                trialEndsAt: trialEndsAtFormatted,
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

              // Resolve theme UUID from name
              let themeId: string | null = null
              if (themeName) {
                const { data: themeRow } = await supabase
                  .from('themes')
                  .select('id')
                  .eq('name', themeName)
                  .single()
                themeId = themeRow?.id ?? null
              }

              // Fetch all subjects for this education level and grade
              const { data: subjects } = await supabase
                .from('subjects')
                .select('id')
                .eq('education_level', userProfile.education_level)
                .contains('grades', [userProfile.grade])

              if (subjects && subjects.length > 0) {
                const userSubjectsRows = subjects.map((subject) => ({
                  user_id: userId,
                  subject_id: subject.id,
                  theme_id: themeId,
                  plan_type: 'grade',
                  xp: 0,
                  streak_days: 0,
                  purchased_at: new Date().toISOString(),
                }))

                await supabase.from('user_subjects').insert(userSubjectsRows)
                console.log(`[webhooks/stripe] Created ${userSubjectsRows.length} user_subjects for user ${userId}`)
              }
            }
          } catch (err) {
            console.error('[webhooks/stripe] Error creating user_subjects:', err)
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
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasas-mx.vercel.app'
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
          current_period_start?: number
          current_period_end?: number
          billing_cycle_anchor?: number
        }
        const now = Math.floor(Date.now() / 1000)
        const rawStart = subData.current_period_start ?? subData.billing_cycle_anchor ?? now
        const rawEnd   = subData.current_period_end   ?? (now + 30 * 24 * 60 * 60)
        const periodStart = new Date(rawStart * 1000).toISOString()
        const periodEnd   = new Date(rawEnd   * 1000).toISOString()

        await supabase
          .from('subscriptions')
          .update({
            status:               'active',
            current_period_start: periodStart,
            current_period_end:   periodEnd,
            updated_at:           new Date().toISOString(),
          })
          .eq('provider_sub_id', subscriptionId)

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
            const cycleLabel = subRow?.billing_cycle === 'semestral' ? 'Semestral' : subRow?.billing_cycle === 'annual' ? 'Anual' : 'Mensual'
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

        // Enviar email de confirmación de cancelación
        try {
          if (subRow) {
            const { data: userProfile } = await supabase
              .from('users')
              .select('full_name, email')
              .eq('id', subRow.user_id)
              .single()

            if (userProfile?.email) {
              const subAny = subscription as any
              const accessUntil = new Date((subAny.current_period_end ?? 0) * 1000).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric',
              })

              await sendEmail({
                to: userProfile.email,
                subject: 'Cancelación confirmada — Pasas.mx',
                html: cancellationConfirmedTemplate({
                  userName: userProfile.full_name?.split(' ')[0] ?? 'Estudiante',
                  accessUntil,
                }),
              })
            }
          }
        } catch (emailErr) {
          console.error('[webhooks/stripe] Error sending cancellation email:', emailErr)
        }

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
            current_period_start?: number
            current_period_end?: number
            billing_cycle_anchor?: number
          }
          const now = Math.floor(Date.now() / 1000)
          const rawStart = subData.current_period_start ?? subData.billing_cycle_anchor ?? now
          const rawEnd = subData.current_period_end ?? (now + 30 * 24 * 60 * 60)

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
