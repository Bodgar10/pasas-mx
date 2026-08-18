/**
 * track() — PUNTO DE ENTRADA UNICO de la analitica de cliente.
 *
 * Un evento entra una vez y sale hacia los cuatro destinos con las mismas
 * propiedades, el mismo id de usuario y el mismo `event_id`. Antes cada
 * destino se llamaba por su lado y no habia forma de comparar un evento
 * entre plataformas.
 *
 * Este modulo NO lleva 'use client' a proposito: las tablas de traduccion
 * las necesita tambien `track-server.ts`, que corre en el servidor. Todo lo
 * que toca el navegador esta detras de `typeof window === 'undefined'`, el
 * mismo patron que ya usa lib/marketing/track-event.ts.
 *
 * ── Lo que NO hace ────────────────────────────────────────────────────
 * No reemplaza a `posthog-events.ts` ni al helper local de
 * `landing-client.tsx`. Esos dos quedan CONGELADOS y funcionando; sus
 * eventos se migran uno por uno cuando se reinstrumente su pantalla.
 */

import { permiteAnalytics, permiteMarketing } from '@/lib/consent'
import { cicloActual } from '@/lib/ciclo-escolar'

export type PropiedadesEvento = Record<string, unknown>

export type DestinoAnalitica = 'posthog' | 'ga4' | 'meta' | 'tiktok'

// ─────────────────────────────────────────────────────────────────────────
// TABLAS DE TRADUCCION
//
// El nombre canonico es SIEMPRE el de PostHog: snake_case. PostHog y GA4
// reciben TODOS los eventos con ese nombre. Meta y TikTok reciben solo los
// que aparecen aqui, traducidos a su vocabulario.
//
// 🔴 Un evento sin entrada NO se manda a ese destino, y es lo correcto: la
// mayoria de los ~67 eventos son de producto y a un pixel de publicidad no
// le sirven. Mandarlos todos ensucia la señal y encarece la optimizacion de
// las campañas.
//
// Nacen con los eventos que ya existen hoy. Se llenan en los prompts que
// instrumentan cada pantalla.
// ─────────────────────────────────────────────────────────────────────────

export const MAPEO_META: Record<string, string> = {
  signup: 'CompleteRegistration',
  checkout_started: 'InitiateCheckout',

  // s33 — landing. Es el UNICO evento de la landing que entra al pixel:
  // marca que alguien pulso un CTA del embudo, que es lo mas cerca de un
  // lead que ocurre antes del registro. `landing_cta_clicked` se queda
  // fuera a proposito: dispara junto a este en cada clic, asi que meterlo
  // duplicaria la señal y encareceria la optimizacion de las campañas.
  hero_variant_converted: 'Lead',

  // s36 — embudo de alta y pago.
  signup_completado: 'CompleteRegistration',
  checkout_iniciado: 'InitiateCheckout',

  // 🔴 `pago_exitoso` NO va aqui, y no es un olvido.
  //
  // El webhook YA manda 'Subscribe' a Meta y 'CompletePayment' a TikTok
  // directo con sendMetaCapiEvent/sendTikTokEvent, en el mismo bloque donde
  // emite pago_exitoso. Mapearlo tambien aqui haria que trackServer mandara
  // un SEGUNDO Subscribe por el mismo cobro — y sin event_id compartido,
  // Meta los contaria como dos ventas.
  // pago_exitoso: 'Subscribe',

  // 🔴 `checkout_completed` NO se mapea todavia, a proposito.
  //
  // El webhook de Stripe YA manda 'Subscribe' a Meta cuando el pago se
  // confirma (api/webhooks/stripe). Si lo mapearamos aqui, el mismo pago
  // llegaria dos veces —una del pixel y otra de CAPI— y NO se podrian
  // deduplicar, porque el webhook no manda `event_id`: sendMetaCapiEvent()
  // ni siquiera acepta ese campo hoy.
  //
  // Se destapa en cuanto meta-capi.ts acepte `eventId` y el webhook lo
  // comparta con el cliente. Hasta entonces, contar una vez desde servidor
  // es preferible a contar dos veces desde ambos lados.
  // checkout_completed: 'Subscribe',
}

