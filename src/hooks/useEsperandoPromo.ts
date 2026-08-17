'use client'

import { useEffect, useState } from 'react'

/**
 * Tope de espera. Pasado esto se pinta el estado SIN promo aunque los datos no
 * hayan llegado.
 *
 * 🔴 Una pantalla congelada sin botón es peor que un cambio de copy tardío: la
 * persona no puede ni comprar ni irse informada. A los 2s la red ya se
 * considera mala, y con el hueco reservado el reemplazo posterior no mueve el
 * layout — solo cambia el texto de dentro.
 */
const TOPE_ESPERA_MS = 2000

/**
 * ¿La pantalla debe callarse el precio y el CTA un momento más?
 *
 * 🔴 LA REGLA: nunca mostrar un precio o un CTA que después cambie. Antes,
 * usePromo y useYaTuvoSuscripcion arrancaban sin datos, la pantalla pintaba el
 * estado sin promo y al llegar los fetch se reescribía todo: la persona leía
 * "Probar una semana gratis · $249" y medio segundo después "Entra con un peso
 * · $1". Un precio que parpadea es un precio anunciado.
 *
 * 🔴 Y LA CONTRAPARTE, IGUAL DE IMPORTANTE: sin indicio de campaña esto es
 * `false` desde el primer render y nadie espera nada. La inmensa mayoría del
 * tráfico no trae promo y no debe pagar ni un milisegundo por una campaña que
 * no le toca. Por eso `hayIndicio` va primero en el `&&` y se calcula síncrono
 * (ver usePromo): si no hay slug ni en la URL ni en sessionStorage, la
 * pantalla pinta hoy exactamente como pintaba antes de todo esto.
 *
 * @param hayIndicio  De usePromo(). Síncrono, sin red.
 * @param cargando    OR de los `cargando` que esa pantalla consulte. La landing
 *                    solo pasa el de usePromo: es pública y no usa
 *                    useYaTuvoSuscripcion.
 */
export function useEsperandoPromo(hayIndicio: boolean, cargando: boolean): boolean {
  const [vencido, setVencido] = useState(false)

  useEffect(() => {
    if (!hayIndicio) return

    // setState desde el callback del timer, nunca en la pasada síncrona del
    // efecto: es lo que evita react-hooks/set-state-in-effect, igual que el
    // truco de la async IIFE en usePromo.
    const timer = setTimeout(() => setVencido(true), TOPE_ESPERA_MS)
    return () => clearTimeout(timer)
  }, [hayIndicio])

  return hayIndicio && cargando && !vencido
}
