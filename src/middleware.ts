import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/guia', '/perfil', '/admin']

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Try JWT claims first — if missing (token not yet renewed), fall back to DB
  const jwtRole = user?.app_metadata?.user_role as string | undefined
  const jwtOnboardingDone = user?.app_metadata?.onboarding_done as boolean | undefined
  const claimsReady = !!jwtRole && jwtOnboardingDone !== undefined

  let role = jwtRole ?? 'student'
  let onboardingDone = jwtOnboardingDone ?? false

  // Gate legal. Arranca en `true` a propósito: si la consulta al perfil falla,
  // preferimos dejar pasar a un usuario que sí aceptó antes que encerrar a
  // todos en /legal por un error transitorio de red. Solo se pone en false
  // cuando SÍ leímos el perfil y el campo viene vacío.
  let tosAccepted = true
  let parentalPending = false
  let parentalToken: string | null = null

  // Perfil desde la BD. UNA sola consulta para las dos rutas que la necesitan.
  // Antes eran dos bloques idénticos; como /onboarding no está en
  // PROTECTED_PREFIXES, nunca corrían los dos a la vez.
  //
  // 🔴 `role` y `onboardingDone` solo se sobrescriben si el JWT no trae claims,
  // pero `tosAccepted` y `parentalPending` se leen SIEMPRE, fuera de esa
  // condición. Esos dos campos no viven en el token: si algún día se activa el
  // Custom Access Token Hook en Supabase, `claimsReady` pasaría a true, este
  // bloque dejaría de correr bajo la condición vieja y el gate legal se
  // apagaría SIN NINGÚN ERROR VISIBLE. No vuelvas a meterlos dentro del
  // `!claimsReady`.
  if (
    user &&
    !user.is_anonymous &&
    (isProtected(pathname) || pathname.startsWith('/onboarding'))
  ) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, onboarding_done, tos_accepted_at, parental_consent_status, parental_consent_token')
      .eq('id', user.id)
      .single()
    if (profile) {
      if (!claimsReady) {
        role = profile.role ?? 'student'
        onboardingDone = profile.onboarding_done ?? false
      }
      tosAccepted = !!profile.tos_accepted_at
      parentalPending = profile.parental_consent_status === 'pending'
      parentalToken = profile.parental_consent_token ?? null
    }
  }

  // Redirect logged-in admin from landing to /admin
  if (user && !user.is_anonymous && pathname === '/') {
    if (role === 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  // Block protected routes for unauthenticated users
  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect real users away from onboarding if already done
  if (pathname.startsWith('/onboarding') && user && !user.is_anonymous) {
    if (onboardingDone) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'admin' ? '/admin' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Gate legal: sin aceptación de T&C y Aviso no se entra ni al onboarding ni
  // a las rutas protegidas. Cubre el alta con Google OAuth, que nunca pasa por
  // el formulario de /registro.
  //
  // Va ANTES del gate de onboarding a propósito: el onboarding recolecta datos
  // personales (grado, intereses) y el Aviso dice que el consentimiento se
  // recaba "previo al tratamiento".
  //
  // Excluye usuarios anónimos: la landing crea una sesión anónima para que el
  // onboarding pre-registro cargue rápido. Esos todavía no son titulares.
  if (
    user &&
    !user.is_anonymous &&
    !tosAccepted &&
    !pathname.startsWith('/legal') &&
    (isProtected(pathname) || pathname.startsWith('/onboarding'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/legal'
    return NextResponse.redirect(url)
  }

  // Tutor que confirmó su correo pero todavía no firmó la autorización.
  // Se le manda a firmarla, no a una pantalla de espera: es él mismo quien
  // tiene que dar el clic y ya está aquí.
  //
  // Sin token no hay a dónde mandarlo, así que se deja pasar en vez de
  // encerrarlo en un ciclo de redirecciones sin salida.
  if (
    user &&
    !user.is_anonymous &&
    parentalPending &&
    parentalToken &&
    !pathname.startsWith('/autorizar-menor') &&
    !pathname.startsWith('/legal') &&
    (isProtected(pathname) || pathname.startsWith('/onboarding'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = `/autorizar-menor/${parentalToken}`
    return NextResponse.redirect(url)
  }

  if (user && isProtected(pathname)) {
    // Admin bypass
    if (role === 'admin') {
      if (pathname === '/dashboard') {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    // Non-admin trying to access /admin
    if (pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Enforce onboarding for non-admin users
    if (!onboardingDone && !pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Bloquear acceso durante pausa — solo permitir /perfil y /planes
    const PAUSE_ALLOWED = ['/perfil', '/planes']
    const allowedDuringPause = PAUSE_ALLOWED.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )
    if (!allowedDuringPause) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'paused')
        .maybeSingle()

      if (sub) {
        const url = request.nextUrl.clone()
        url.pathname = '/perfil'
        url.searchParams.set('paused', '1')
        return NextResponse.redirect(url)
      }
    }
  }

  // Pass user data to server components via headers
  if (user) {
    supabaseResponse.headers.set('x-user-id', user.id)
    supabaseResponse.headers.set('x-user-role', role)
    supabaseResponse.headers.set('x-onboarding-done', String(onboardingDone))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
