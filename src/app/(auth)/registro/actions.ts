'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export type RegistroState = { error: string } | null

export async function registroAction(
  _prevState: RegistroState,
  formData: FormData
): Promise<RegistroState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = (formData.get('full_name') as string)?.trim()

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  if (!fullName) {
    return { error: 'Por favor escribe tu nombre o apodo.' }
  }

  const supabase = await createClient()

  // Check if current user is anonymous — if so, convert instead of creating new
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // TEMP DEBUG — remove after fixing
  const debugOnboarding = formData.get('onboarding_data')
  console.log('=== REGISTRO DEBUG ===')
  console.log('is_anonymous:', currentUser?.is_anonymous)
  console.log('onboarding_data raw:', debugOnboarding)
  console.log('onboarding_data length:', String(debugOnboarding ?? '').length)
  console.log('======================')

  if (currentUser?.is_anonymous) {
    // Convert anonymous user to permanent account
    const { error: updateError } = await supabase.auth.updateUser({
      email,
      password,
      data: { full_name: fullName, onboarding_done: true },
    })

    if (updateError) {
      if (updateError.message.toLowerCase().includes('already registered') ||
          updateError.message.toLowerCase().includes('already been registered')) {
        return { error: 'Este correo ya tiene una cuenta. Inicia sesión.' }
      }
      return { error: 'Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.' }
    }

    // Read onboarding data saved in sessionStorage during onboarding
    const onboardingRaw = formData.get('onboarding_data') as string | null
    const hasOnboardingData = !!onboardingRaw && onboardingRaw.length > 2

    if (!hasOnboardingData) {
      // User registered without going through onboarding first
      // Save name only, keep onboarding_done=false so middleware redirects to onboarding
      await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', currentUser.id)
      redirect('/onboarding')
    }

    try {
      const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }
      const LEVEL_MAP: Record<string, string> = {
        'Secundaria': 'middle_school',
        'Preparatoria / Bachillerato': 'high_school',
        'Examen de Preparatoria': 'high_school',
        'Examen de Universidad': 'high_school',
      }
      const parsed = JSON.parse(onboardingRaw!)
      const educationLevel = LEVEL_MAP[parsed.level] ?? 'middle_school'
      const grade = parsed.grade ? (GRADE_MAP[parsed.grade] ?? null) : null
      const interests = parsed.theme ? [parsed.theme] : []

      // Save all onboarding data + mark done in public.users
      await supabase
        .from('users')
        .update({
          full_name: fullName,
          onboarding_done: true,
          education_level: educationLevel,
          grade,
          interests,
        })
        .eq('id', currentUser.id)
    } catch {
      // Parse error — send to onboarding to complete it properly
      await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', currentUser.id)
      redirect('/onboarding')
    }

    redirect('/planes')
  }

  // No anonymous session — create brand new account
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Este correo ya tiene una cuenta. Inicia sesión.' }
    }
    return { error: 'Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', user.id)
  }

  redirect('/onboarding')
}
