'use client'

// Solo TIPOS: se borran al compilar. La librería entra con import() dentro
// de iniciarPostHog(), y el cliente de Supabase con import() en el identify.
import type { PostHog } from 'posthog-js'
import { Suspense, useEffect, useRef, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
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
 * 🔴 posthog-js SE DESCARGA SOLO CON CONSENTIMIENTO — s34.
 *
 * Antes se importaba arriba del archivo, y como este provider vive en el
 * layout raíz, sus ~60 KB gz viajaban en TODAS las páginas, incluida la de
 * quien rechazó el banner y nunca lo iba a usar. Ahora entra con import()
 * dentro de iniciarPostHog(), después de la guarda de consentimiento.
 *
 * `instancia` es la que queda tras el init; es la misma que se cuelga en
 * `window.posthog`. Quien la lea antes del init recibe null y no hace nada,
 * igual que pasaba con la instancia sin inicializar.
 *
 * `cargando` evita que dos llamadas seguidas (el efecto de montaje y el
 * evento del banner) disparen dos import() y dos init mientras el primero
 * todavía no termina: `iniciado` solo pasa a true al final.
 */
let instancia: PostHog | null = null
let cargando: Promise<void> | null = null

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
  if (iniciado || cargando || typeof window === 'undefined') return
  if (!permiteAnalytics()) return
  cargando = cargarEIniciar().catch((error) => {
    // Falló la descarga del chunk (red caída, despliegue nuevo a medias). Se
    // suelta la guarda para que el siguiente evento del banner o la siguiente
    // carga lo vuelva a intentar. Sin init no se captura nada, como hoy.
    cargando = null
    console.warn('[posthog] no se pudo cargar posthog-js:', error)
  })
}

