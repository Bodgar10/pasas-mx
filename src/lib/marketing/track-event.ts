/**
 * trackEvent — Helper unificado de tracking
 * Dispara eventos a todos los canales configurados.
 * Usar desde client-side para eventos de UI.
 * Para eventos críticos (pagos), usar server-side desde webhooks.
 */

export type TrackEventName =
  | 'PageView'
  | 'ViewContent'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Subscribe'
  | 'CompleteRegistration'
  | 'Lead'
  | 'Search'

export interface TrackEventProps {
  value?: number
  currency?: string
  content_name?: string
  content_type?: string
  [key: string]: unknown
}

export function trackEvent(name: TrackEventName, props?: TrackEventProps) {
  if (typeof window === 'undefined') return

  // Meta Pixel (client-side)
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', name, props ?? {})
    }
  } catch (e) {
    console.warn('[trackEvent] Meta Pixel error:', e)
  }

  // TikTok Pixel (client-side)
  try {
    if ((window as any).ttq) {
      (window as any).ttq.track(name, props ?? {})
    }
  } catch (e) {
    console.warn('[trackEvent] TikTok Pixel error:', e)
  }

  // Google Analytics (client-side)
  try {
    if ((window as any).gtag) {
      (window as any).gtag('event', name, props ?? {})
    }
  } catch (e) {
    console.warn('[trackEvent] gtag error:', e)
  }
}
