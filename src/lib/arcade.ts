import { configMateria } from '@/lib/arcade/materias'

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
  /** Materia del reto a la que pertenece esta ronda (056). Útil en el de papás, que mezcla. */
  materia?: string | null
  horde_ready: boolean
}

export type RetoArcade = {
  /** YYYY-MM-DD, hora del centro de México. */
  date: string
  number: number
  /** Materia que se usó de verdad ese día (arcade_challenges.materia, 056). */
  materia?: string | null
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

/**
 * Debajo de esto las cifras son ruido y no se enseñan.
 *
 * 10 y no 20 desde el 30-sep-2026, a propósito: en el arranque el reto juntó
 * 10 jugadores y sin cifras no hay "solo el X% acertó" para los reels. Con 10,
 * cada persona mueve un porcentaje 10 puntos: subirlo a 20+ en cuanto el
 * tráfico lo permita. El umbral del video (video/src/data.mjs) va igual.
 */
export const MIN_JUGADORES_CIFRAS = 10

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

/**
 * Código del resultado para el link que se comparte: "12-11011" = reto #12,
 * aciertos por ronda. No identifica a nadie ni se guarda: solo alimenta la
 * imagen de vista previa de `/arcade/r/[codigo]`.
 */
export function codigoResultado(numero: number, resultados: boolean[]): string {
  return `${numero}-${resultados.map((ok) => (ok ? '1' : '0')).join('')}`
}

export function leerCodigo(codigo: string): { numero: number; resultados: boolean[] } | null {
  const m = /^(\d{1,5})-([01]{5})$/.exec(codigo)
  if (!m) return null
  return { numero: Number(m[1]), resultados: [...m[2]].map((c) => c === '1') }
}

/**
 * El texto que se comparte (s34-F3, formato fijo):
 *
 *   ¿Cuál sobra? #12 · Historia
 *   🟩🟩🟥🟩🟥  3/5
 *   ¿Tú cuántas sacas? https://pasas.mx/arcade/r/12-11010
 *
 * 🔴 Nunca lleva preguntas, respuestas ni temas: sería spoiler para quien lo
 * recibe. El link /arcade/r/... lleva su propia vista previa con el puntaje.
 * `sitio` va con protocolo (SITIO de lib/seo): WhatsApp e Instagram solo
 * vuelven clicable de forma confiable un link con https://.
 */
export function textoCompartir(numero: number, resultados: boolean[], sitio: string, materia?: string | null): string {
  const cuadros = resultados.map((ok) => (ok ? '🟩' : '🟥')).join('')
  const n = resultados.filter(Boolean).length
  const link = `${sitio.replace(/\/+$/, '')}/arcade/r/${codigoResultado(numero, resultados)}`
  return `¿Cuál sobra? #${numero} · ${configMateria(materia).corto}\n${cuadros}  ${n}/${RONDAS_POR_RETO}\n¿Tú cuántas sacas? ${link}`
}

/**
 * El tema del puente a la Horda: el primero que falló; si fue perfecto, la
 * ronda más difícil (la última, porque el reto va de fácil a difícil).
 */
export function rondaDelPuente(reto: RetoArcade, resultados: boolean[]): RondaArcade {
  const fallo = resultados.indexOf(false)
  return reto.rounds[fallo === -1 ? reto.rounds.length - 1 : fallo]
}

/**
 * ORIGEN DE LA VISITA al Arcade: de dónde llegó (el banner de la landing, un
 * link compartido, directo…). Se guarda en sessionStorage para que lo hereden
 * los eventos de la Horda pública y del onboarding de la misma pestaña, y así
 * seguir a quien entró por el banner hasta el registro.
 *
 * 🔴 No es un utm: UTMPersistence guarda el PRIMER toque y un utm interno
 * pisaría el canal real (TikTok, orgánico…). Esto viaja aparte, con
 * `?desde=`, y solo como propiedad de los eventos.
 */
export const LLAVE_ORIGEN_ARCADE = 'pasas_arcade_origen'
export const ORIGENES_ARCADE = ['landing_banner', 'resultado_compartido', 'arcade', 'directo'] as const
export type OrigenArcade = (typeof ORIGENES_ARCADE)[number]

/** Lee el origen de la sesión. Nunca lanza (modo privado, SSR). */
export function leerOrigenArcade(): OrigenArcade | null {
  try {
    const v = window.sessionStorage.getItem(LLAVE_ORIGEN_ARCADE)
    return (ORIGENES_ARCADE as readonly string[]).includes(v ?? '') ? (v as OrigenArcade) : null
  } catch {
    return null
  }
}

/**
 * Fija el origen con lo que trae la URL, si trae algo válido. Sin `?desde=`
 * se conserva el que ya había en la sesión; si no hay ninguno, 'directo'.
 * Devuelve el origen vigente.
 */
export function fijarOrigenArcade(desde: string | null): OrigenArcade {
  const valido = (ORIGENES_ARCADE as readonly string[]).includes(desde ?? '') ? (desde as OrigenArcade) : null
  const vigente = valido ?? leerOrigenArcade() ?? 'directo'
  try {
    window.sessionStorage.setItem(LLAVE_ORIGEN_ARCADE, vigente)
  } catch {}
  return vigente
}

/**
 * Id anónimo del navegador para los juegos gratis (Arcade y Horda pública).
 * Sin datos personales: un UUID en localStorage. Es lo único que enlaza las
 * partidas de una misma persona en `arcade_plays` y `horda_publica_avance`.
 * Solo en el navegador; si localStorage no está, se genera uno por carga.
 */
const LLAVE_ANON = 'pasas-arcade:anon'
export function anonIdJuegos(): string {
  try {
    const guardado = window.localStorage.getItem(LLAVE_ANON)
    if (guardado && guardado.length >= 8) return guardado
  } catch {}
  const nuevo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  try {
    window.localStorage.setItem(LLAVE_ANON, nuevo)
  } catch {}
  return nuevo
}

/**
 * El puente va a la Horda PÚBLICA (oleadas 1 a 3 sin cuenta), no a la de
 * /guia, que pide login. Quien tiene cuenta juega la completa desde su guía.
 */
export function urlHorda(r: RondaArcade): string {
  return `/horda/${r.subject_slug}/${r.topic_slug}?desde=arcade`
}