export const MAPEO_TIKTOK: Record<string, string> = {
  signup: 'CompleteRegistration',
  checkout_started: 'InitiateCheckout',

  // Mismo criterio que en MAPEO_META. El resto de los eventos de la
  // landing —secciones vistas, scroll, demos— son de producto y a un
  // pixel de publicidad no le sirven.
  hero_variant_converted: 'Lead',

  // s36 — embudo. Mismo criterio que en MAPEO_META.
  signup_completado: 'CompleteRegistration',
  checkout_iniciado: 'InitiateCheckout',

  // 🔴 `pago_exitoso` fuera: el webhook ya manda 'CompletePayment' aparte.
  // pago_exitoso: 'CompletePayment',

  // Mismo motivo que en MAPEO_META: el webhook ya manda 'CompletePayment'.
  // checkout_completed: 'CompletePayment',
}

// ─────────────────────────────────────────────────────────────────────────
// IDENTIDAD — super-propiedades que escribe posthog-provider
//
// El provider ya resuelve la cuenta y el alumno primario en toda ruta, asi
// que es el unico sitio del cliente donde estos datos estan resueltos. Los
// deja como SUPER-PROPIEDADES de PostHog y aqui se leen de vuelta con
// `get_property`, en vez de que cada llamada a track() los vuelva a
// consultar contra Supabase.
//
// 🔴 `learner_id` es el uuid del alumno activo, NUNCA el `slot`. El slot es
// local a la cuenta —el "1" de una cuenta y el "1" de otra son personas
// distintas— asi que mandarlo seria inutil para segmentar.
//
// La lista es la fuente unica: posthog-provider la importa y TypeScript
// obliga a que el objeto que registra tenga exactamente estas claves. Si
// alguien agrega una aqui y se olvida alla, no compila.
// ─────────────────────────────────────────────────────────────────────────

export const SUPER_PROPS_ANALITICA = [
  'user_id',
  'learner_id',
  'plan',
  'subscription_status',
  'education_level',
  'grade',
  'theme',
] as const

export type SuperPropAnalitica = (typeof SUPER_PROPS_ANALITICA)[number]

/**
 * Claves de sessionStorage. Espejo de UTMPersistence.tsx y
 * PromoPersistence.tsx, que las tienen escritas a mano y sin exportar.
 * Si cambian alla, cambian aqui.
 */
const CLAVE_UTM = 'pasas_utm'
const CLAVE_PROMO = 'pasas_promo'

const CLAVES_UTM = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

// ─────────────────────────────────────────────────────────────────────────
// COLA — el hueco de `afterInteractive`
//
// Los cuatro scripts cargan con strategy="afterInteractive", asi que hay
// una ventana en la que la pagina ya responde a clics y el global del
// destino todavia no existe. Un evento disparado ahi se perdia en silencio.
//
// Con cuatro destinos cargando a destiempo eso deja de ser un detalle: el
// primer clic de cada sesion es justo el que mas importa.
//
// Dos topes, los dos necesarios: sin limite de tamaño la cola es una fuga
// de memoria, y sin limite de edad se acaban enviando eventos que ya no
// describen nada. Lo que se descarta se avisa por consola; perder un evento
// en silencio es el fallo que esta cola existe para evitar.
// ─────────────────────────────────────────────────────────────────────────

const COLA_MAX = 50
const COLA_TTL_MS = 10_000
const REINTENTO_MS = 500

type EnCola = {
  destino: DestinoAnalitica
  nombre: string
  props: PropiedadesEvento
  eventId: string
  nacido: number
}

let cola: EnCola[] = []
let temporizador: ReturnType<typeof setInterval> | null = null

/**
 * Las SDKs de los cuatro destinos, tal como las dejan sus scripts en
 * `window`. Se declaran con la firma minima que usamos en vez de `any`:
 * si mañana alguien cambia un argumento, lo dice el compilador y no el
 * dashboard tres semanas despues.
 */
