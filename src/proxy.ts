import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/guia', '/perfil', '/admin']

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

// Rutas que NO leen la sesión ni aquí ni en su propio código: este proxy solo
// decide algo con `user` en '/', en PROTECTED_PREFIXES y en /onboarding, y estas
// rutas usan el cliente con service role (sin cookies) o no tocan Supabase.
// Para ellas el proxy solo hacía la ida y vuelta a Supabase Auth para
// refrescar un token que nadie iba a leer. Salen antes de crear el cliente.
//
// 🔴 Antes de agregar una ruta aquí, confirma que NO llama a
// `@/utils/supabase/server` ni a `auth.getUser()`. Si la lee y el proxy no
// refrescó, el Server Component refresca el token en memoria SIN poder guardar
// la cookie (su setAll es no-op) y el refresh token viejo queda quemado: la
// persona termina deslogueada sin ningún error visible.
//
// 🔴 /api/horde (la horda con sesión) NO está: solo /api/horda-publica.
const RUTAS_SIN_SESION_EXACTAS = ['/api/m', '/api/promo', '/api/preview-stats', '/arcade']
const RUTAS_SIN_SESION_PREFIJOS = [
  '/api/m/',
  '/api/webhooks/',
  '/api/cron/',
  '/api/arcade/',
  '/api/horda-publica/',
  '/arcade/', // incluye opengraph-image y /arcade/r/[codigo]/imagen|historia
  '/horda/',
  '/unete/', // solo redirige a /onboarding, y ahí sí pasa por el proxy
]

function rutaSinSesion(pathname: string) {
  return (
    RUTAS_SIN_SESION_EXACTAS.includes(pathname) ||
    RUTAS_SIN_SESION_PREFIJOS.some((p) => pathname.startsWith(p)) ||
    // Imagen OG de cualquier segmento (Next le puede colgar un sufijo).
    /\/opengraph-image(?:-[^/]*)?$/.test(pathname)
  )
}

