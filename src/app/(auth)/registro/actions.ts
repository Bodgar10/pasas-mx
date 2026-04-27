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
