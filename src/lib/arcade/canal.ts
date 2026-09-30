/**
 * CANAL de la visita a los juegos gratis: de dónde vino la persona, FUERA
 * del producto (Instagram, TikTok…). s34-F2.
 *
 * No confundir con `origen` (lib/arcade.ts), que es el punto de ENTRADA
 * dentro del producto (banner de la landing, resultado compartido…). Un
 * jugador puede tener canal 'instagram' y origen 'directo': llegó por un
 * link de Instagram directo a /arcade.
 *
 * Orden: utm_source de la URL → dominio del referrer → user agent del
 * navegador dentro de la app → 'directo'.
 *
 * Primer contacto: se guarda la primera vez en localStorage y se reúsa.
 * No es UTMPersistence (sessionStorage, embudo de cuenta): esto vive entre
 * visitas porque el reto es diario.
 */

export const CANALES = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'google', 'email', 'directo', 'otro'] as const
export type Canal = (typeof CANALES)[number]

export type Atribucion = {
  canal: Canal
  utm_source: string | null
  utm_campaign: string | null
}

const LLAVE = 'pasas_arcade_canal'

function porUtm(src: string): Canal {
  const s = src.trim().toLowerCase()
  if (['ig', 'instagram', 'l.instagram.com', 'instagram.com'].includes(s)) return 'instagram'
  if (['tiktok', 'tiktok.com', 'tt'].includes(s)) return 'tiktok'
  if (['fb', 'facebook', 'l.facebook.com', 'lm.facebook.com', 'm.facebook.com', 'facebook.com'].includes(s)) return 'facebook'
  if (['wa', 'whatsapp'].includes(s)) return 'whatsapp'
  if (s === 'google' || /(^|\.)google\.[a-z.]+$/.test(s)) return 'google'
  if (s === 'email') return 'email'
  return 'otro'
}

function porDominio(host: string): Canal | null {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram'
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok'
  if (h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.com') return 'facebook'
  if (h === 'wa.me' || h.endsWith('whatsapp.com') || h.endsWith('whatsapp.net')) return 'whatsapp'
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return 'google'
  return null
}

function porUserAgent(ua: string): Canal | null {
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok'
  if (/FBAN|FBAV/.test(ua)) return 'facebook'
  return null
}

/**
 * Función pura: calcula la atribución con lo que trae la visita.
 * `propioHost` evita contar como externo un referrer del mismo sitio.
 */
export function detectarCanal(entrada: {
  search: string
  referrer: string
  userAgent: string
  propioHost?: string
}): Atribucion {
  const q = new URLSearchParams(entrada.search)
  const src = q.get('utm_source')?.trim() || null
  const camp = q.get('utm_campaign')?.trim() || null
  const corto = (v: string | null) => (v ? v.slice(0, 64) : null)

  if (src) return { canal: porUtm(src), utm_source: corto(src), utm_campaign: corto(camp) }

  let host = ''
  try {
    host = entrada.referrer ? new URL(entrada.referrer).hostname : ''
  } catch {}
  const propio = (entrada.propioHost ?? '').toLowerCase().replace(/^www\./, '')
  const esPropio = !!host && !!propio && host.toLowerCase().replace(/^www\./, '') === propio

  if (host && !esPropio) {
    return { canal: porDominio(host) ?? 'otro', utm_source: null, utm_campaign: corto(camp) }
  }

  const ua = porUserAgent(entrada.userAgent)
  if (ua) return { canal: ua, utm_source: null, utm_campaign: corto(camp) }

  return { canal: 'directo', utm_source: null, utm_campaign: corto(camp) }
}

function valida(x: unknown): x is Atribucion {
  return !!x && typeof x === 'object' && (CANALES as readonly string[]).includes((x as Atribucion).canal)
}

/**
 * Atribución de primer contacto del navegador. La primera vez se calcula y
 * se guarda; después se reúsa. Si el storage falla, se calcula cada vez.
 * Nunca lanza. Solo en el navegador (en el servidor devuelve 'directo').
 */
export function atribucionJuegos(): Atribucion {
  if (typeof window === 'undefined') return { canal: 'directo', utm_source: null, utm_campaign: null }
  try {
    const guardada = JSON.parse(window.localStorage.getItem(LLAVE) ?? 'null')
    if (valida(guardada)) return guardada
  } catch {}
  let actual: Atribucion = { canal: 'directo', utm_source: null, utm_campaign: null }
  try {
    actual = detectarCanal({
      search: window.location.search,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      propioHost: window.location.hostname,
    })
  } catch {}
  try {
    window.localStorage.setItem(LLAVE, JSON.stringify(actual))
  } catch {}
  return actual
}