async function cargarEIniciar() {
  const { default: posthog } = await import('posthog-js')
  // La descarga tarda: si en ese rato la persona revocó el consentimiento,
  // no se inicia. Se suelta la guarda por si vuelve a aceptar.
  if (!permiteAnalytics()) {
    cargando = null
    return
  }
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
    /**
     * Web Vitals (LCP, CLS, FCP, INP) como evento `$web_vitals` — s34.
     *
     * Hasta aquí PostHog no recibía ninguno y no había línea base contra la
     * cual medir los cambios de rendimiento. Va como objeto y no como `true`
     * a propósito: con un objeto, `network_timing` (el de las grabaciones)
     * queda sin tocar y lo sigue decidiendo la configuración remota.
     */
    capture_performance: { web_vitals: true },
  })

  /**
   * 🔴 `window.posthog` ES LO QUE LEE track() (lib/analytics/track.ts →
   * entregar), y posthog-js instalado por npm NO lo crea: solo el snippet
   * <script> lo hace. Sin esta línea, desde 2026-08-18 ningún evento de
   * track() —onboarding, registro, checkout, Arcade, Horda— llegó a PostHog:
   * se encolaban esperando un global que nunca aparecía, mientras GA4 sí los
   * recibía y $pageview/$autocapture (que usan esta instancia directo) sí
   * llegaban. Los que siguen en la cola se entregan en el siguiente reintento.
   */
  ;(window as unknown as { posthog?: PostHog }).posthog = posthog

  /**
   * Trafico interno. Va DESPUES del init —antes, `register` no existe— y
   * antes de cualquier captura, para que hasta el $pageview de la primera
   * carga salga marcado.
   */
  if (sincronizarInterno()) {
    posthog.register({ interno: true })
  }

  instancia = posthog
  iniciado = true
  for (const avisar of oyentesInit) avisar()
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
    // `instancia` siempre existe cuando `phIniciado` es true: se asigna
    // justo antes de avisar a los oyentes.
    const ph = instancia
    if (!phIniciado || !pathname || !ph) return

    let url = window.origin + pathname
    const query = searchParams?.toString()
    if (query) url = url + '?' + query

    if (ultimaUrl.current === url) return
    ultimaUrl.current = url

    ph.capture('$pageview', { $current_url: url })
  }, [phIniciado, pathname, searchParams])

  // Slot del alumno activo, leído del `?a=`. Mismo criterio que
  // resolveLearner: sin param es el 1, que es el primario en toda cuenta
  // (upsertPrimaryLearner siempre inserta slot: 1).
  const slotCrudo = searchParams?.get('a')
  const slotActivo = slotCrudo ? Number.parseInt(slotCrudo, 10) : 1
  const slotPedido = Number.isFinite(slotActivo) && slotActivo > 0 ? slotActivo : 1

  useEffect(() => {
    // Sin consentimiento no se ejecuta nada de esto. La guarda va ANTES
    // de cargar Supabase, no dentro del .then(): más abajo ya se habrían
    // disparado la lectura de sesión y las consultas a `users` y
    // `subscriptions` de alguien que dijo que no.
    if (!phIniciado) return
    const ph = instancia
    if (!ph) return

    // Si el slot cambia (o el componente se desmonta) mientras las consultas
    // siguen en vuelo, la respuesta vieja no debe pisar a la nueva: sin esto,
    // ir de `?a=2` a `?a=1` rápido podía dejar registradas las
    // super-propiedades del 2.
    let vigente = true

    void (async () => {
      /**
       * supabase-js entra aquí con import() y no arriba del archivo — s34.
       * Este provider vive en el layout raíz: un import estático metía ~60 KB
       * gz en todas las páginas, aunque solo se usa con consentimiento.
       */
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()

      /**
       * getSession() y no getUser() — s34.
       *
       * getUser() es un viaje a Supabase Auth para VALIDAR el token, y aquí
       * no se autoriza nada: solo se le pone nombre a la analítica. Las
       * consultas de abajo siguen pasando por RLS con ese mismo token, así
       * que una cookie falsificada no lee datos de nadie; a lo más etiqueta
       * mal su propia sesión de PostHog. getSession() lee la cookie local (y
       * refresca el token solo si ya caducó).
       */
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!vigente || !user) return

      // La lectura va partida en dos porque los datos viven en dos sitios
      // distintos desde la migracion 035: la identidad es de la CUENTA y
      // el progreso es del ALUMNO. Las columnas de `users` que se usaban
      // aqui quedaron legacy — `xp_total` y `streak_days` congeladas el
      // 10-ago, `education_level` y `grade` desincronizadas porque solo
      // se escriben al registrarse y `change-grade` toca solo `learners`.
      //
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
      //
      // s34: UNA consulta de `learners` en vez de tres (slot pedido, respaldo
      // al primario y conteo), y las tres lecturas en paralelo en vez de en
      // serie. Una cuenta tiene un puñado de alumnos: traerlos todos cuesta
      // lo mismo que traer uno, y de esa lista salen el activo, el respaldo y
      // `learners_count` — con la misma RLS que el `count` que reemplaza.
      const COLUMNAS_ALUMNO = 'id, slot, education_level, grade, xp_total, streak_days, theme_id, themes(name)'

      const [{ data: profile }, { data: alumnos }, { data: subscription }] = await Promise.all([
        supabase
          .from('users')
          .select('full_name, is_test')
          .eq('id', user.id)
          .single(),
        supabase
          .from('learners')
          .select(COLUMNAS_ALUMNO)
          .eq('account_user_id', user.id),
        supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('current_period_end', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (!vigente) return

      const lista = alumnos ?? []
      // Un `?a=` viejo o manipulado apunta a un slot que no existe en esta
      // cuenta. Se cae al primario en vez de quedarse sin identidad, igual
      // que hace resolveLearner en el resto de la app.
      const alumno =
        lista.find((l) => l.slot === slotPedido) ??
        (slotPedido !== 1 ? lista.find((l) => l.slot === 1) : undefined) ??
        null
      const learnersCount = lista.length

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
    })().catch(() => {
      // Solo analítica: si algo falla aquí la persona se queda anónima en
      // PostHog hasta la siguiente navegación. No hay nada que mostrar.
    })

    return () => {
      vigente = false
    }
    // slotPedido en las dependencias: el provider vive en el layout raíz y
    // navegar a `?a=2` NO lo vuelve a montar. Sin esto, cambiar de alumno
    // dejaba las super-propiedades describiendo al anterior.
    // `phIniciado` en las dependencias por el mismo motivo que arriba: sin
    // el, el identify de la primera carga no ocurria nunca y la persona se
    // quedaba anonima hasta que cambiara de ruta.
  }, [slotPedido, phIniciado])

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
    <>
      {/*
        🔴 EL <Suspense> ES DE PostHogPageView SOLO, Y `children` VA FUERA.

        PostHogPageView llama a useSearchParams —lo necesita para el
        `$current_url` del $pageview y para el `?a=` del alumno activo—, y eso
        hace que Next renderice en cliente todo lo que quede dentro del
        <Suspense> más cercano. Antes el único boundary estaba en el layout
        raíz y envolvía a `children`: el HTML inicial de todo el sitio salía
        vacío. Ver la nota larga en src/app/layout.tsx.

        Devuelve `null`, así que el bailout aquí no cuesta nada. `children`
        queda fuera del boundary, que es lo que importa.

        s34: ya no hay <PHProvider> de posthog-js/react. Nada en la app usaba
        usePostHog() fuera de este archivo, y ese contexto obligaba a importar
        posthog-js de forma estática. La instancia vive en `instancia` (y en
        `window.posthog`, que es lo que leen track() y posthog-events).
      */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  )
}
