import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/guia', '/perfil', '/admin']

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

// Read claims from JWT — no Supabase query needed
function getClaimsFromSession(user: { app_metadata?: Record<string, unknown> } | null) {
  if (!user) return { role: null, onboardingDone: false }
  // Custom claims are in app_metadata after the hook runs
  const role = (user.app_metadata?.user_role as string) ?? 'student'
  const onboardingDone = (user.app_metadata?.onboarding_done as boolean) ?? false
  return { role, onboardingDone }
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

  // Single auth call — reads from cookie, no extra DB query
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Read role and onboarding_done from JWT claims — 0 extra queries
  const { role, onboardingDone } = getClaimsFromSession(user)

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
  }

  // Pass user_id to server components via header — avoids duplicate getUser() calls
  if (user) {
    supabaseResponse.headers.set('x-user-id', user.id)
    supabaseResponse.headers.set('x-user-role', role ?? 'student')
    supabaseResponse.headers.set('x-onboarding-done', String(onboardingDone))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
