'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export type RegistroState = { error: string } | { stripeUrl: string } | null

const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }
const LEVEL_MAP: Record<string, string> = {
  'Secundaria': 'middle_school',
  'Preparatoria / Bachillerato': 'high_school',
  'Examen de Preparatoria': 'high_school',
  'Examen de Universidad': 'high_school',
}

const PRICE_IDS: Record<string, Record<string, string>> = {
  estandar: {
    monthly: 'price_1TUTXmC61EHnoMUsCTw1FOcH',
    quarterly: 'price_1TUThlC61EHnoMUsOEZRxQ0L',
    biannual: 'price_1TUTiIC61EHnoMUszAZ1DXQw',
  },
  personalizado: {
    monthly: 'price_1TUTijC61EHnoMUsaksUSfwR',
    quarterly: 'price_1TUTj5C61EHnoMUsohVLpLFn',
    biannual: 'price_1TUTjTC61EHnoMUsvwLZnk4q',
  },
}

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

  console.log('[registro] onboarding_data:', onboardingRaw)
  console.log('[registro] pending_plan:', pendingPlan)
  console.log('[registro] pending_duration:', pendingDuration)

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }
  if (!fullName) {
    return { error: 'Por favor escribe tu nombre o apodo.' }
  }

  const supabase = await createClient()

  // Always create a brand new account — no anonymous session
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return { error: 'Este correo ya tiene una cuenta. Inicia sesión.' }
    }
    return { error: 'Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No pudimos verificar tu cuenta. Inténtalo de nuevo.' }

  // Use service role to guarantee the update completes before redirect
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Parse onboarding data if available
  let profileUpdate: Record<string, unknown> = {
    full_name: fullName,
    onboarding_done: true,
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

  await serviceClient
    .from('users')
    .update(profileUpdate)
    .eq('id', user.id)

  // Update JWT metadata so middleware reads onboarding_done: true immediately
  await supabase.auth.updateUser({
    data: { onboarding_done: true },
  })

  // If user had a pending plan, create Stripe session and return the URL
  if (pendingPlan && pendingDuration) {
    const priceId = PRICE_IDS[pendingPlan]?.[pendingDuration]
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
        })
        if (session.url) {
          return { stripeUrl: session.url }
        }
      } catch {
        // Stripe failed — send to planes so user can retry payment
      }
    }
  }

  // No pending plan — go to dashboard
  return { stripeUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` }
}
