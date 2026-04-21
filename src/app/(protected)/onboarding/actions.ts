'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

type OnboardingData = {
  level: string
  grade: string | null
  theme: string
}

export type OnboardingResult = { error: string } | null

const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }

export async function saveOnboarding(data: OnboardingData): Promise<OnboardingResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    return { error: 'No pudimos verificar tu sesión. Intenta de nuevo.' }
  }

  let educationLevel: 'middle_school' | 'high_school' | null = null
  if (data.level === 'Secundaria') educationLevel = 'middle_school'
  else if (data.level === 'Preparatoria / Bachillerato') educationLevel = 'high_school'

  const grade = data.grade ? (GRADE_MAP[data.grade] ?? null) : null

  await supabase.from('themes').select('id').eq('name', data.theme).maybeSingle()

  const { error: updateError } = await supabase
    .from('users')
    .update({
      education_level: educationLevel,
      grade,
      interests: [data.theme],
      onboarding_done: true,
    })
    .eq('id', user.id)

  if (updateError) {
    return { error: 'No pudimos guardar tu información. Intenta de nuevo.' }
  }

  await supabase.auth.updateUser({ data: { onboarding_done: true } })

  redirect('/dashboard')
}
