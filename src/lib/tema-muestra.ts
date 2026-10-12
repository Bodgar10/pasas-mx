/**
 * Muestra de un tema SIN CUENTA, para quien llega desde el reto (s42).
 *
 * El reto es el diagnóstico; el tema que falló es lo que PASAS le ofrece
 * corregir. /tema/[subject]/[topic] le abre ESE tema completo —explicación
 * con su hobby, audio, minijuegos y quiz— con la misma pantalla de la guía
 * (TopicClient en modo muestra), sin guardar avance. Al terminar, el registro
 * con la oferta vigente.
 *
 * Piezas puras: las comparten el servidor, el cliente y las pruebas.
 */

/** Las 4 temáticas, con la clave corta que viaja en la URL. */
export const TEMATICAS = [
  { clave: 'anime', nombre: 'Anime & Manga', corto: 'Anime', emoji: '⚔️' },
  { clave: 'videojuegos', nombre: 'Videojuegos', corto: 'Videojuegos', emoji: '🎮' },
  { clave: 'kpop', nombre: 'K-pop & K-dramas', corto: 'K-pop', emoji: '🎤' },
  { clave: 'futbol', nombre: 'Fútbol', corto: 'Fútbol', emoji: '⚽' },
] as const

export type ClaveTematica = (typeof TEMATICAS)[number]['clave']

export function tematicaPorClave(clave: string | null | undefined) {
  return TEMATICAS.find((t) => t.clave === clave) ?? null
}

/**
 * Lo que TopicClient necesita para el modo muestra. Sin esto, la guía de
 * siempre: ninguna de estas ramas toca a quien tiene cuenta.
 */
export type MuestraTema = {
  /** Materia corta del reto (historia, biologia…), para la medición. */
  materia: string | null
  tematica: ClaveTematica
  tematicaCorta: string
  volverHref: string
  cambiarTematicaHref: string
  /** Horda pública del tema; null si la materia no la tiene. */
  hordaHref: string | null
  oferta: {
    href: string
    cta: string
    micro: string
    badge: string | null
    listaTexto: string | null
    finalTexto: string | null
    despuesTexto: string | null
    /** Link para el mensaje al papá: pasas.mx con la promo. */
    linkPapa: string
  }
}

/** Link del resultado del reto al tema. Sin temática: primero se elige. */
export function urlTemaMuestra(
  subjectSlug: string,
  topicSlug: string,
  o: { tematica?: ClaveTematica | null; perfecto?: boolean } = {}
): string {
  const q = new URLSearchParams({ from: 'arcade' })
  if (o.perfecto) q.set('r', '5')
  if (o.tematica) q.set('tematica', o.tematica)
  return `/tema/${subjectSlug}/${topicSlug}?${q.toString()}`
}

/** La misma lección dentro del producto, para quien ya tiene cuenta. */
export function urlGuia(subjectSlug: string, topicSlug: string, perfecto = false): string {
  return `/guia/${subjectSlug}/${topicSlug}?from=arcade${perfecto ? '&r=5' : ''}`
}

/**
 * Onboarding con lo que la muestra ya sabe: nivel, grado y temática. Empieza
 * en el paso de la temática, ya marcada: un toque y sigue.
 *
 * Sin `utm_source`: el primer contacto (el anuncio) ya está guardado en la
 * pestaña y no se pisa. De dónde vino lo dice `desde=tema`.
 */
export function urlOnboardingDesdeTema(p: {
  nivel: string | null
  grado: string | null
  tema: string
  tematica: string | null
}): string {
  const q = new URLSearchParams({ desde: 'tema', registrante: 'tutor', tema: p.tema })
  if (p.nivel) q.set('level', p.nivel)
  if (p.grado) q.set('grade', p.grado)
  if (p.tematica) q.set('theme', p.tematica)
  return `/onboarding?${q.toString()}`
}