type GlobalesAnalitica = {
  posthog?: {
    capture?: (nombre: string, props?: PropiedadesEvento) => void
    get_property?: (clave: string) => unknown
  }
  gtag?: (comando: 'event', nombre: string, props?: PropiedadesEvento) => void
  fbq?: (
    comando: 'track',
    nombre: string,
    props?: PropiedadesEvento,
    opciones?: { eventID: string }
  ) => void
  ttq?: {
    track?: (nombre: string, props?: PropiedadesEvento, opciones?: { event_id: string }) => void
  }
}

function globales(): GlobalesAnalitica {
  return window as unknown as GlobalesAnalitica
}

/**
 * Intenta entregar. `true` = asunto cerrado (entregado, o la SDK reventó y
 * no tiene sentido reintentar). `false` = el global todavia no existe, hay
 * que encolar y volver a probar.
 */
function entregar(item: EnCola): boolean {
  const w = globales()
  try {
    switch (item.destino) {
      case 'posthog':
        if (typeof w.posthog?.capture !== 'function') return false
        w.posthog.capture(item.nombre, item.props)
        return true

      case 'ga4':
        if (typeof w.gtag !== 'function') return false
        w.gtag('event', item.nombre, item.props)
        return true

      case 'meta':
        if (typeof w.fbq !== 'function') return false
        // El 4º argumento con `eventID` es lo que casa este evento con el
        // que mande CAPI desde el servidor. Sin el, Meta cuenta dos.
        w.fbq('track', item.nombre, item.props, { eventID: item.eventId })
        return true

      case 'tiktok':
        if (typeof w.ttq?.track !== 'function') return false
        w.ttq.track(item.nombre, item.props, { event_id: item.eventId })
        return true
    }
  } catch (err) {
    // Se da por cerrado a proposito: si la SDK lanza, reintentar 20 veces
    // solo repite el mismo error y llena la consola.
    console.warn(`[track] ${item.destino} lanzo al enviar "${item.nombre}":`, err)
    return true
  }
}

function drenar(): void {
  const ahora = Date.now()
  const pendientes: EnCola[] = []

  for (const item of cola) {
    if (ahora - item.nacido > COLA_TTL_MS) {
      console.warn(
        `[track] descartado: "${item.nombre}" nunca alcanzo a ${item.destino} ` +
          `en ${COLA_TTL_MS}ms. ¿Falta la variable de entorno del script?`
      )
      continue
    }
    if (!entregar(item)) pendientes.push(item)
  }

  cola = pendientes

  if (cola.length === 0 && temporizador !== null) {
    clearInterval(temporizador)
    temporizador = null
  }
}

function encolar(item: EnCola): void {
  if (cola.length >= COLA_MAX) {
    console.warn(
      `[track] cola llena (${COLA_MAX}); se descarta "${item.nombre}" → ${item.destino}`
    )
    return
  }
  cola.push(item)
  if (temporizador === null) temporizador = setInterval(drenar, REINTENTO_MS)
}

function despachar(
  destino: DestinoAnalitica,
  nombre: string,
  props: PropiedadesEvento,
  eventId: string
): void {
  const item: EnCola = { destino, nombre, props, eventId, nacido: Date.now() }
  if (!entregar(item)) encolar(item)
}

// ─────────────────────────────────────────────────────────────────────────
// PROPIEDADES AUTOMATICAS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Quita undefined, null y cadenas vacias.
 *
 * 🔴 Nunca se manda un valor inventado ni un string vacio. Una propiedad
 * ausente se lee en el dashboard como "no habia dato"; un '' se lee como
 * "el dato es vacio", que es una afirmacion falsa y ademas crea una
 * categoria fantasma en cualquier desglose.
 */
