/**
 * CONTEO ANÓNIMO — medición propia, sin cookies y sin identificar a nadie. s37.
 *
 * El problema que resuelve: PostHog solo existe para quien acepta el banner,
 * y del tráfico de anuncios (navegador de Instagram y TikTok) lo acepta menos
 * del 1%. El 6 de octubre los logs de Supabase vieron ~200 visitas a la
 * landing y PostHog vio UNA. Con eso no se puede saber dónde se cae la gente.
 *
 * Qué hace: por cada evento de una lista cerrada, manda a /api/m un registro
 * mínimo que la ruta guarda en `eventos_anonimos`. Se cuenta TODO el tráfico,
 * haya o no consentimiento, porque no hay nada que consentir:
 *
 *  - NO hay id de persona, de sesión ni de dispositivo. Dos eventos de la
 *    misma persona no se pueden unir: esto da totales por paso, no recorridos.
 *  - NO se guarda IP ni user agent. La ruta solo deriva "celular/computadora"
 *    y "navegador de Instagram/TikTok/Facebook/otro", y descarta el resto.
 *  - NO se escribe nada en el navegador (ni cookies ni storage).
 *  - Las propiedades pasan por una lista blanca de claves y de tipos.
 *
 * Para recorridos, grabaciones y personas sigue PostHog, con consentimiento.
 *
 * Este módulo lo usan track() (todos los eventos de producto) y
 * CookieConsent.tsx (los del propio aviso, que no pasan por track()).
 * Nunca lanza.
 */

import { detectarCanal } from '@/lib/arcade/canal'
import { esInterno } from '@/lib/analytics/interno'

/**
 * Los únicos eventos que se cuentan. Es el embudo previo a la cuenta:
 * landing, juegos gratis, onboarding, registro y paso a Stripe. Los eventos
 * de dentro del producto (temas, quizzes, audio) no entran: ahí ya hay cuenta
 * y la base los registra en `progress`.
 */
export const EVENTOS_CONTEO = [
  // Aviso de cookies (CookieConsent.tsx). Dicen cuánta gente lo ve y qué decide.
  'aviso_cookies_visto',
  'aviso_cookies_aceptado',
  'aviso_cookies_rechazado',
  'aviso_cookies_personalizado',

  // Landing
  'hero_variant_seen',
  'landing_section_seen',
  'landing_scroll_depth',
  'landing_first_interaction',
  'landing_cta_clicked',
  'landing_banner_arcade_clic',
  'landing_login_clicked',
  'landing_ver_planes_clicked',
  'landing_whatsapp_clicked',
  'landing_theme_tab_clicked',
  'landing_exit',
  'demo_iniciado',
  'demo_respuesta_completa',

  // Juegos gratis
  'arcade_visto',
  'arcade_iniciado',
  'arcade_completado',
  'arcade_compartir_clic',
  'arcade_puente_clic',
  'arcade_reto_hoy_clic',
  'horda_publica_vista',
  'horda_publica_iniciada',

  // Embudo de cuenta
  'onboarding_paso',
  'onboarding_completo',
  'preview_visto',
  'preview_cta_planes',
  'planes_vistos',
  'signup_start',
  'signup_completado',
  'registro_error',
  'checkout_iniciado',
  'checkout_cancelado',
] as const

export type EventoConteo = (typeof EVENTOS_CONTEO)[number]

const EVENTOS = new Set<string>(EVENTOS_CONTEO)

export function esEventoConteo(evento: string): evento is EventoConteo {
  return EVENTOS.has(evento)
}

/**
 * Claves de propiedades que se conservan. Todo lo demás se descarta, aunque
 * el evento lo traiga: user_id, learner_id, promo, utm_* (el canal va aparte)
 * y cualquier cosa que alguien agregue mañana a un track() se queda fuera
 * hasta que se agregue aquí a propósito.
 */
