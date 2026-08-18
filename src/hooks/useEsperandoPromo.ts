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
 * ── 🔴 EXCEPCIÓN DECIDIDA: LA LANDING SÍ PARPADEA. NO LA "ARREGLES". ─────
 *
 * En `/` el primer render lo hace el SERVIDOR, y un HTML estático no puede
 * conocer la query string. Así que quien llega con `?promo=` ve el precio de
 * lista, luego el hueco, y luego el precio de campaña. Aquí eso es correcto.
 *
 * Por qué se aceptó: esta regla se escribió cuando el 100% del render era
 * cliente, donde cumplirla era gratis. Dejó de serlo. Cumplirla ahora exige
 * que la landing se renderice en cliente, y eso dejaba el HTML inicial de TODO
 * el sitio sin una palabra de texto — sin H1, sin precios, sin conteos. El
 * coste pasó de cero a la indexación del sitio entero. Ver src/app/layout.tsx.
 *
 * Y el daño real es menor de lo que suena: el precio BAJA. Se ve $249 y
 * después "$1". Lo que esta regla existe para evitar es lo contrario —
 * anunciar $1 y cobrar $249—, y eso sigue siendo imposible.
 *
 * 🔴 LO QUE SÍ SIGUE GARANTIZADO, y es la parte que no se puede romper: en ese
 * primer render el precio de lista NUNCA va acompañado de un CTA de promo. No
 * existe una pantalla que diga "Entra con un peso" junto a $249. Se cumple por
 * construcción, no por cuidado: precio, leyenda y CTA salen todos de
 * promoAplica(promo, …) sobre el MISMO valor `promo`, así que cambian juntos en
 * el mismo render o no cambian. Si alguna vez separas esas fuentes, esta
 * garantía se cae.
 *
 * Las demás pantallas del embudo —/planes, /onboarding/preview— siguen siendo
 * cliente entero por su propio <Suspense> y NO parpadean: ahí usePromo lee el
 * slug de forma síncrona en el primer render. Ver la nota de usePromo.
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
