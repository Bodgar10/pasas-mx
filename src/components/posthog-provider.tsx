'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, useEffect, useRef, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { COOKIE_CONSENT_EVENT, permiteAnalytics } from '@/lib/consent'
import { SUPER_PROPS_ANALITICA, type SuperPropAnalitica } from '@/lib/analytics/track'
import { esInterno, sincronizarInterno } from '@/lib/analytics/interno'

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

/**
 * 🔴 EL INIT TIENE QUE AVISAR, NO SOLO OCURRIR — s33.
 *
 * `iniciado` es una variable de modulo: cambiarla no re-renderiza nada.
 * Y los efectos de React corren de HIJO a PADRE, asi que el efecto de
 * PostHogPageView —que es hijo— ya habia corrido y se habia saltado con
 * `if (!iniciado)` cuando el efecto del provider llamaba a este init.
 *
 * Consecuencia medida entre el 17-ago y el 23-sep: 31 de 38 sesiones que
 * tocaron `/` NO tienen `$pageview`. El de la primera carga se perdia
 * SIEMPRE, y el identify tambien; solo volvian a la vida al cambiar de
 * ruta, que es lo que hacia que una visita entrada por la landing
 * apareciera empezando en /onboarding.
 *
 * Este pequeño store arregla las dos: quien depende del init se suscribe
 * con useSyncExternalStore y se entera en cuanto ocurre —en la primera
 * carga con consentimiento previo, o en el instante en que la persona
 * acepta el banner.
 */
const oyentesInit = new Set<() => void>()

function suscribirInit(avisar: () => void): () => void {
  oyentesInit.add(avisar)
  return () => {
    oyentesInit.delete(avisar)
  }
}

function leerIniciado(): boolean {
  return iniciado
}

/** En el servidor nunca hay init: sin esto, hidratacion desalineada. */
function leerIniciadoEnServidor(): boolean {
  return false
}

function iniciarPostHog() {
  if (iniciado || typeof window === 'undefined') return
  if (!permiteAnalytics()) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    // Explicito aunque sea el default: este archivo es el unico sitio
    // donde se puede apagar, y dejarlo escrito evita que alguien lo
    // apague creyendo que ya estaba apagado. Nada del codigo lo toca.
    autocapture: true,
    session_recording: {
      /**
       * 🔴 `true` desde s33, antes `false`.
       *
       * Una parte de los usuarios son MENORES y el embudo publico pide
       * correo, contraseña, nombre y fecha de nacimiento. Con
       * `maskAllInputs: false` todo eso quedaba legible en la grabacion.
       *
       * Va global y no por ruta a proposito: `posthog.init` corre una
       * sola vez por carga, asi que "enmascarar solo en el embudo"
       * exigiria un set_config en cada navegacion — mas piezas moviles
       * para acabar protegiendo MENOS. El area protegida queda mas
       * enmascarada que antes, nunca menos.
       */
      maskAllInputs: true,
      maskInputOptions: { password: true },
      // Para el texto que NO es un input y aun asi no debe grabarse
      // (un correo ya pintado en pantalla, el nombre del alumno).
      maskTextSelector: '[data-ph-mask]',
    },
  })

  /**
   * Trafico interno. Va DESPUES del init —antes, `register` no existe— y
   * antes de cualquier captura, para que hasta el $pageview de la primera
   * carga salga marcado.
   */
  if (sincronizarInterno()) {
    posthog.register({ interno: true })
  }

  iniciado = true
  for (const avisar of oyentesInit) avisar()
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  /**
   * `iniciado` como ESTADO, no como variable suelta. Es lo que hace que
   * este efecto vuelva a correr cuando el init ocurre despues del primer
   * render — el caso que perdia el $pageview de la primera carga.
   */
  const phIniciado = useSyncExternalStore(
    suscribirInit,
    leerIniciado,
    leerIniciadoEnServidor
  )

  /**
   * Ultima URL capturada. Sin esto, el efecto correria dos veces por la
   * misma URL —una al montar y otra al enterarse del init— y cada carga
   * dejaria dos $pageview identicos. La URL lleva los parametros
   * (`utm_*`, `promo`, `fbclid`) porque de ahi sale el first-touch.
   */
  const ultimaUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!phIniciado || !pathname || !ph) return

    let url = window.origin + pathname
    const query = searchParams?.toString()
    if (query) url = url + '?' + query

    if (ultimaUrl.current === url) return
    ultimaUrl.current = url

    ph.capture('$pageview', { $current_url: url })
  }, [phIniciado, pathname, searchParams, ph])

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
    if (!phIniciado) return

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

        /**
         * `is_test` tambien como propiedad de PERSONA explicita, y `interno`
         * como super-propiedad — s33.
         *
         * No es lo mismo que la linea de arriba: las propiedades de
         * `identify` se fijan al crear el perfil y el filtro de "internal
         * and test users" de PostHog corta por persona, mientras que
         * `interno` viaja EN CADA EVENTO, tambien en los que ocurren antes
         * de que la sesion exista. Hacen falta las dos: una cubre a la
         * cuenta, la otra al dispositivo.
         */
        const cuentaDePrueba = profile?.is_test === true
        ph.setPersonProperties({ is_test: cuentaDePrueba })
        if (cuentaDePrueba || esInterno()) {
          ph.register({ interno: true })
        }

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
          // El slot NO sustituye a `learner_id` —el "1" de una cuenta y el
          // "1" de otra son personas distintas— pero si dice si el evento
          // viene del alumno principal o de un hermano, que es la unica
          // pregunta que `learner_id` no contesta de un vistazo.
          learner_slot: alumno ? slotPedido : undefined,
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
    // `phIniciado` en las dependencias por el mismo motivo que arriba: sin
    // el, el identify de la primera carga no ocurria nunca y la persona se
    // quedaba anonima hasta que cambiara de ruta.
  }, [ph, slotPedido, phIniciado])

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