export const PROPS_CONTEO = [
  'section',
  'variant',
  'location',
  'percent',
  'elemento',
  'motivo',
  'segundos_en_pagina',
  'scroll_max_pct',
  'cta_visto',
  'ultima_seccion',
  'demo',
  'theme',
  'paso',
  'score',
  'metodo',
  'plan',
  // Entrada dentro del producto a los juegos gratis (banner, resultado
  // compartido…). No es el canal externo: ese lo calcula este módulo.
  'origen',
  // s39: el reto que se jugó era el de una materia (?materia=), no el de hoy.
  'por_materia',
] as const

const PROPS = new Set<string>(PROPS_CONTEO)

/**
 * Deja solo claves de la lista y valores escalares cortos. Función pura:
 * la usan el cliente (para no mandar de más) y la ruta (para no guardar de
 * más aunque alguien le mande otra cosa).
 */
export function limpiarProps(props: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!props || typeof props !== 'object') return out
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (!PROPS.has(k)) continue
    if (typeof v === 'string' && v.length > 0 && v.length <= 40) out[k] = v
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100
    else if (typeof v === 'boolean') out[k] = v
  }
  return out
}

/** Tiempo de carga en tramos. Un número exacto no aporta y estorba al agrupar. */
export function tramoCarga(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null
  if (ms < 1000) return '<1s'
  if (ms < 3000) return '1-3s'
  if (ms < 5000) return '3-5s'
  return '>5s'
}

/** Eventos que marcan "llegó a la página": solo ellos llevan el tiempo de carga. */
const EVENTOS_CON_CARGA = new Set<string>(['hero_variant_seen', 'arcade_visto', 'horda_publica_vista'])

function cargaDePagina(): string | null {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav ? tramoCarga(nav.domContentLoadedEventEnd) : null
  } catch {
    return null
  }
}

/**
 * Canal de la visita. Primero el utm de primer contacto de la pestaña
 * (UTMPersistence lo guarda al entrar); si no hay, lo que diga la URL, el
 * referrer o el navegador de la app. Así una visita de anuncio que pasa de
 * la landing al onboarding sigue contando como de ese anuncio.
 */
function canalDeLaVisita(): { canal: string; utm_source: string | null; utm_campaign: string | null } {
  let search = window.location.search
  try {
    const crudo = window.sessionStorage.getItem('pasas_utm')
    if (crudo) {
      const utm = JSON.parse(crudo) as { utm_source?: unknown; utm_campaign?: unknown }
      if (typeof utm.utm_source === 'string' && utm.utm_source) {
        const q = new URLSearchParams({ utm_source: utm.utm_source })
        if (typeof utm.utm_campaign === 'string' && utm.utm_campaign) q.set('utm_campaign', utm.utm_campaign)
        search = `?${q.toString()}`
      }
    }
  } catch {
    // Safari privado puede lanzar al leer sessionStorage: se usa la URL.
  }
  return detectarCanal({
    search,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    propioHost: window.location.hostname,
  })
}

/**
 * Cuenta un evento sin identificar a nadie. Si el evento no está en la
 * lista, no hace nada. Nunca lanza y nunca bloquea: sale por sendBeacon,
 * que el navegador entrega aunque la persona cierre la pestaña.
 */
export function contarAnonimo(evento: string, props?: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined') return
    if (!esEventoConteo(evento)) return

    const atribucion = canalDeLaVisita()
    const cuerpo = JSON.stringify({
      e: evento,
      r: window.location.pathname.slice(0, 120),
      c: atribucion.canal,
      us: atribucion.utm_source,
      uc: atribucion.utm_campaign,
      t: EVENTOS_CON_CARGA.has(evento) ? cargaDePagina() : null,
      i: esInterno(),
      p: limpiarProps(props),
    })

    if (typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/m', new Blob([cuerpo], { type: 'text/plain' }))
      if (ok) return
    }
    void fetch('/api/m', {
      method: 'POST',
      body: cuerpo,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => {})
  } catch {
    // La medición nunca rompe una pantalla.
  }
}
