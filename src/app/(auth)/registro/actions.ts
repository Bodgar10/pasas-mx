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

    // Read onboarding data from the request headers (passed from client via form)
    const onboardingRaw = formData.get('onboarding_data') as string | null
    let educationLevel = 'middle_school'
    let grade: number | null = null
    let interests: string[] = []

    if (onboardingRaw) {
      try {
        const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }
        const LEVEL_MAP: Record<string, string> = {
          'Secundaria': 'middle_school',
          'Preparatoria / Bachillerato': 'high_school',
          'Examen de Preparatoria': 'high_school',
          'Examen de Universidad': 'high_school',
        }
        const parsed = JSON.parse(onboardingRaw)
        educationLevel = LEVEL_MAP[parsed.level] ?? 'middle_school'
        grade = parsed.grade ? (GRADE_MAP[parsed.grade] ?? null) : null
        interests = parsed.theme ? [parsed.theme] : []
      } catch { /* ignore parse errors */ }
    }

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
