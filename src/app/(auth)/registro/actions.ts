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

    // Ensure onboarding_done=true and full_name in public.users
    // This is critical — middleware reads onboarding_done from DB as fallback
    await supabase
      .from('users')
      .update({ full_name: fullName, onboarding_done: true })
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
