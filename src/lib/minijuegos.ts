/**
 * s43 — Minijuegos de la guía: Conecta 🔗 y Arma los pasos 🧩
 * ===========================================================
 *
 * Lógica PURA (sin React, sin Supabase) que comparten tres consumidores:
 *   - `ConnectBlock` / `OrderStepsBlock` en components/guia/InteractiveBlocks
 *   - `scripts/minijuegos/cargar.ts`, que valida antes de escribir en la base
 *   - las pruebas de tests/unit/minijuegos.test.ts
 *
 * Una sola fuente para las reglas: si el validador deja pasar algo, el
 * componente lo sabe pintar, y al revés.
 *
 * Lugar en la guía (LESSON_ORDER de topic-client):
 *   Analogía → (Pruébalo) → CONECTA → Explicación → ARMA LOS PASOS → Ejemplo resuelto
 *
 * 🔴 NO hay "no aplica" como fila. Un tema sin Conecta o sin Arma simplemente
 * no tiene esa sección. Mejor un solo minijuego excelente que dos de relleno.
 */

// ── Contratos de `sections.data` ─────────────────────────────────────────

/** `type = 'connect'`. Una por (tema × temática): depende de la analogía. */
export interface ConnectData {
  /** Instrucción en una frase. Si falta, se usa la genérica. */
  prompt?: string
  /** Encabezados de columna. Por defecto "Analogía" / "Concepto". */
  left_label?: string
  right_label?: string
  /** 2 a 4. El orden aquí es el de la columna izquierda; la derecha se baraja. */
  pairs: { left: string; right: string }[]
  /** Una frase que conecta el juego con la Explicación que sigue. */
  completion_feedback?: string
}

/** `type = 'order_steps'`. */
export interface OrderStepsData {
  prompt?: string
  /** 3 a 5, YA en el orden correcto. El componente los baraja. */
  steps: string[]
  /** Por qué ese orden tiene sentido + transición al Ejemplo resuelto. */
  completion_feedback?: string
}

// ── Límites (doc PASAS_Minijuegos §2, §3.3, §9.3) ────────────────────────

export const CONNECT_MIN_PARES = 2
export const CONNECT_MAX_PARES = 4
/**
 * Caracteres por tarjeta de Conecta. A 375px cada columna mide ~140px de
 * texto útil: 42 caracteres son tres renglones a 13px. Más que eso rompe el
 * "cabe en un viewport" del documento.
 */
export const CONNECT_MAX_CHARS = 42

export const ORDER_MIN_PASOS = 3
export const ORDER_MAX_PASOS = 5
/** Un paso es una tarjeta de ancho completo: dos renglones a 375px. */
export const ORDER_MAX_CHARS = 80

export const FEEDBACK_MAX_CHARS = 220
export const PROMPT_MAX_CHARS = 120

// ── Validación ───────────────────────────────────────────────────────────

/**
 * `errores` impiden pintar el bloque (el componente devuelve null y el
 * cargador rechaza la fila). `avisos` son de estilo: se reportan al cargar
 * pero no bloquean.
 */
