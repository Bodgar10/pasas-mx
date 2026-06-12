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

  // Fallback: query DB if JWT claims not yet populated (existing users before hook)
  if (user && !user.is_anonymous && !claimsReady && isProtected(pathname)) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, onboarding_done')
      .eq('id', user.id)
      .single()
    if (profile) {
      role = profile.role ?? 'student'
      onboardingDone = profile.onboarding_done ?? false
    }
  }

  // Same fallback for onboarding redirect check
  if (user && !user.is_anonymous && !claimsReady && pathname.startsWith('/onboarding')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, onboarding_done')
      .eq('id', user.id)
      .single()
    if (profile) {
      role = profile.role ?? 'student'
      onboardingDone = profile.onboarding_done ?? false
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
