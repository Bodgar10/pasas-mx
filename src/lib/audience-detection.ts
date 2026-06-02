/**
 * AUDIENCE DETECTION
 * Detecta si el usuario viene como "hijo" o "papa" según utm_source.
 * Usado para mostrar el hero correcto en la landing.
 */

export type Audience = 'hijo' | 'papa' | 'unknown'

export function detectAudience(utmSource?: string | null): Audience {
  if (!utmSource) return 'unknown'
  const src = utmSource.toLowerCase()
  if (src === 'tiktok' || src === 'meta_hijos') return 'hijo'
  if (src === 'meta_papas' || src === 'google') return 'papa'
  return 'unknown'
}

export interface AcquisitionSource {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  referrer?: string
  landing_url?: string
  first_touch_at?: string
}

export function buildAcquisitionSource(
  params: Record<string, string>,
  referrer?: string,
  landingUrl?: string
): AcquisitionSource {
  return {
    utm_source: params.utm_source || undefined,
    utm_medium: params.utm_medium || undefined,
    utm_campaign: params.utm_campaign || undefined,
    utm_content: params.utm_content || undefined,
    utm_term: params.utm_term || undefined,
    referrer: referrer || undefined,
    landing_url: landingUrl || undefined,
    first_touch_at: new Date().toISOString(),
  }
}
