'use client'

import { useEffect, useState } from 'react'

/**
 * ¿Esta cuenta tuvo alguna suscripción antes?
 *
 * El promotion code de las campañas es `first_time_transaction`: a un cliente
 * que vuelve, Stripe le rechaza el código y se cae la Checkout Session entera.
 * El servidor ya lo protege —resolvePromoParaCheckout devuelve null cuando
 * `yaTuvoSuscripcion` es true—, así que este hook NO existe para que el cobro
 * sea correcto. Existe para que la PANTALLA no prometa un descuento que esa
 * persona no puede canjear.
 *
 * 🔴 FAIL-CLOSED, Y EL DEFAULT ES `true`.
 *
 * Arranca en true, se queda en true si el fetch falla o responde 401/500, y
 * solo baja a false cuando el servidor confirma que la cuenta no tiene NINGUNA
 * suscripción. Es al revés que el instinto, y es a propósito:
 *
 * Con default false, un cliente que regresa vería "$1" durante los ~200ms del
 * fetch y después se le quitaría. Eso es PEOR que no verlo nunca: ya leyó un
 * precio que no le aplica, y el parpadeo parece un error del sitio o —peor—
 * un precio que le quitaron. Con default true no hay parpadeo posible: la
 * promo aparece solo cuando ya se sabe que aplica.
 *
 * El coste del default true recae en el usuario ELEGIBLE, y es benigno: ve un
 * instante de más el precio de lista, que es exactamente lo que se le cobraría
 * si el fetch nunca respondiera. Ningún camino termina prometiendo de menos y
 * cobrando de más.
 *
 * Mismo criterio que leerConsentimiento() de src/lib/consent.ts y que
 * usePromo: sin respuesta, no se promete.
 *
 * 🔴 SIN CACHÉ DE MÓDULO, a diferencia de usePromo. Aquella cachea por slug y
 * el slug no depende de quién mire; esto es un dato POR USUARIO. Una caché que
 * viviera lo que vive el bundle serviría un `false` de la cuenta anterior a la
 * siguiente que entrara en la misma pestaña sin recargar, y ese es justo el
 * error que hace que alguien vea un descuento que no puede canjear. Son dos
 * pantallas del embudo: una petición más por pantalla es más barata que ese
 * fallo.
 */
export function useYaTuvoSuscripcion(): { yaTuvo: boolean; cargando: boolean } {
  const [estado, setEstado] = useState<{ yaTuvo: boolean; cargando: boolean }>({
    yaTuvo: true,
    cargando: true,
  })

  useEffect(() => {
    let vivo = true

    // Todo dentro de la async, igual que en usePromo: un setEstado en la
    // pasada síncrona del efecto dispara react-hooks/set-state-in-effect
    // (renders en cascada). Aquí las escrituras ocurren siempre desde una
    // continuación.
    void (async () => {
      try {
        const res = await fetch('/api/subscription/estado')

        // 401 (sin sesión) y 500 (lectura fallida) caen aquí y NO tocan el
        // estado: se quedan en el default true. No hay rama que convierta un
        // fallo en "es elegible".
        if (!res.ok) {
          if (vivo) setEstado({ yaTuvo: true, cargando: false })
          return
        }

        const data = await res.json()

        // `=== false` y no `!data.yaTuvoSuscripcion`: un cuerpo raro
        // —undefined, null, un string— tiene que caer en true, no en el
        // falsy que abriría la promo.
        const yaTuvo = data?.yaTuvoSuscripcion === false ? false : true
        if (vivo) setEstado({ yaTuvo, cargando: false })
      } catch {
        if (vivo) setEstado({ yaTuvo: true, cargando: false })
      }
    })()

    return () => {
      vivo = false
    }
  }, [])

  return estado
}
