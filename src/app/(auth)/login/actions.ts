'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { destinoTrasEntrar } from '@/lib/auth/destino-tras-entrar'

export type LoginState = { error: string } | null

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Correo sin confirmar: decirlo, no confundirlo con una contraseña mala.
    if (error.code === 'email_not_confirmed') {
      return { error: 'Todavía no confirmas tu correo. Abre el enlace que te mandamos y vuelve a entrar.' }
    }
    return { error: 'Correo o contraseña incorrectos. Inténtalo de nuevo.' }
  }

  // s49: ya no siempre /dashboard. Quien dejó un pago pendiente (o una
  // autorización de tutor) sigue donde iba. Ver destino-tras-entrar.ts.
  redirect(await destinoTrasEntrar(data.user.id, data.user.email))
}
