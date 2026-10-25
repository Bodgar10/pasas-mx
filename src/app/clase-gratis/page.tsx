import type { Metadata } from 'next'
import { catalogoClaseGratis } from '@/lib/tema-muestra-server'
import ClaseGratisClient from './clase-gratis-client'

/**
 * /clase-gratis — la puerta de la landing B (s51, 26-oct-2026).
 *
 * "Toma tu primera clase gratis": nivel → grado → materia → hobby, y entra a
 * la clase sin cuenta (/tema/...?from=clase), con la oferta de $1 después del
 * primer minijuego.
 *
 * 🔴 CADA MATERIA ABRE SIEMPRE EL MISMO TEMA (tabla clase_gratis, migración
 * 065). El formulario no deja elegir tema y /tema rechaza cualquier otro: así
 * nadie saca el temario entrando gratis una y otra vez.
 *
 * ISR de 1 h: el catálogo solo cambia a mano.
 */
export const metadata: Metadata = {
  title: 'Tu primera clase gratis | PASAS',
  description: 'Elige la materia y con qué te la explicamos: anime, videojuegos, K-pop o fútbol. Sin registrarte.',
  robots: { index: false, follow: false },
}

export const revalidate = 3600

export default async function ClaseGratisPage() {
  const catalogo = await catalogoClaseGratis()
  return <ClaseGratisClient catalogo={catalogo} />
}
