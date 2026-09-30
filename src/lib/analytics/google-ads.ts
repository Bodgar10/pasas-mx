/**
 * Conversiones de Google Ads (s34-F7). INERTE sin variables: si falta
 * NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID o la etiqueta de la conversión, no se
 * carga ni se envía nada.
 *
 * 🔴 Consentimiento FAIL-CLOSED: solo con la categoría `marketing` en true
 * (es transferencia a un tercero, igual que Meta y TikTok). El script lo
 * carga AnalyticsScripts; aquí solo se manda el evento.
 *
 * 🔴 Sin conversiones mejoradas (nada de correo hasheado): puede haber
 * menores. Nunca lanza.
 */
import { permiteMarketing } from '@/lib/consent'

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ?? ''
const ETIQUETAS = {
  registro: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_REGISTRO ?? '',
  pago: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PAGO ?? '',
} as const

export type ConversionAds = keyof typeof ETIQUETAS

type GtagAds = (comando: 'event', nombre: 'conversion', props: Record<string, unknown>) => void

/**
 * Manda una conversión. Si gtag todavía no cargó (el script es
 * afterInteractive), reintenta unos segundos y se rinde en silencio.
 */
export function conversionGoogleAds(tipo: ConversionAds, transactionId?: string): void {
  try {
    if (typeof window === 'undefined') return
    const etiqueta = ETIQUETAS[tipo]
    if (!GOOGLE_ADS_ID || !etiqueta || !permiteMarketing()) return
    const props: Record<string, unknown> = { send_to: `${GOOGLE_ADS_ID}/${etiqueta}` }
    if (transactionId) props.transaction_id = transactionId

    let intentos = 0
    const intentar = () => {
      try {
        const gtag = (window as unknown as { gtag?: GtagAds }).gtag
        if (typeof gtag === 'function') {
          gtag('event', 'conversion', props)
          return
        }
        if (++intentos < 10) window.setTimeout(intentar, 500)
      } catch {}
    }
    intentar()
  } catch {}
}

/**
 * Pago: una sola vez por sesión de Stripe. Recargar /dashboard?checkout=success
 * no cuenta doble (sessionStorage), y el `transaction_id` deja que Google
 * deduplique también de su lado.
 */
export function conversionPagoUnaVez(sessionId: string | null): void {
  try {
    const clave = `pasas_ads_pago:${sessionId ?? 'sin-session'}`
    if (window.sessionStorage.getItem(clave)) return
    window.sessionStorage.setItem(clave, '1')
  } catch {
    // Sin sessionStorage no hay forma de deduplicar: mejor no mandar.
    return
  }
  conversionGoogleAds('pago', sessionId ?? undefined)
}