// Next 16: el archivo `middleware` pasó a llamarse `proxy` y la función
// exportada también (ver node_modules/next/dist/docs/.../file-conventions/proxy.md).
// Corre en Node.js por defecto; `runtime` no se puede configurar aquí.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (rutaSinSesion(pathname)) {
    return NextResponse.next()
  }

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

  // getClaims() en vez de getUser(): con llave de firma asimétrica (el proyecto
  // publica una ES256 en /auth/v1/.well-known/jwks.json) verifica la firma del
  // JWT localmente con la JWKS en caché (10 min, global al proceso) y se ahorra
  // la ida y vuelta a Supabase Auth. Si el token es HS256 o no hay WebCrypto,
  // auth-js cae solo a getUser(token): mismo costo que antes, nunca menos
  // seguro. Igual que getUser(), primero pasa por getSession(), así que el
  // refresco del token (y el setAll de cookies) sigue ocurriendo aquí.
  //
  // 🔴 Diferencia real: un token revocado (logout en otro dispositivo, usuario
  // borrado) sigue "válido" aquí hasta que expira (≤1 h). Este proxy solo
  // enruta; la autorización de datos la hace RLS, que tampoco consulta Auth.
  //
  // 🔴 `app_metadata` ahora sale del TOKEN, no de la fila de auth.users. Hoy da
  // igual: nadie escribe `user_role` ni `onboarding_done` en app_metadata, así
  // que `claimsReady` siempre es false y role/onboarding salen de la base. Si
  // algún día se escriben, aquí se verán hasta el siguiente refresco del token.
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const user = claims
    ? {
        id: claims.sub,
        is_anonymous: claims.is_anonymous === true,
        app_metadata: claims.app_metadata,
      }
    : null

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

  // Bloquear acceso durante pausa — solo permitir /perfil y /planes
  const PAUSE_ALLOWED = ['/perfil', '/planes']
  const allowedDuringPause = PAUSE_ALLOWED.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
  const consultarPausa = (userId: string) =>
    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'paused')
      .maybeSingle()
  // `undefined` = no se precargó (y se consulta abajo, como antes, si se llega).
  let pausaPrecargada: { status: string } | null | undefined

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
    // La consulta de pausa solo necesita user.id, así que va en el mismo
    // Promise.all en vez de esperar al perfil. Se precarga SOLO donde el gate de
    // pausa puede llegar a correr: ruta protegida, fuera de /perfil|/planes y
    // fuera de /admin (el no-admin ahí se redirige y el admin sale antes).
    // 🔴 Si el JWT ya dice admin tampoco se pide: el admin nunca llega al gate.
    // Costo aceptado: se pide aunque luego un gate anterior (legal, tutor,
    // onboarding) redirija; es una lectura por índice y ahorra un viaje en serie
    // al caso común.
    const precargarPausa =
      isProtected(pathname) &&
      !allowedDuringPause &&
      !pathname.startsWith('/admin') &&
      !(claimsReady && jwtRole === 'admin')

    const [{ data: profile }, { data: learner }, pausa] = await Promise.all([
      supabase
        .from('users')
        .select('role, onboarding_done, tos_accepted_at, parental_consent_status, parental_consent_token')
        .eq('id', user.id)
        .single(),
      // 🔴 Nivel y grado viven en `learners`, no en `users`. Las columnas
      // de `users` quedaron como LEGACY tras la migracion 035 y ya no se
      // escriben: leerlas aqui congelaria el gate en el valor del backfill.
      supabase
        .from('learners')
        .select('education_level, grade')
        .eq('account_user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle(),
      precargarPausa ? consultarPausa(user.id) : null,
    ])
    if (pausa) pausaPrecargada = pausa.data
    if (profile) {
      if (!claimsReady) {
        role = profile.role ?? 'student'
      }

      // 🔴 `onboarding_done` NO es la fuente de verdad: es una caché.
      //
      // Solo lo escribe auth/callback, y el callback puede salirse antes de
      // llegar a esa rama —por ejemplo al redirigir a /autorizar-menor cuando
      // falta la firma del tutor—. Si eso pasa, el flag se queda en false para
      // siempre aunque los datos ya estén guardados, y el usuario entra en un
      // ciclo: middleware → /onboarding → no hay nada que llenar → dashboard →
      // middleware. Pasó con una cuenta que ya había pagado.
      //
      // La verdad son los datos. Si hay nivel y grado, el onboarding está
      // hecho, lo diga el flag o no.
      //
      // 🔴 VA FUERA DEL `!claimsReady`, igual que tosAccepted y parentalPending.
      // Estaba DENTRO y por eso el arreglo de la s26 no servía: cuando el JWT
      // trae claims, el bloque entero se salta y onboardingDone se queda con
      // el `false` del token, sin llegar nunca a mirar los datos reales.
      // El JWT puede traer un flag viejo; la base no.
      // `grade != null` con `!=` es a proposito: cubre null y undefined
      // pero NO el 0.
      const datosCompletos = !!learner?.education_level && learner?.grade != null
      onboardingDone = (profile.onboarding_done ?? false) || datosCompletos

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

    // Gate de pausa. Normalmente ya viene precargado del Promise.all de arriba;
    // la consulta aquí es solo el respaldo para casos que no pasaron por ese
    // bloque (p. ej. sesión anónima), para no cambiar el comportamiento.
    if (!allowedDuringPause) {
      const sub =
        pausaPrecargada !== undefined
          ? pausaPrecargada
          : (await consultarPausa(user.id)).data

      if (sub) {
        const url = request.nextUrl.clone()
        url.pathname = '/perfil'
        url.searchParams.set('paused', '1')
        return NextResponse.redirect(url)
      }
    }
  }

  // 🔴 Aquí se ponían x-user-id / x-user-role / x-onboarding-done en la
  // RESPUESTA. Eso no llega a los Server Components (headers() lee los del
  // request) y sí se filtraba al navegador. Nadie los leía —el helper
  // getUserIdFromHeader no tiene usos—, así que se quitaron. Si algún día hacen
  // falta, van por NextResponse.next({ request: { headers } }), no así.

  return supabaseResponse
}

// Fuera del proxy por completo: archivos estáticos y de metadatos, que nunca
// leen la sesión. Las RUTAS sin sesión se filtran en código (rutaSinSesion),
// donde se pueden leer y probar; aquí solo nombres de archivo y extensiones.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|woff2)$).*)',
  ],
}
