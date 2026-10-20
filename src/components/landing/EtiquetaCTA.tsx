'use client'

import { Hueco } from '@/components/global/HuecoPromo'

/**
 * La etiqueta de un CTA mientras no se sabe si hay campaña.
 *
 * 🔴 Sustituye SOLO el texto de dentro, no el botón. El contenedor —ancho,
 * alto mínimo, padding, radio— es el mismo elemento de siempre, así que el
 * reemplazo no puede mover el layout: no hay dos geometrías que cuadrar, hay
 * una. Es también la razón de que no haga falta medir a mano los seis CTA de
 * esta pantalla, que tienen tamaños distintos entre sí.
 *
 * Vive en su archivo porque la usan la landing y <NavLanding>.
 */
export default function EtiquetaCTA({
  esperando,
  ancho,
  children,
}: {
  esperando: boolean
  ancho: number
  children: React.ReactNode
}) {
  return esperando ? <Hueco alto={16} ancho={ancho} radio={5} /> : <>{children}</>
}
