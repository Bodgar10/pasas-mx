'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { track } from '@/lib/analytics/track'

/**
 * Captura el canal de origen y lo persiste en `users.acquisition_source`.
 *
 * ── DOS BANDERAS, NO UNA ──────────────────────────────────────────────
 *
 * 🔴 Antes solo existía `pasas_utm`, y servía de guarda para las dos cosas
 * a la vez: "ya capturé" y "ya persistí". Eso escondía una condición de
 * carrera que dejaba SIN ATRIBUCIÓN casi toda primera visita.
 *
 * El POST a /api/track-source sale al montar, pero la sesión anónima que
 * crea la landing llega ~2s después (`setTimeout(prefetchSession, 2000)`).
 * Así que en la primera visita el endpoint corría sin sesión, respondía
 * `{ ok: true }` sin escribir nada, y no había segundo intento: la guarda
 * de `pasas_utm` cortaba el efecto antes del fetch en cada navegación.
 *
 * Con `pasas_utm_persistido` aparte, la captura sigue siendo first-touch
 * —el JSON no se reescribe nunca— pero el envío se reintenta hasta que
 * exista sesión. No se toca el setTimeout de la landing: se espera a que
 * la sesión aparezca en vez de adelantarla.
 *
 * ── ALCANCE: POR PESTAÑA, NO POR PERSONA ──────────────────────────────
 *
 * 🔴 `sessionStorage` muere al cerrar la pestaña. Quien ve el anuncio,
 * cierra, y vuelve escribiendo pasas.mx a mano aparece como ORGÁNICO —
 * y el navegador embebido de TikTok e Instagram abre pestaña nueva cada
 * vez, que es de donde viene el tráfico de campaña. La atribución de este
 * archivo subestima el pago y sobreestima el directo, siempre.
 *
 * Migrarlo a localStorage con caducidad es otro trabajo: cambia el
 * significado de "first touch" y hay que decidir la ventana.
 */
export default function UTMPersistence() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const utmSource = searchParams.get('utm_source')
    const utmMedium = searchParams.get('utm_medium')
    const utmCampaign = searchParams.get('utm_campaign')
    const utmContent = searchParams.get('utm_content')
    const utmTerm = searchParams.get('utm_term')

    const guardado = sessionStorage.getItem('pasas_utm')

    // Solo guardar si hay al menos utm_source
    if (!guardado && !utmSource) return

    if (!guardado) {
      const utmData = {
        utm_source: utmSource,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        utm_content: utmContent || undefined,
        utm_term: utmTerm || undefined,
        referrer: document.referrer || undefined,
        landing_url: window.location.href,
        // Hora REAL del toque. buildAcquisitionSource la usa si viene; sin
        // esto ponía la fecha en que se construía el objeto, que en el
        // camino de /registro puede ser días más tarde.
        first_touch_at: new Date().toISOString(),
      }
      sessionStorage.setItem('pasas_utm', JSON.stringify(utmData))

      // Solo en la captura, nunca en cada carga.
      track('utm_capturado', {
        utm_source: utmSource,
        utm_medium: utmMedium ?? undefined,
        utm_campaign: utmCampaign ?? undefined,
        es_first_touch: true,
      })
    }

    // ── Persistencia, con reintento ────────────────────────────────────
    if (sessionStorage.getItem('pasas_utm_persistido') === '1') return

    const crudo = sessionStorage.getItem('pasas_utm')
    if (!crudo) return

    let cancelado = false

    const persistir = async () => {
      try {
        const res = await fetch('/api/track-source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: crudo,
        })
        // El endpoint responde `{ ok, persistido }`. `ok` a secas no basta:
        // también devuelve ok cuando no había sesión y no escribió nada, que
        // es justo el caso que este reintento existe para cubrir.
        const datos = (await res.json()) as { persistido?: boolean }
        if (datos?.persistido) {
          sessionStorage.setItem('pasas_utm_persistido', '1')
          return true
        }
      } catch {
        // Red caída o endpoint fuera: se reintenta abajo.
      }
      return false
    }

    void (async () => {
      if (await persistir()) return

      // Sin sesión todavía. Se espera a que aparezca en vez de adelantar el
      // signInAnonymously de la landing: ese retraso de 2s existe para no
      // competir con el render inicial y no es nuestro para moverlo.
      const supabase = createClient()
      const { data } = supabase.auth.onAuthStateChange(async (_evento, sesion) => {
        if (cancelado || !sesion) return
        if (await persistir()) data.subscription.unsubscribe()
      })

      // Red de seguridad por si la sesión ya existía y el evento no vuelve
      // a dispararse. Un único reintento tardío, no un bucle.
      setTimeout(() => {
        if (!cancelado) void persistir()
      }, 4000)
    })()

    return () => {
      cancelado = true
    }
  }, [searchParams])

  return null
}