function sinVacios(props: PropiedadesEvento): PropiedadesEvento {
  const out: PropiedadesEvento = {}
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

function desdePostHog(): PropiedadesEvento {
  const out: PropiedadesEvento = {}
  const ph = globales().posthog
  if (typeof ph?.get_property !== 'function') return out

  for (const clave of SUPER_PROPS_ANALITICA) {
    try {
      const valor = ph.get_property(clave)
      if (valor !== undefined && valor !== null && valor !== '') out[clave] = valor
    } catch {
      // get_property revienta si se llama antes de que cargue la libreria.
      // Se omite la propiedad y ya: no es motivo para perder el evento.
    }
  }
  return out
}

function desdeSession(): PropiedadesEvento {
  const out: PropiedadesEvento = {}
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_UTM)
    if (crudo) {
      const utm = JSON.parse(crudo) as Record<string, unknown>
      for (const clave of CLAVES_UTM) {
        if (typeof utm[clave] === 'string' && utm[clave]) out[clave] = utm[clave]
      }
    }
    const promo = window.sessionStorage.getItem(CLAVE_PROMO)
    if (promo) out.promo_slug = promo
  } catch {
    // Safari en navegacion privada puede lanzar al leer sessionStorage.
  }
  return out
}

function dispositivo(): 'mobile' | 'desktop' | undefined {
  try {
    // 767px = el mismo corte que usa el resto de la app para `isDesktop`.
    return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop'
  } catch {
    return undefined
  }
}

/**
 * Genera un `event_id`.
 *
 * Exportado porque el embudo lo necesita ANTES de llamar a track(): el id
 * del `checkout_iniciado` tiene que viajar en el body de create-session y de
 * ahi a la metadata de Stripe. Vive aqui y no en cada pantalla para que las
 * tres puertas de cobro usen la misma implementacion — y porque llamar a
 * crypto.randomUUID() dentro de un componente lo marca el compilador de
 * React como impuro.
 */
/**
 * Reloj de pared para medir duraciones de eventos.
 *
 * Existe por una razon concreta: `Date.now()` llamado dentro del cuerpo de un
 * componente lo marca el compilador de React como funcion impura. Envuelto en
 * un modulo se puede usar desde los manejadores sin pelearse con la regla, y
 * ademas deja un solo sitio del que colgar un reloj falso si algun dia hay que
 * probar estas medidas.
 */
export function ahoraMs(): number {
  return Date.now()
}

export function nuevoEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // randomUUID exige contexto seguro. En http:// local no existe.
  }
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function propiedadesAutomaticas(): PropiedadesEvento {
  return {
    ...desdePostHog(),
    ...desdeSession(),
    ciclo: cicloActual(),
    device: dispositivo(),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LA FUNCION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Manda un evento a los cuatro destinos.
 *
 * @param evento  Nombre CANONICO en snake_case (vocabulario PostHog).
 * @param propiedades  Lo especifico del evento. Las de 2.2 se agregan solas.
 *
 * Para compartir `event_id` con un evento de servidor, pasalo explicito:
 * `track('pago_exitoso', { event_id: idQueTambienUsaElWebhook })`.
 *
 * Consentimiento por categoria, fail-closed: `permiteAnalytics()` y
 * `permiteMarketing()` exigen `=== true`, asi que un NULL —nunca contesto
 * el banner— no es un si. Si una categoria no esta permitida ese destino se
 * salta EN SILENCIO y los demas siguen.
 *
 * Nunca lanza. Un fallo de analitica no puede tumbar una pantalla.
 */
export function track(evento: string, propiedades?: PropiedadesEvento): void {
  try {
    if (typeof window === 'undefined') return

    const idExplicito = propiedades?.event_id
    const eventId =
      typeof idExplicito === 'string' && idExplicito ? idExplicito : nuevoEventId()

    // event_id va al final: es autoritativo y no lo pisa el llamador.
    const props = sinVacios({
      ...propiedadesAutomaticas(),
      ...(propiedades ?? {}),
      event_id: eventId,
    })

    if (permiteAnalytics()) {
      despachar('posthog', evento, props, eventId)
      despachar('ga4', evento, props, eventId)
    }

    if (permiteMarketing()) {
      const nombreMeta = MAPEO_META[evento]
      if (nombreMeta) despachar('meta', nombreMeta, props, eventId)

      const nombreTikTok = MAPEO_TIKTOK[evento]
      if (nombreTikTok) despachar('tiktok', nombreTikTok, props, eventId)
    }
  } catch (err) {
    console.warn('[track] fallo no atrapado:', err)
  }
}

/** Solo para depurar: cuantos eventos siguen esperando a su script. */
export function pendientesEnCola(): number {
  return cola.length
}
