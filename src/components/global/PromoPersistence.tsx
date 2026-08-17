'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Captura ?promo=slug y lo conserva durante la sesión.
 *
 * Mismo patrón que UTMPersistence: sessionStorage, first-touch wins, montado
 * una sola vez en el layout raíz. Dos diferencias a propósito:
 *
 * 🔴 1. Guarda SOLO el slug, nunca el copy ni el precio. El copy y el
 * descuento se piden al servidor en cada pantalla (usePromo → /api/promo).
 * Si los cacheáramos aquí, quien abrió la pestaña en agosto vería en octubre
 * una promo ya apagada, o un copy que ya cambiaste desde /admin/promociones.
 * La sessionStorage no tiene forma de enterarse de que apagaste el
 * interruptor; el servidor sí.
 *
 * 2. No hace fetch a ningún endpoint. UTMPersistence postea a
 * /api/track-source porque el origen de la visita hay que registrarlo; aquí
 * todavía no hay nada que registrar — el canje se sabrá en el webhook.
 */
export default function PromoPersistence() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const promo = searchParams.get('promo')

    // Solo guardar si viene el parámetro
    if (!promo) return

    // Guardar en sessionStorage para sobrevivir navegación interna
    const existing = sessionStorage.getItem('pasas_promo')
    if (existing) return // First touch wins — no sobreescribir

    // Minúsculas: el slug es la PK de promo_campaigns y ahí vive en
    // minúsculas. Un enlace compartido con ?promo=PASAS1 debe funcionar.
    sessionStorage.setItem('pasas_promo', promo.trim().toLowerCase())
  }, [searchParams])

  return null
}
