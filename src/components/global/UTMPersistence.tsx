'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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

    let suscripcion: { unsubscribe: () => void } | null = null

    void (async () => {
      /**
       * 🔴 SIN SESIÓN LOCAL NO SE MANDA NADA — s34.
       *
       * Antes el POST salía en CADA navegación de un anónimo con UTM, más un
       * reintento a los 4 s, y /api/track-source respondía siempre
       * `persistido: false`: sin sesión no hay a quién escribirle. Eran dos
       * peticiones inútiles por pantalla en justo el tráfico frío.
       *
       * Ahora se mira primero la sesión LOCAL (getSession lee la cookie, no
       * pregunta a Supabase). Sin sesión se espera a SIGNED_IN —login o
       * registro— y solo entonces se manda. El endpoint sigue validando la
       * sesión de verdad del lado del servidor.
       *
       * supabase-js entra con import(): este componente vive en el layout
       * raíz y un import estático lo metía en todas las páginas.
       */
      const { createClient } = await import('@/utils/supabase/client')
      if (cancelado) return
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelado) return

      if (session) {
        if (await persistir()) return
        // Había sesión y aun así no persistió (red caída, endpoint fuera).
        // Un único reintento tardío, no un bucle.
        setTimeout(() => {
          if (!cancelado) void persistir()
        }, 4000)
        return
      }

      // Sin sesión todavía. Se espera a que aparezca (login o registro). La
      // sesión anónima que antes creaba la landing se quitó en s34-F2.
      const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
        if (cancelado || evento !== 'SIGNED_IN' || !sesion) return
        // Fuera del callback y sin await: supabase-js recomienda no esperar
        // trabajo asíncrono dentro de onAuthStateChange.
        void persistir().then((ok) => {
          if (ok) data.subscription.unsubscribe()
        })
      })
      suscripcion = data.subscription
    })()

    return () => {
      cancelado = true
      // Antes el listener nunca se soltaba: cada navegación con el efecto
      // vivo dejaba uno más colgado.
      suscripcion?.unsubscribe()
    }
  }, [searchParams])

  return null
}
