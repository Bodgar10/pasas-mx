'use server'

import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { buildAcquisitionSource } from '@/lib/audience-detection'
import { parseConsent } from '@/lib/legal'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { STRIPE_PRICES } from '@/lib/payments/config'
import { upsertPrimaryLearner } from '@/lib/learners'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import {
  MENSAJE_PROMO_NO_DISPONIBLE,
  PromoNoDisponibleError,
  resolvePromoParaCheckout,
} from '@/lib/payments/promo-checkout'

export type RegistroState =
  | { error: string }
  | { stripeUrl: string }
  | { emailSent: true; email: string }
  | null

const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }
const LEVEL_MAP: Record<string, string> = {
  'Secundaria': 'middle_school',
  'Preparatoria / Bachillerato': 'high_school',
  'Examen de Preparatoria': 'high_school',
  'Examen de Universidad': 'high_school',
}

// Price IDs centralizados en src/lib/payments/config.ts

export async function registroAction(
  _prevState: RegistroState,
  formData: FormData
): Promise<RegistroState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = (formData.get('full_name') as string)?.trim()
  const onboardingRaw = formData.get('onboarding_data') as string | null
  const pendingPlan = formData.get('pending_plan') as string | null
  const pendingDuration = formData.get('pending_duration') as string | null
  const utmRaw = formData.get('utm_data') as string | null
  const cookieConsentRaw = formData.get('cookie_consent') as string | null
  // Slug de campaña que venía en sessionStorage. Sin validar: lo valida
  // resolvePromoParaCheckout contra la fila y contra Stripe.
  const promoSlugRaw = formData.get('promo_slug') as string | null


  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }
  if (!fullName) {
    return { error: 'Por favor escribe tu nombre o apodo.' }
  }

  // Consentimiento legal — validación y armado de campos en src/lib/legal.ts
  const headersList = await headers()
  const clientIp =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    null

  const consent = parseConsent(formData, clientIp, email)
  if (!consent.ok) {
    return { error: consent.error }
  }

  /**
   * Consentimiento de cookies → base, para que haya prueba.
   *
   * 🔴 La IP se toma de `clientIp`, que ya se calculó arriba desde los
   * headers. NO se acepta del cliente: sería falsificable y no probaría nada.
   *
   * `at` es la fecha del BANNER, no la del registro: es cuándo la persona
   * realmente consintió, posiblemente días antes.
   *
   * Si nunca contestó el banner, las columnas quedan en NULL — que es
   * distinto de `false` y hay que poder distinguirlo.
   */
  let cookieFields: Record<string, unknown> = {}
  if (cookieConsentRaw) {
    try {
      const c = JSON.parse(cookieConsentRaw)
      if (typeof c.analytics === 'boolean' && typeof c.marketing === 'boolean') {
        cookieFields = {
          cookie_consent_analytics: c.analytics,
          cookie_consent_marketing: c.marketing,
          cookie_consent_at: c.at ?? new Date().toISOString(),
          cookie_consent_ip: clientIp,
          cookie_consent_version: c.version ?? null,
        }
      }
    } catch { /* malformado — se queda sin registrar, no se inventa */ }
  }

  const supabase = await createClient()

  // Always create a brand new account — no anonymous session
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return { error: 'Este correo ya tiene una cuenta. Inicia sesión.' }
    }
    return { error: 'Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.' }
  }

  const user = signUpData?.user
  if (!user) return { error: 'No pudimos crear tu cuenta. Inténtalo de nuevo.' }

  // Parsear UTMs si vienen del formulario
  let acquisitionSource = null
  if (utmRaw) {
    try {
      const utmParsed = JSON.parse(utmRaw)
      acquisitionSource = buildAcquisitionSource(
        utmParsed,
        utmParsed.referrer,
        utmParsed.landing_url
      )
    } catch { /* UTM malformed — ignorar */ }
  }

  // Si el email aún no está confirmado, mostrar pantalla de verificación
  if (!user.email_confirmed_at) {
    const serviceClientEarly = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parsear onboarding data para guardar todo el perfil ya
    /**
     * 🔴 `onboarding_done` va en TRUE aquí, no en auth/callback.
     *
     * En este punto el onboarding YA está completo: nivel, grado y temática
     * se guardan unas líneas más abajo, en este mismo update. No queda nada
     * que llenar.
     *
     * Esperar al callback es lo que rompía todo: el callback tiene varias
     * salidas antes de llegar a escribir el flag —redirige a /autorizar-menor
     * cuando falta la firma del tutor, o el enlace del correo se consume por
     * el prefetch del cliente de correo—. Cualquiera de esas deja el flag en
     * false PARA SIEMPRE, con los datos ya guardados, y el usuario entra en
     * un ciclo entre /onboarding y /dashboard del que no sale ni pagando.
     *
     * No revertir a false "hasta verificar". Verificar el correo y completar
     * el onboarding son dos cosas distintas: la primera la gobierna
     * `email_confirmed_at` de Supabase, no esta columna.
     */
    let profileEarly: Record<string, unknown> = {
      full_name: fullName,
      ...consent.fields,
      ...cookieFields,
      onboarding_done: true,
    }

    if (onboardingRaw && onboardingRaw.length > 2) {
      try {
        const parsed = JSON.parse(onboardingRaw)
        profileEarly = {
          ...profileEarly,
          education_level: LEVEL_MAP[parsed.level] ?? 'middle_school',
          grade: parsed.grade ? (GRADE_MAP[parsed.grade] ?? null) : null,
          interests: parsed.theme ? [parsed.theme] : [],
        }
      } catch { /* ignorar */ }
    }

    if (acquisitionSource) {
      profileEarly.acquisition_source = acquisitionSource
    }

    /**
     * pending_checkout en BD para sobrevivir el redirect de verificación.
     *
     * 🔴 EL SLUG DE LA CAMPAÑA VA AQUÍ DENTRO, no en sessionStorage. Esta rama
     * devuelve { emailSent } y no llega nunca al sessions.create de abajo: el
     * cobro ocurre después, cuando la persona vuelve desde el correo. Y el
     * enlace del correo abre OTRA PESTAÑA — sessionStorage es por pestaña, así
     * que ahí el slug no existe ni habiéndose guardado. La base es el único
     * lugar que sobrevive a las dos cosas.
     *
     * 🔴 SOLO el slug. Nunca el precio, el descuento ni el copy: se resuelven
     * contra promo_campaigns en el momento del cobro, para que apagar la
     * campaña desde /admin surta efecto incluso en alguien que se registró
     * mientras estaba prendida. Es la misma regla que PromoPersistence.
     *
     * Se normaliza igual que en PromoPersistence (trim + minúsculas) porque el
     * slug es la PK de promo_campaigns y ahí vive en minúsculas. La clave no
     * se escribe si no hay slug: un `promo_slug: ''` en el jsonb se leería
     * como campaña vacía en vez de como ausencia.
     */
    if (pendingPlan && pendingDuration) {
      const promoSlug = promoSlugRaw?.trim().toLowerCase() || null
      profileEarly.pending_checkout = {
        plan: pendingPlan,
        duration: pendingDuration,
        ...(promoSlug ? { promo_slug: promoSlug } : {}),
      }
    }

    const { error: earlyUpdateError } = await serviceClientEarly
      .from('users')
      .update(profileEarly)
      .eq('id', user.id)

    if (earlyUpdateError) {
      console.error('[registro] No se pudo guardar el perfil:', earlyUpdateError)
      return { error: 'No pudimos guardar tus datos. Inténtalo de nuevo.' }
    }

    // El alumno se crea AQUI, no en auth/callback. El callback tiene
    // varias salidas antes de llegar al final —redirige a
    // /autorizar-menor, o el enlace se consume por el prefetch del
    // cliente de correo— y cualquiera dejaria la cuenta sin alumno.
    // Es exactamente el error que costo cerrar el loop de onboarding.
    const learnerEarly = await upsertPrimaryLearner(serviceClientEarly, {
      userId: user.id,
      displayName: fullName,
      educationLevel: (profileEarly.education_level as string) ?? null,
      grade: (profileEarly.grade as number) ?? null,
      themeName: (profileEarly.interests as string[] | undefined)?.[0] ?? null,
    })

    if (!learnerEarly) {
      console.error('[registro] No se pudo crear el alumno de', user.id)
      return { error: 'No pudimos guardar tus datos. Inténtalo de nuevo.' }
    }

    return { emailSent: true, email }
  }

  // Use service role to guarantee the update completes before redirect
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Parse onboarding data if available
  let profileUpdate: Record<string, unknown> = {
    full_name: fullName,
    ...consent.fields,
    ...cookieFields,
    onboarding_done: true,
    ...(acquisitionSource ? { acquisition_source: acquisitionSource } : {}),
  }

  if (onboardingRaw && onboardingRaw.length > 2) {
    try {
      const parsed = JSON.parse(onboardingRaw)
      profileUpdate = {
        ...profileUpdate,
        education_level: LEVEL_MAP[parsed.level] ?? 'middle_school',
        grade: parsed.grade ? (GRADE_MAP[parsed.grade] ?? null) : null,
        interests: parsed.theme ? [parsed.theme] : [],
      }
    } catch {
      // onboarding data malformed — still mark done, user can update profile later
    }
  }

  const { error: profileUpdateError } = await serviceClient
    .from('users')
    .update(profileUpdate)
    .eq('id', user.id)

  if (profileUpdateError) {
    console.error('[registro] No se pudo guardar el perfil:', profileUpdateError)
    return { error: 'No pudimos guardar tus datos. Inténtalo de nuevo.' }
  }

  const learnerConfirmado = await upsertPrimaryLearner(serviceClient, {
    userId: user.id,
    displayName: fullName,
    educationLevel: (profileUpdate.education_level as string) ?? null,
    grade: (profileUpdate.grade as number) ?? null,
    themeName: (profileUpdate.interests as string[] | undefined)?.[0] ?? null,
  })

  if (!learnerConfirmado) {
    console.error('[registro] No se pudo crear el alumno de', user.id)
    return { error: 'No pudimos guardar tus datos. Inténtalo de nuevo.' }
  }

  // Update JWT metadata so middleware reads onboarding_done: true immediately
  await supabase.auth.updateUser({
    data: { onboarding_done: true },
  })

  // If user had a pending plan, create Stripe session and return the URL
  // Este camino crea la sesión de Stripe DIRECTO, sin pasar por
  // /api/checkout/create-session, así que el candado de ese endpoint no
  // lo cubre. El pendingPlan viene de sessionStorage: un navegador con
  // un valor viejo todavía traería 'personalizado_v2'.
  const planOculto =
    !FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && pendingPlan === 'personalizado_v2'

  if (pendingPlan && pendingDuration && !planOculto) {
    const priceId = (STRIPE_PRICES as Record<string, Record<string, string>>)[pendingPlan]?.[pendingDuration]
    if (priceId) {
      /**
       * Promoción, resuelta FUERA del try/catch de abajo.
       *
       * 🔴 Ese catch se traga cualquier error para mandar al usuario a
       * /planes. Si la resolución de la promo viviera dentro, un
       * PromoNoDisponibleError se perdería ahí y se abriría el checkout a
       * precio de lista después de que la persona leyó "$1".
       *
       * `pendingDuration` trae el vocabulario de la BASE ('monthly' |
       * 'semestral' | 'annual') porque viene del sessionStorage que escribe
       * /planes. La conversión a display vive dentro de
       * resolvePromoParaCheckout — aquí no se traduce nada.
       */
      let promoResuelta: Awaited<ReturnType<typeof resolvePromoParaCheckout>> = null
      try {
        // `false` fijo: la cuenta se acaba de crear tres líneas más arriba con
        // signUp, así que no puede tener una suscripción previa. No es un
        // atajo — es el único valor posible en esta rama.
        promoResuelta = await resolvePromoParaCheckout(
          promoSlugRaw,
          pendingPlan,
          pendingDuration,
          false
        )
      } catch (promoError) {
        if (promoError instanceof PromoNoDisponibleError) {
          console.error('[registro]', promoError.message)
          // La cuenta YA existe a estas alturas, así que el mensaje tiene que
          // decirlo: sin esa frase la persona intentaría registrarse otra vez
          // y chocaría con "este correo ya tiene una cuenta".
          return {
            error: `${MENSAJE_PROMO_NO_DISPONIBLE}. Tu cuenta ya quedó creada: inicia sesión y elige tu plan.`,
          }
        }
        throw promoError
      }

      // Record<string, string> explícito: la rama `{}` del ternario inferiría
      // `promo_slug?: undefined`, que no encaja en el MetadataParam de Stripe.
      const metadataPromo: Record<string, string> = promoResuelta
        ? { promo_slug: promoResuelta.promo.slug }
        : {}

      try {
        const stripe = (await import('stripe')).default
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!)
        const session = await stripeClient.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          customer_email: email,
          success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?checkout=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/planes`,
          metadata: { user_id: user.id, plan: pendingPlan, ...metadataPromo },
          subscription_data: {
            trial_period_days: 7,
            metadata: { user_id: user.id, plan: pendingPlan, ...metadataPromo },
          },
          payment_method_collection: 'always',
          // 🔴 Excluyentes: Stripe rechaza la sesión si van los dos. Mismo
          // spread ternario que en /api/checkout/create-session.
          //
          // Esta puerta no tenía `allow_promotion_codes`, así que lo gana
          // ahora cuando no hay campaña: el código de escuela tecleado a mano
          // por fin funciona también en el alta de tráfico frío.
          ...(promoResuelta
            ? { discounts: [{ promotion_code: promoResuelta.promotionCodeId }] }
            : { allow_promotion_codes: true }),
        })
        if (session.url) {
          return { stripeUrl: session.url }
        }
      } catch {
        // Stripe failed — send to planes so user can retry payment
      }
    }
  }

  // No pending plan — mostrar pantalla de verificación de email
  return { emailSent: true, email }
}
