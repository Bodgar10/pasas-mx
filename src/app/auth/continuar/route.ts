import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { destinoTrasEntrar } from '@/lib/auth/destino-tras-entrar'

/**
 * /auth/continuar — a dónde ir con la sesión que YA existe (s49).
 *
 * Lo usa el "Ya verifiqué mi correo" del registro: el navegador entra con la
 * contraseña que la persona acaba de escribir y viene aquí para que el
 * servidor decida el destino (autorización de tutor, /bienvenida con el plan
 * y la promo, o /dashboard). Sin sesión, a /login.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.is_anonymous) {
    return NextResponse.redirect(`${origin}/login`)
  }

  return NextResponse.redirect(`${origin}${await destinoTrasEntrar(user.id, user.email)}`)
}
