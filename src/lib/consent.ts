/**
 * FUENTE ÚNICA del consentimiento de cookies.
 *
 * Quién lo usa: CookieConsent.tsx (lo escribe), AnalyticsScripts.tsx y
 * posthog-provider.tsx (lo leen). NUNCA leer localStorage directo desde
 * un componente: se hace aquí y solo aquí.
 *
 * 🔴 FAIL-CLOSED, al revés que tosAccepted en el middleware.
 * Si localStorage falla —Safari en navegación privada, por ejemplo— se
 * devuelve null, que significa "no hay consentimiento": no carga nada y
 * el banner vuelve a preguntar. Cargar analítica por un error de lectura
 * sería exactamente el fallo que no podemos permitirnos.
 *
 * Dos categorías separadas a propósito:
 *  - analytics: GA4, Clarity, PostHog. PostHog GRABA SESIONES, incluidas
 *    las de menores de edad.
 *  - marketing: Meta, TikTok, Google Ads. Komenko los clasifica como
 *    TRANSFERENCIAS (art. 35 LFPDPPP).
 */

export const COOKIE_CONSENT_VERSION = '1.0'
export const COOKIE_CONSENT_KEY = 'pasas_cookie_consent'

/**
 * Se dispara al guardar. Los componentes que cargan scripts lo escuchan
 * para reaccionar sin recargar la página.
 */
export const COOKIE_CONSENT_EVENT = 'pasas:cookie-consent'

export type ConsentState = {
  version: string
  analytics: boolean
  marketing: boolean
  at: string
}

export function leerConsentimiento(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    // Versión distinta = hay que volver a preguntar. Si algún día cambia
    // qué se instala, el consentimiento viejo no cubre lo nuevo.
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null
    if (typeof parsed.analytics !== 'boolean') return null
    if (typeof parsed.marketing !== 'boolean') return null
    return parsed as ConsentState
  } catch {
    return null
  }
}

export function guardarConsentimiento(
  analytics: boolean,
  marketing: boolean
): ConsentState {
  const estado: ConsentState = {
    version: COOKIE_CONSENT_VERSION,
    analytics,
    marketing,
    at: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(estado))
  } catch {
    // Si no se puede guardar, el banner volverá a salir. Molesto pero seguro.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: estado }))
  return estado
}

export function hayQuePreguntar(): boolean {
  return leerConsentimiento() === null
}

export function permiteAnalytics(): boolean {
  return leerConsentimiento()?.analytics === true
}

export function permiteMarketing(): boolean {
  return leerConsentimiento()?.marketing === true
}
