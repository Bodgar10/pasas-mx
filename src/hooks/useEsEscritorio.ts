'use client'

import { useSyncExternalStore } from 'react'

/**
 * ¿La ventana mide 768 px o más? Mismo corte que el viejo
 * `window.innerWidth >= 768` (matchMedia mide el mismo ancho, con barra).
 *
 * useSyncExternalStore y no useState + efecto: en navegación interna ya nace
 * con el valor correcto (sin el render extra ni el parpadeo del layout de
 * celular). En el servidor y en la hidratación vale false, como antes.
 */
const CONSULTA = '(min-width: 768px)'

function suscribirse(alCambiar: () => void): () => void {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener('change', alCambiar)
  return () => mq.removeEventListener('change', alCambiar)
}

const leer = () => window.matchMedia(CONSULTA).matches
const enServidor = () => false

export function useEsEscritorio(): boolean {
  return useSyncExternalStore(suscribirse, leer, enServidor)
}
