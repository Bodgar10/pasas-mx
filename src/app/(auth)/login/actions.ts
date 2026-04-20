'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export type LoginState = { error: string } | null

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Correo o contraseña incorrectos. Inténtalo de nuevo.' }
  }

  redirect('/dashboard')
}
