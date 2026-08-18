'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { COOKIE_CONSENT_EVENT, permiteAnalytics } from '@/lib/consent'
import { SUPER_PROPS_ANALITICA, type SuperPropAnalitica } from '@/lib/analytics/track'

/**
 * 🔴 El init NO puede volver al ámbito del módulo.
 *
 * Antes corría con solo importar el archivo, antes de que montara nada,
 * así que era imposible condicionarlo al consentimiento. Ahora vive en
 * un efecto que solo corre si la persona aceptó "Análisis de uso".
 *
 * Esto importa más aquí que en GA4 o Clarity: PostHog GRABA SESIONES,
 * y una parte de los usuarios son menores de edad.
 *
 * Consecuencia asumida: quien rechaza no se mide. Los 18 eventos y los
 * funnels dejan de cubrir el 100% del tráfico.
 *
 * `iniciado` es de MÓDULO, no de instancia: así Strict Mode en desarrollo
 * no dispara dos init. El costo es que quien acepta y luego revoca sigue
 * capturado hasta que recargue la página — misma limitación que GA4 y
 * Clarity. Revocar surte efecto en la siguiente carga.
 */
let iniciado = false

function iniciarPostHog() {
  if (iniciado || typeof window === 'undefined') return
  if (!permiteAnalytics()) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
  })
  iniciado = true
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (iniciado && pathname && ph) {
      let url = window.origin + pathname
      if (searchParams?.toString()) url = url + '?' + searchParams.toString()
      ph.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, ph])

  // Slot del alumno activo, leído del `?a=`. Mismo criterio que
  // resolveLearner: sin param es el 1, que es el primario en toda cuenta
  // (upsertPrimaryLearner siempre inserta slot: 1).
  const slotCrudo = searchParams?.get('a')
  const slotActivo = slotCrudo ? Number.parseInt(slotCrudo, 10) : 1
  const slotPedido = Number.isFinite(slotActivo) && slotActivo > 0 ? slotActivo : 1

  useEffect(() => {
    // Sin consentimiento no se ejecuta nada de esto. La guarda va ANTES
    // de createClient(), no dentro del .then(): más abajo ya se habrían
    // disparado getUser() y las dos consultas a `users` y `subscriptions`
    // de alguien que dijo que no.
    if (!iniciado) return

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user && ph) {
        // La lectura va partida en dos porque los datos viven en dos sitios
        // distintos desde la migracion 035: la identidad es de la CUENTA y
        // el progreso es del ALUMNO. Las columnas de `users` que se usaban
        // aqui quedaron legacy — `xp_total` y `streak_days` congeladas el
        // 10-ago, `education_level` y `grade` desincronizadas porque solo
        // se escriben al registrarse y `change-grade` toca solo `learners`.
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, is_test')
          .eq('id', user.id)
          .single()

        // 🔴 Esto describe al alumno ACTIVO, no a la cuenta completa.
        //
        // En una cuenta con tres hijos, PostHog ve al que esté seleccionado
        // con `?a=`. `distinct_id` sigue siendo `user.id`, deliberadamente:
        // es lo único que conserva intacto el histórico de eventos. Pasar a
        // identificar por alumno partiría en dos todas las series previas,
        // así que es una decisión de producto aparte. `learners_count` de
        // abajo es la señal de que hay más alumnos de los que se ven aquí.
        //
        // s32: antes filtraba por `is_primary` y por eso ignoraba el `?a=`.
        // Se resuelve por slot para que `learner_id` sea de verdad el del
        // alumno activo. Sin `?a=` el resultado es idéntico al de antes:
        // el slot 1 ES el primario en toda cuenta.
        const COLUMNAS_ALUMNO = 'id, education_level, grade, xp_total, streak_days, theme_id, themes(name)'

        let { data: alumno } = await supabase
          .from('learners')
          .select(COLUMNAS_ALUMNO)
          .eq('account_user_id', user.id)
          .eq('slot', slotPedido)
          .maybeSingle()

        // Un `?a=` viejo o manipulado apunta a un slot que no existe en esta
        // cuenta. Se cae al primario en vez de quedarse sin identidad, igual
        // que hace resolveLearner en el resto de la app.
        if (!alumno && slotPedido !== 1) {
          const { data: primario } = await supabase
            .from('learners')
            .select(COLUMNAS_ALUMNO)
            .eq('account_user_id', user.id)
            .eq('slot', 1)
            .maybeSingle()
          alumno = primario
        }

        const { count: learnersCount } = await supabase
          .from('learners')
          .select('id', { count: 'exact', head: true })
          .eq('account_user_id', user.id)

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('current_period_end', { ascending: false })
          .limit(1)
          .maybeSingle()

        // `themes` llega como objeto o como arreglo de uno segun como
        // resuelva PostgREST el embed. Se normalizan los dos casos: si esto
        // devolviera undefined, la propiedad `theme` se vaciaria en silencio
        // para todo el mundo y el corte por tematica dejaria de existir.
        const temaEmbed = alumno?.themes as { name?: string } | { name?: string }[] | null | undefined
        const temaNombre = Array.isArray(temaEmbed) ? temaEmbed[0]?.name : temaEmbed?.name

        ph.identify(user.id, {
          email: user.email,
          created_at: user.created_at,
          name: profile?.full_name ?? '',
          education_level: alumno?.education_level ?? '',
          grade: alumno?.grade ?? null,
          // Mismo nombre de propiedad que antes, a proposito: cambia el
          // ORIGEN (era el texto de users.interests[0], ahora es el nombre
          // resuelto de themes) pero no la clave, para no partir en dos el
          // historico de PostHog ni las cohortes ya construidas sobre ella.
          theme: temaNombre ?? '',
          xp_total: alumno?.xp_total ?? 0,
          streak_days: alumno?.streak_days ?? 0,
          learners_count: learnersCount ?? 0,
          plan: subscription?.plan ?? 'no_subscription',
          subscription_status: subscription?.status ?? 'none',
          /**
           * 🔴 LO QUE HACE QUE LOS DASHBOARDS NO MIENTAN.
           *
           * Sale de `users.is_test` (migracion 045). Es la fuente de verdad:
           * la alternativa era una lista de correos en los ajustes del
           * proyecto, y con 25 de 28 cuentas siendo de prueba, esa lista es
           * exactamente lo que alguien olvida actualizar — y el coste de
           * olvidarla es que todos los embudos mientan sin avisar.
           *
           * El "test account filter" del proyecto filtra por ESTA propiedad.
           * Si se recrea el proyecto de PostHog hay que volver a ponerlo:
           * queda anotado en scripts/seed-posthog.ts.
           *
           * Va SOLO en identify() y no como super-propiedad. Ver la nota de
           * abajo.
           */
          is_test: profile?.is_test ?? false,
        })

        // ── SUPER-PROPIEDADES para lib/analytics/track.ts ──────────────
        //
        // 🔴 Este es el ÚNICO sitio del cliente donde la cuenta y el alumno
        // activo están resueltos. Las propiedades de `identify` son de
        // PERSONA y no se pueden leer de vuelta desde un componente; las
        // super-propiedades sí, con `get_property`.
        //
        // Dejarlas aquí es lo que evita que cada llamada a track() abra su
        // propia consulta a Supabase para saber quién es el alumno activo.
        // Además se pegan solas a todo evento de PostHog, que es justo lo
        // que hacía falta para poder cruzar un evento entre plataformas.
        //
        // El tipo obliga a cubrir SUPER_PROPS_ANALITICA entera: si alguien
        // agrega una clave a esa lista y se olvida de aquí, no compila.
        //
        // `learner_id` es el UUID, nunca el slot: el slot es local a la
        // cuenta y no sirve para segmentar entre cuentas.
        const resueltas: Record<SuperPropAnalitica, unknown> = {
          user_id: user.id,
          learner_id: alumno?.id,
          plan: subscription?.plan,
          subscription_status: subscription?.status,
          education_level: alumno?.education_level,
          grade: alumno?.grade,
          theme: temaNombre,
        }

        // Las ausentes se DESREGISTRAN, no se omiten.
        //
        // Las super-propiedades son persistentes: si una clave se queda sin
        // valor y no se toca, PostHog conserva el anterior. Al cambiar de
        // alumno, el nuevo heredaría el grado del anterior y nada lo
        // delataría — exactamente el tipo de dato falso que 2.2 prohíbe.
        const aRegistrar: Partial<Record<SuperPropAnalitica, unknown>> = {}
        for (const clave of SUPER_PROPS_ANALITICA) {
          const valor = resueltas[clave]
          if (valor === undefined || valor === null || valor === '') {
            ph.unregister(clave)
          } else {
            aRegistrar[clave] = valor
          }
        }
        ph.register(aRegistrar)
      }
    })
    // slotPedido en las dependencias: el provider vive en el layout raíz y
    // navegar a `?a=2` NO lo vuelve a montar. Sin esto, cambiar de alumno
    // dejaba las super-propiedades describiendo al anterior.
  }, [ph, slotPedido])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    iniciarPostHog()
    const alCambiar = () => iniciarPostHog()
    window.addEventListener(COOKIE_CONSENT_EVENT, alCambiar)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, alCambiar)
  }, [])

  return (
    <PHProvider client={posthog}>
      {/*
        🔴 EL <Suspense> ES DE PostHogPageView SOLO, Y `children` VA FUERA.

        PostHogPageView llama a useSearchParams —lo necesita para el
        `$current_url` del $pageview y para el `?a=` del alumno activo—, y eso
        hace que Next renderice en cliente todo lo que quede dentro del
        <Suspense> más cercano. Antes el único boundary estaba en el layout
        raíz y envolvía a `children`: el HTML inicial de todo el sitio salía
        vacío. Ver la nota larga en src/app/layout.tsx.

        Devuelve `null`, así que el bailout aquí no cuesta nada. `children`
        sigue dentro de PHProvider —lo necesita para el contexto del cliente—
        pero fuera del boundary, que es lo que importa.
      */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