export interface Validacion {
  errores: string[]
  avisos: string[]
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

function textoOk(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export function validarConnect(data: unknown): Validacion {
  const errores: string[] = []
  const avisos: string[] = []
  const d = data as Partial<ConnectData> | null

  if (!d || typeof d !== 'object') return { errores: ['data vacío'], avisos }
  if (!Array.isArray(d.pairs)) return { errores: ['pairs no es arreglo'], avisos }

  const n = d.pairs.length
  if (n < CONNECT_MIN_PARES || n > CONNECT_MAX_PARES) {
    errores.push(`pairs debe tener ${CONNECT_MIN_PARES}-${CONNECT_MAX_PARES} (tiene ${n})`)
  }

  const izq = new Set<string>()
  const der = new Set<string>()
  d.pairs.forEach((p, i) => {
    if (!p || !textoOk(p.left) || !textoOk(p.right)) {
      errores.push(`par ${i + 1}: left/right vacío`)
      return
    }
    if (p.left.length > CONNECT_MAX_CHARS) errores.push(`par ${i + 1}: left con ${p.left.length} > ${CONNECT_MAX_CHARS} caracteres`)
    if (p.right.length > CONNECT_MAX_CHARS) errores.push(`par ${i + 1}: right con ${p.right.length} > ${CONNECT_MAX_CHARS} caracteres`)
    // Una tarjeta repetida haría que dos parejas sean igual de válidas: el
    // par deja de ser inequívoco, que es la regla #1 de Conecta.
    if (izq.has(norm(p.left))) errores.push(`par ${i + 1}: left duplicado "${p.left}"`)
    if (der.has(norm(p.right))) errores.push(`par ${i + 1}: right duplicado "${p.right}"`)
    if (norm(p.left) === norm(p.right)) errores.push(`par ${i + 1}: left y right son el mismo texto`)
    izq.add(norm(p.left))
    der.add(norm(p.right))
  })

  if (d.prompt != null && (!textoOk(d.prompt) || d.prompt.length > PROMPT_MAX_CHARS)) {
    avisos.push(`prompt vacío o > ${PROMPT_MAX_CHARS} caracteres`)
  }
  if (!textoOk(d.completion_feedback)) avisos.push('sin completion_feedback')
  else if (d.completion_feedback.length > FEEDBACK_MAX_CHARS) {
    avisos.push(`completion_feedback > ${FEEDBACK_MAX_CHARS} caracteres`)
  }
  for (const lbl of [d.left_label, d.right_label]) {
    if (lbl != null && (!textoOk(lbl) || lbl.length > 18)) avisos.push('etiqueta de columna vacía o > 18 caracteres')
  }

  return { errores, avisos }
}

export function validarOrderSteps(data: unknown): Validacion {
  const errores: string[] = []
  const avisos: string[] = []
  const d = data as Partial<OrderStepsData> | null

  if (!d || typeof d !== 'object') return { errores: ['data vacío'], avisos }
  if (!Array.isArray(d.steps)) return { errores: ['steps no es arreglo'], avisos }

  const n = d.steps.length
  if (n < ORDER_MIN_PASOS || n > ORDER_MAX_PASOS) {
    errores.push(`steps debe tener ${ORDER_MIN_PASOS}-${ORDER_MAX_PASOS} (tiene ${n})`)
  }
  const vistos = new Set<string>()
  d.steps.forEach((s, i) => {
    if (!textoOk(s)) {
      errores.push(`paso ${i + 1}: vacío`)
      return
    }
    if (s.length > ORDER_MAX_CHARS) errores.push(`paso ${i + 1}: ${s.length} > ${ORDER_MAX_CHARS} caracteres`)
    if (vistos.has(norm(s))) errores.push(`paso ${i + 1}: duplicado "${s}"`)
    vistos.add(norm(s))
    // Numerar dentro del texto regala el orden.
    if (/^\s*(\d+[.)-]|paso\s*\d)/i.test(s)) errores.push(`paso ${i + 1}: empieza con número ("${s.slice(0, 12)}…")`)
  })

  if (d.prompt != null && (!textoOk(d.prompt) || d.prompt.length > PROMPT_MAX_CHARS)) {
    avisos.push(`prompt vacío o > ${PROMPT_MAX_CHARS} caracteres`)
  }
  if (!textoOk(d.completion_feedback)) avisos.push('sin completion_feedback')
  else if (d.completion_feedback.length > FEEDBACK_MAX_CHARS) {
    avisos.push(`completion_feedback > ${FEEDBACK_MAX_CHARS} caracteres`)
  }

  return { errores, avisos }
}

// ── Barajado determinista ────────────────────────────────────────────────
//
// 🔴 NO Math.random. Los bloques son 'use client' pero Next igual los pinta
// en el servidor: un barajado aleatorio da un orden en el servidor y otro en
// el navegador, y React marca error de hidratación. Con la semilla tomada
// del propio contenido, servidor y cliente sacan exactamente el mismo orden,
// y el mismo alumno ve el mismo orden si recarga.

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Permutación de [0..n-1] SIN puntos fijos (ningún índice queda en su
 * lugar), derivada de `semilla`.
 *
 * - En Conecta: ninguna tarjeta de la derecha queda alineada con su pareja.
 * - En Arma los pasos: ningún paso aparece ya en su posición correcta, así
 *   que no se puede "ganar" tocando de arriba abajo.
 *
 * Con n = 1 no existe; se devuelve [0].
 */
export function permutacionSinFijos(n: number, semilla: string): number[] {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i)
  const base = hash(semilla)
  for (let intento = 0; intento < 50; intento++) {
    const rnd = mulberry32(base + intento)
    const p = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    if (p.every((v, i) => v !== i)) return p
  }
  // Respaldo determinista: rotar una posición nunca deja fijos.
  return Array.from({ length: n }, (_, i) => (i + 1) % n)
}

/** Semilla estable a partir del contenido. */
export function semillaDe(textos: string[]): string {
  return textos.join('␟')
}

// ── Arma los pasos: dónde se rompe la secuencia ──────────────────────────

/**
 * Índice del PRIMER slot incorrecto, o -1 si toda la secuencia es correcta.
 * `colocados[k]` es el índice (en el orden correcto) del paso puesto en el
 * slot k. Solo se señala el primero: el documento pide no revelar todo.
 */
export function primerError(colocados: number[]): number {
  for (let k = 0; k < colocados.length; k++) {
    if (colocados[k] !== k) return k
  }
  return -1
}
