/**
 * PASAS Arcade — piezas puras del reto diario "¿Cuál sobra?".
 *
 * Sin `server-only` a propósito: las usan la página, el cliente y los tests.
 * Lo que toca la base vive en `arcade-server.ts`.
 *
 * 🔴 LA FECHA DEL RETO ES LA DE LA CIUDAD DE MÉXICO. La fuente de verdad es
 * `arcade_hoy()` en la base (migración 051); `hoyMX()` es su espejo en JS y
 * solo sirve para la llave local del navegador y la cuenta regresiva.
 */

export const RONDAS_POR_RETO = 5

export type RondaArcade = {
  id: string
  options: string[]
  odd: number
  explanation: string
  kind: 'text' | 'year'
  topic: string
  topic_slug: string
  subject_slug: string
  horde_ready: boolean
}

export type RetoArcade = {
  /** YYYY-MM-DD, hora del centro de México. */
  date: string
  number: number
  rounds: RondaArcade[]
}

export type CifrasArcade = {
  players: number
  avg: number | null
  /** % de acierto por ronda, 0–100. null si nadie ha jugado. */
  per_round: (number | null)[]
  /** Cuántos sacaron 0, 1, … 5. */
  dist: number[]
}

/** Debajo de esto las cifras son ruido y no se enseñan. */
export const MIN_JUGADORES_CIFRAS = 20

const ZONA_MX = 'America/Mexico_City'

/** Fecha YYYY-MM-DD en la Ciudad de México. */
export function hoyMX(ahora: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_MX,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

/** "Martes 29 de septiembre" a partir de YYYY-MM-DD. */
export function fechaLarga(fecha: string): string {
  // Mediodía UTC: ningún huso lo mueve de día.
  const d = new Date(`${fecha}T12:00:00Z`)
  const txt = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
    .format(d)
    .replace(',', '')
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/**
 * Segundos que faltan para la medianoche de la Ciudad de México.
 * México no tiene horario de verano desde 2022: UTC-6 todo el año.
 */
export function segundosParaSiguienteReto(ahoraMs: number = Date.now()): number {
  const mx = ahoraMs - 6 * 3600e3
  const d = new Date(mx)
  const siguiente = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
  return Math.max(0, Math.floor((siguiente - mx) / 1000))
}

export function formatoReloj(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  const dos = (x: number) => String(x).padStart(2, '0')
  return `${dos(h)}:${dos(m)}:${dos(s)}`
}

const ETIQUETAS = [
  'Mañana hay revancha',
  'Mañana hay revancha',
  'Vas bien',
  'Bien jugado',
  'Casi perfecto',
  'Perfecto',
] as const

export function etiquetaPuntaje(aciertos: number): string {
  return ETIQUETAS[Math.max(0, Math.min(5, aciertos))]
}

/** Aciertos a partir de lo que tocó el jugador. */
export function calcularResultados(reto: RetoArcade, picks: number[]): boolean[] {
  return reto.rounds.map((r, i) => picks[i] === r.odd)
}

/** El texto que se comparte. Sin spoilers: solo cuadros y puntaje. */
export function textoCompartir(numero: number, resultados: boolean[], dominio: string): string {
  const cuadros = resultados.map((ok) => (ok ? '🟩' : '🟥')).join('')
  const n = resultados.filter(Boolean).length
  return `PASAS Historia #${numero}\n${cuadros} ${n}/${RONDAS_POR_RETO}\n¿Tú cuánto sacas? ${dominio}/arcade`
}

/**
 * El tema del puente a la Horda: el primero que falló; si fue perfecto, la
 * ronda más difícil (la última, porque el reto va de fácil a difícil).
 */
export function rondaDelPuente(reto: RetoArcade, resultados: boolean[]): RondaArcade {
  const fallo = resultados.indexOf(false)
  return reto.rounds[fallo === -1 ? reto.rounds.length - 1 : fallo]
}

export function urlHorda(r: RondaArcade): string {
  return `/guia/${r.subject_slug}/${r.topic_slug}/horda`
}
