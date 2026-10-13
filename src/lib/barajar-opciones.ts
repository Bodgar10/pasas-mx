/**
 * Reacomoda las opciones de un lote de preguntas de opción múltiple para que
 * la letra correcta no siga un patrón.
 *
 * Por qué existe: el modelo copia el orden de los ejemplos del prompt
 * (A, B, C, D, A…) y los alumnos lo notan. En s43 se rebarajaron en la base
 * quiz_questions, horde_questions y diagnostic_questions con estas mismas reglas.
 *
 * Reglas de la secuencia de letras correctas dentro del lote:
 *   - nunca tres seguidas en escalera (ABC, BCD, DCB…), ni la misma letra 3 veces
 *   - nunca alternancia de cuatro (ABAB)
 *   - pares iguales o en escalera, como máximo uno de cada cuatro saltos
 *   - ninguna letra domina el lote
 *
 * No se mueve una pregunta cuyo texto depende de la posición: explicaciones que
 * dicen "la opción A", opciones tipo "todas las anteriores" o "A y C".
 */

type Opcion = { letter: string; text: string }
type Pregunta = {
  question: string
  options: Opcion[]
  correct_answer: string
  explanation?: string | null
  hint?: string | null
}

const LETRAS = ['A', 'B', 'C', 'D']

const REF_LETRA = /(opci[oó]n|inciso|respuesta|letra)(es|s)?\s+\(?[A-D]\b/
const REF_PAREN = /\b[A-D]\)/
const REF_ORDINAL = /(primera|segunda|tercera|cuarta|[uú]ltima) opci/i
const OPC_POSICIONAL = /todas las anteriores|ninguna de las anteriores|all of the above|none of the above/i
const OPC_PAR = /\b[A-D] (y|and|e) [A-D]\b/

function dependeDePosicion(p: Pregunta): boolean {
  const texto = `${p.question} ${p.explanation ?? ''} ${p.hint ?? ''}`
  if (REF_LETRA.test(texto) || REF_PAREN.test(texto) || REF_ORDINAL.test(texto)) return true
  const opciones = (p.options ?? []).map((o) => o.text).join(' | ')
  return OPC_POSICIONAL.test(opciones) || OPC_PAR.test(opciones)
}

const sig = (l: string) => LETRAS[(LETRAS.indexOf(l) + 1) % 4]

function cuenta(s: string[], f: (a: string, b: string) => boolean): number {
  let n = 0
  for (let i = 1; i < s.length; i++) if (f(s[i - 1], s[i])) n++
  return n
}

function permitida(s: string[], l: string, total: number): boolean {
  const n = s.length
  const tope = Math.max(1, Math.floor((total - 1) / 4))
  const ult = s[n - 1]
  const pen = s[n - 2]
  if (n >= 3 && l === pen && ult === s[n - 3]) return false // ABAB
  if (s.filter((x) => x === l).length >= Math.max(2, Math.ceil(total / 4) + 1)) return false
  if (n >= 1 && l === ult) {
    if (cuenta(s, (a, b) => a === b) >= tope || (n >= 2 && ult === pen)) return false
  }
  if (n >= 1 && l === sig(ult)) {
    if (cuenta(s, (a, b) => b === sig(a)) >= tope || (n >= 2 && ult === sig(pen))) return false
  }
  if (n >= 1 && ult === sig(l)) {
    if (cuenta(s, (a, b) => a === sig(b)) >= tope || (n >= 2 && pen === sig(ult))) return false
  }
  return true
}

function alAzar<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function barajarOpciones<T extends Pregunta>(preguntas: T[]): T[] {
  if (!Array.isArray(preguntas)) return preguntas
  const secuencia: string[] = []

  return preguntas.map((p) => {
    const correcta = p.options?.find((o) => o.letter === p.correct_answer)
    const fija = !correcta || p.options.length !== 4 || dependeDePosicion(p)
    if (fija) {
      secuencia.push(p.correct_answer)
      return p
    }

    const candidatas = alAzar(LETRAS)
    const destino =
      candidatas.find((l) => permitida(secuencia, l, preguntas.length)) ??
      candidatas.find((l) => l !== secuencia[secuencia.length - 1]) ??
      candidatas[0]
    secuencia.push(destino)

    const distractores = alAzar(p.options.filter((o) => o !== correcta).map((o) => o.text))
    const options = LETRAS.map((letter) => ({
      letter,
      text: letter === destino ? correcta.text : (distractores.shift() as string),
    }))
    return { ...p, options, correct_answer: destino }
  })
}
