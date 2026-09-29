/**
 * Horda pública: las oleadas 1 a 3 de los temas de historia, sin cuenta.
 *
 * Piezas puras, sin `server-only`: las usan las rutas, el cliente y los tests.
 * Lo que toca la base vive en `horda-publica-server.ts`.
 *
 * 🔴 NO TOCA EL EMBUDO DE COBRO. Al superar la oleada 3, el muro manda al
 * mismo onboarding de siempre con nivel, grado y quién registra ya puestos
 * (ver `urlOnboarding`). Después sigue vista previa → planes → registro →
 * correo → bienvenida → Stripe, sin cambios.
 */

export const OLEADAS_GRATIS = 3
export const OLEADAS_TOTALES = 6
export const PREGUNTAS_POR_OLEADA = 5

/** Materias cuya Horda es pública. Por ahora solo historia (las del Arcade). */
export const MATERIAS_PUBLICAS = [
  'historia-sec-1',
  'historia-sec-2',
  'historia-sec-3',
  'historia-mexico-1',
  'historia-mexico-2',
  'historia-universal',
  'historia-arte',
] as const

export function esMateriaPublica(slug: string): boolean {
  return (MATERIAS_PUBLICAS as readonly string[]).includes(slug)
}

export type ResultadoOleada = 'avanza' | 'repite' | 'reinicia'

/** Mismas reglas que la Horda de adentro (api/horde/answer). */
export function resultadoOleada(correctas: number): ResultadoOleada {
  if (correctas >= 4) return 'avanza'
  if (correctas === 3) return 'repite'
  return 'reinicia'
}

/**
 * Nivel y grado en el vocabulario EXACTO del onboarding (LEVELS[].label y
 * GRADES[].num de onboarding-client.tsx). Si no coinciden letra por letra,
 * el onboarding ignora el prellenado y empieza desde el paso 1.
 */
export const NIVEL_ONBOARDING: Record<string, string> = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria / Bachillerato',
}

export function gradoOnboarding(grado: number | null | undefined): string | null {
  return grado && grado >= 1 && grado <= 3 ? `${grado}°` : null
}

/**
 * URL del onboarding con lo que la Horda ya sabe. `registrante` siempre es
 * 'tutor': el registro de PASAS exige que un adulto abra la cuenta de un
 * menor, y quien tenga 18+ puede cambiarlo con "← Regresar".
 */
export function urlOnboarding(p: {
  nivel: string | null
  grado: string | null
  tema: string
  origen: 'horda_muro' | 'horda_papa'
}): string {
  const q = new URLSearchParams({ desde: 'horda', registrante: 'tutor', tema: p.tema })
  if (p.nivel) q.set('level', p.nivel)
  if (p.grado) q.set('grade', p.grado)
  q.set('utm_source', p.origen)
  return `/onboarding?${q.toString()}`
}

/** Link corto que se comparte con el papá o la mamá. Redirige a urlOnboarding. */
export function urlUnete(subjectSlug: string, topicSlug: string): string {
  return `/unete/${subjectSlug}/${topicSlug}`
}

export function urlHordaPublica(subjectSlug: string, topicSlug: string): string {
  return `/horda/${subjectSlug}/${topicSlug}`
}

/** El mensaje que el alumno le manda a su papá o mamá. Le habla al adulto. */
export function mensajePapa(tema: string, link: string): string {
  return (
    `¿Me ayudas? Estoy estudiando historia en PASAS y ya pasé ${OLEADAS_GRATIS} de ${OLEADAS_TOTALES} oleadas de ${tema} 💪\n` +
    `Para desbloquear las difíciles necesito cuenta. Tiene 7 días gratis:\n${link}`
  )
}
