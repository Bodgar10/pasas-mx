'use server'

import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { buildAcquisitionSource } from '@/lib/audience-detection'
import { parseConsent } from '@/lib/legal'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { STRIPE_PRICES } from '@/lib/payments/config'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

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
    let profileEarly: Record<string, unknown> = {
      full_name: fullName,
      ...consent.fields,
      onboarding_done: false, // se completa en auth/callback al verificar
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

    // Guardar pending_checkout en BD para sobrevivir el redirect de verificación
    if (pendingPlan && pendingDuration) {
      profileEarly.pending_checkout = { plan: pendingPlan, duration: pendingDuration }
    }

    const { error: earlyUpdateError } = await serviceClientEarly
      .from('users')
      .update(profileEarly)
      .eq('id', user.id)

    if (earlyUpdateError) {
      console.error('[registro] No se pudo guardar el perfil:', earlyUpdateError)
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
      try {
        const stripe = (await import('stripe')).default
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!)
        const session = await stripeClient.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          customer_email: email,
          success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?checkout=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/planes`,
          metadata: { user_id: user.id, plan: pendingPlan },
          subscription_data: {
            trial_period_days: 7,
            metadata: { user_id: user.id, plan: pendingPlan },
          },
          payment_method_collection: 'always',
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
