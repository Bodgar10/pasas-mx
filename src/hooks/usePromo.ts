'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
 * El slug de esta visita: `?promo=` → sessionStorage['pasas_promo'] → ''.
 *
 * 🔴 SE LEE DE window.location, NO DE useSearchParams. Ese hook obliga a Next
 * a renderizar en CLIENTE todo el árbol hasta el <Suspense> más cercano, y en
 * la landing ese árbol es la página entera: el HTML que recibía Google no
 * tenía H1, ni precios, ni conteos. Ver la nota de src/app/layout.tsx.
 *
 * Lo que se pierde al no usar el hook: este valor deja de reaccionar a una
 * navegación de cliente que cambie el `?promo=` sin desmontar el componente.
 * Eso hoy no ocurre — los enlaces con slug (conPromo) siempre van a OTRA ruta,
 * que remonta. Si algún día se hace `router.push` al mismo pathname con otro
 * slug, esto no se enteraría.
 */
function leerSlug(): string {
  const enUrl = new URLSearchParams(window.location.search).get('promo')
  let enStorage: string | null = null
  try {
    enStorage = window.sessionStorage.getItem('pasas_promo')
  } catch {
    // Safari en privado y navegadores con almacenamiento bloqueado tiran aquí.
    // Sin storage no hay indicio: se pinta normal, sin esperar.
  }
  return (enUrl ?? enStorage ?? '').trim().toLowerCase()
}

/** El valor no cambia mientras el componente vive, así que nadie se suscribe. */
const noSuscribirse = () => () => {}

/**
 * Resuelve la promoción vigente para esta sesión.
 *
 * 🔴 FAIL-CLOSED. Devuelve `promo: null` si no hay slug, si el servidor
 * responde { promo: null } (apagada o fuera de fechas — eso lo decide el
 * servidor, no esta función) o si el fetch falla. Sin respuesta se cobra
 * precio de lista. Nunca al revés.
 *
 * 🔴 `promo` arranca en null y no en undefined: no hay estado "indeciso" que
 * invite a pintar un precio a medias. Lo que decide qué hacer mientras
 * `cargando` es true NO es este hook, es `hayIndicio` + useEsperandoPromo.
 */
export function usePromo(): {
  promo: PromoPublica | null
  cargando: boolean
  hayIndicio: boolean
} {
  const [estado, setEstado] = useState<{ promo: PromoPublica | null; cargando: boolean }>({
    promo: null,
    cargando: true,
  })

  /**
   * ¿HAY MOTIVO PARA SOSPECHAR QUE ESTA VISITA TRAE CAMPAÑA?
   *
   * 🔴 useSyncExternalStore Y NO UN useState PEREZOSO. La diferencia importa y
   * no es estilo.
   *
   * Antes esto era `useState(() => leer sessionStorage)`. Funcionaba porque
   * TODA la pantalla se renderizaba en cliente: no había HTML de servidor con
   * el que desajustarse. Al arreglar el CSR de la landing, ese HTML ya existe,
   * y un inicializador que devuelve `false` en servidor y `true` en cliente es
   * un error de hidratación — React tira el árbol y lo vuelve a renderizar
   * entero en cliente, que es exactamente lo que acabamos de quitar.
   *
   * `getServerSnapshot` devuelve '' y es lo que se usa en la pasada de
   * hidratación, así que no hay desajuste; React vuelve a preguntar por
   * `getSnapshot` justo después y ahí aparece el slug real.
   *
   * Y en las pantallas que SIGUEN siendo cliente entero por su propio
   * <Suspense> —/planes, /onboarding/preview— no hay hidratación de este
   * subárbol, así que se usa `getSnapshot` desde el primer render: el hueco se
   * reserva igual de pronto que antes y esas pantallas no cambian nada.
   *
   * El ref hace que la lectura ocurra UNA vez por montaje. Es a propósito y es
   * el mismo contrato que el useState perezoso de antes: PromoPersistence
   * escribe en sessionStorage desde un efecto, y sin el ref `getSnapshot`
   * empezaría a devolver un valor distinto sin que nadie notifique el cambio.
   */
  const slugRef = useRef<string | null>(null)
  const getSnapshot = useCallback(() => {
    if (slugRef.current === null) slugRef.current = leerSlug()
    return slugRef.current
  }, [])
  const getServerSnapshot = useCallback(() => '', [])
  const slug = useSyncExternalStore(noSuscribirse, getSnapshot, getServerSnapshot)

  const hayIndicio = slug !== ''

  useEffect(() => {
    let vivo = true

    // Todo el cuerpo va dentro de la función async, incluidos los casos que
    // se resuelven sin red. No es adorno: `setEstado` llamado directo en el
    // cuerpo del efecto dispara la regla react-hooks/set-state-in-effect
    // (renders en cascada). Aquí las escrituras de estado ocurren siempre
    // desde una continuación, nunca en la pasada síncrona del efecto.
    void (async () => {
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
  }, [slug])

  return { ...estado, hayIndicio }
}
