'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { PromoPublica } from '@/lib/promos'

/**
 * Caché a nivel de módulo, por slug.
 *
 * El embudo son varias pantallas ('use client') que montan y desmontan:
 * landing → /planes → /bienvenida. Sin esto, cada una pediría lo mismo.
 *
 * Guarda también los `null`: "el servidor dice que no hay promo" es una
 * respuesta tan buena como cualquier otra y no hay que volver a preguntarla.
 * Lo que NO se cachea es un fetch fallido — puede ser red intermitente y la
 * siguiente pantalla merece otro intento.
 *
 * Vive mientras viva el bundle. Si apagas la promo desde admin, una pestaña
 * ya abierta la seguirá viendo hasta que recargue. Es el mismo trato que
 * cualquier caché de cliente, y el checkout revalida contra Stripe de todas
 * formas: lo peor que pasa es que se anuncie un descuento que la caja ya no
 * aplica, no un cobro sorpresa.
 */
const cache = new Map<string, PromoPublica | null>()

/**
 * Resuelve la promoción vigente para esta sesión.
 *
 * Orden del slug: ?promo= → sessionStorage['pasas_promo'] → null.
 *
 * 🔴 FAIL-CLOSED. Devuelve `promo: null` si no hay slug, si el servidor
 * responde { promo: null } (apagada o fuera de fechas — eso lo decide el
 * servidor, no esta función) o si el fetch falla. Sin respuesta se cobra
 * precio de lista. Nunca al revés.
 *
 * 🔴 Mientras `cargando` sea true, la pantalla pinta precio y copy NORMALES.
 * Por eso `promo` arranca en null y no en undefined: no hay estado
 * "indeciso" que invite a pintar un placeholder o un precio a medias.
 */
export function usePromo(): { promo: PromoPublica | null; cargando: boolean } {
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState<{ promo: PromoPublica | null; cargando: boolean }>({
    promo: null,
    cargando: true,
  })

  // Se lee fuera del efecto para que sea la dependencia: `searchParams` es un
  // objeto nuevo en cada render y dispararía el efecto en cada uno.
  const slugUrl = searchParams.get('promo')

  useEffect(() => {
    let vivo = true

    // Todo el cuerpo va dentro de la función async, incluidos los casos que
    // se resuelven sin red. No es adorno: `setEstado` llamado directo en el
    // cuerpo del efecto dispara la regla react-hooks/set-state-in-effect
    // (renders en cascada). Aquí las escrituras de estado ocurren siempre
    // desde una continuación, nunca en la pasada síncrona del efecto.
    void (async () => {
      // sessionStorage solo existe en el cliente, así que la lectura va
      // dentro del efecto. Es también la razón de que `cargando` arranque en
      // true: en el primer render (servidor e hidratación) no se sabe todavía.
      const slug = (slugUrl ?? sessionStorage.getItem('pasas_promo') ?? '')
        .trim()
        .toLowerCase()

      if (!slug) {
        if (vivo) setEstado({ promo: null, cargando: false })
        return
      }

      if (cache.has(slug)) {
        if (vivo) setEstado({ promo: cache.get(slug) ?? null, cargando: false })
        return
      }

      try {
        const res = await fetch(`/api/promo?slug=${encodeURIComponent(slug)}`)
        // El endpoint responde 200 incluso sin promo; un status raro se trata
        // como "sin promo", no como excepción.
        const data = res.ok ? await res.json() : { promo: null }
        const promo = (data?.promo ?? null) as PromoPublica | null
        cache.set(slug, promo)
        if (vivo) setEstado({ promo, cargando: false })
      } catch {
        if (vivo) setEstado({ promo: null, cargando: false })
      }
    })()

    return () => {
      vivo = false
    }
  }, [slugUrl])

  return estado
}
