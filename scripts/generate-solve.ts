/**
 * scripts/generate-solve.ts
 *
 * Genera los bloques "Papel y Lapiz": 4 ejercicios de respuesta abierta
 * numerica por topic, SOLO para materias de matematicas.
 *
 * A diferencia de la horda, esto NO tiene tabla propia: se inserta como
 * una seccion de tipo 'solve' en public.sections. El ejercicio se genera
 * UNA vez por topic y la misma fila se replica en cada tematica que ya
 * tenga contenido: un ejercicio de area de triangulo es identico para el
 * alumno de K-pop y el de gaming.
 *
 * SOLO INSERTA. Nunca borra. Idempotente: salta topics que ya tienen
 * bloque solve. Reanudable: si se corta, se vuelve a correr igual.
 *
 * Uso:
 *   npx tsx scripts/generate-solve.ts --dry-run
 *   npx tsx scripts/generate-solve.ts --subject=matematicas-sec-2 --limit=1
 *   npx tsx scripts/generate-solve.ts --level=middle_school
 *   caffeinate -i npx tsx scripts/generate-solve.ts --all
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8000
const EXERCISES = 3

/** Materias que reciben bloques solve. Ninguna otra: en historia o espanol
 *  la respuesta no es un numero. */
const MATH_SLUGS = [
  'matematicas-sec-1',
  'matematicas-sec-2',
  'matematicas-sec-3',
  'matematicas-1-algebra',
  'matematicas-2-geometria-trigonometria',
  'matematicas-3-geometria-analitica',
  'matematicas-4-funciones',
  'calculo-diferencial',
  'calculo-integral',
  'probabilidad-estadistica',
]

/** Ciencias: mismo bloque, pero la pista 1 SIEMPRE es la formula con sus
 *  simbolos explicados. Memorizar formulas es la mitad del examen. */
const SCIENCE_SLUGS = [
  'fisica-sec',
  'fisica-1',
  'fisica-2',
  'quimica-sec',
  'quimica-1',
  'quimica-2',
]

const SOLVE_SLUGS = [...MATH_SLUGS, ...SCIENCE_SLUGS]
const isScience = (slug?: string) => SCIENCE_SLUGS.includes(slug ?? '')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const found = args.find((a) => a.startsWith(`--${name}=`))
  return found ? found.split('=').slice(1).join('=') : undefined
}

const SUBJECT = flag('subject')
const TOPIC = flag('topic')
const LEVEL = flag('level')
const LIMIT = flag('limit') ? parseInt(flag('limit')!, 10) : undefined
const DRY_RUN = args.includes('--dry-run')

type TopicRow = {
  id: string
  name: string
  slug: string
  subjects: { slug: string; name: string; education_level: string; grades: number[] } | null
}

type Exercise = {
  q: string
  answer: number
  unit?: string
  tolerance?: number
  hints: string[]
  solution: string[]
}

function gradeLabel(level: string, grades: number[]): string {
  const g = grades?.[0] ?? 1
  return level === 'middle_school'
    ? `${g}o de secundaria (aprox. ${11 + g} anos)`
    : `${g}o de preparatoria (aprox. ${14 + g} anos)`
}

function buildPrompt(topic: TopicRow): string {
  const ctx = topic.subjects
    ? gradeLabel(topic.subjects.education_level, topic.subjects.grades)
    : 'secundaria'

  const scienceRules = isScience(topic.subjects?.slug)
    ? `
REGLAS EXTRA PARA CIENCIAS (fisica y quimica):
En estas materias, memorizar la formula es la mitad del examen. Por eso la escalera
de pistas tiene una estructura FIJA:
- Pista 1: SIEMPRE el enunciado de la formula, con cada simbolo explicado.
  Ejemplo: "La segunda ley de Newton es F = m x a, donde F es fuerza en newtons,
  m es masa en kilogramos y a es aceleracion en m/s^2."
  Esta pista NO menciona los numeros del ejercicio. Es la formula pura.
- Pista 2: identifica que dato del enunciado corresponde a cada simbolo.
  Ejemplo: "En este problema m = 4 kg y a = 3 m/s^2. Te falta encontrar F."
- Pistas intermedias: si hay que despejar o convertir unidades, un paso por pista.
- Ultima pista: la operacion completa con los numeros sustituidos.

SI EL TEMA NO ADMITE EJERCICIOS NUMERICOS (nomenclatura organica, modelos atomicos,
clasificacion de compuestos, historia de la ciencia), responde con un array VACIO: []
Es preferible no generar nada a inventar ejercicios forzados.

PROHIBIDO: ejercicios que necesiten un diagrama o figura para entenderse.
- MAL: "en el circuito de la figura, cual es la resistencia total?"
- MAL: "observa el diagrama de fuerzas y calcula..."
- BIEN: "dos resistencias de 4 y 6 ohms estan en serie. Cual es la resistencia total?"
El enunciado debe describir la situacion completa con palabras.

UNIDADES: el resultado siempre lleva unidad (N, m/s, kg, mol, atm, grados C).
Usala en el campo "unit". Cuida que las unidades del enunciado sean coherentes:
si das masa en gramos y piden newtons, la conversion debe ser parte de las pistas.
`
    : ''

  return `Eres un profesor de matematicas mexicano que disena ejercicios de practica.

TEMA: "${topic.name}"
MATERIA: ${topic.subjects?.name ?? 'Matematicas'}
NIVEL: ${ctx}

Genera EXACTAMENTE ${EXERCISES} ejercicios de respuesta abierta, ordenados de menor a mayor dificultad.

REGLA MAS IMPORTANTE — LA RESPUESTA SIEMPRE ES UN NUMERO:
El alumno escribe un numero en un campo de texto y el sistema lo compara numericamente.
Por eso "answer" debe ser SIEMPRE un numero: 20, -7, 4.5, 0.25.
NUNCA una expresion algebraica. Prohibido "3x^2", "y = 2x + 1", "x^2 + C".
Si el tema es algebraico o de calculo, replantea el ejercicio para que el resultado sea numerico.
Ejemplos de replanteo correcto:
- En vez de "deriva f(x) = x^3" -> "si f(x) = x^3, cuanto vale f'(2)?" (respuesta: 12)
- En vez de "halla la ecuacion de la recta" -> "cual es la pendiente de la recta que pasa por (1,2) y (3,8)?" (respuesta: 3)
- En vez de "factoriza x^2 + 5x + 6" -> "cual es la raiz mas grande de x^2 + 5x + 6 = 0?" (respuesta: -2)

LAS PISTAS — ESCALERA DE AYUDA:
"hints" es un arreglo de pistas que se revelan de una en una cuando el alumno falla o las pide.
LA CANTIDAD LA DECIDES TU: las que hagan falta para que un alumno atorado pueda resolverlo.
Minimo 2, sin tope practico. Si un ejercicio de una division necesita 2, pon 2. Si una integral
por partes necesita 9, pon 9. Es matematicas: lo que importa es que la escalera este completa,
no que sea corta.
Cuenta los pasos REALES del procedimiento y da una pista por paso.
En un bloque de 3 ejercicios es NORMAL que uno tenga 2 pistas y otro 8. Si los 3 salen con la
misma cantidad, no estas calibrando: revisa cuantos pasos tiene cada uno.
- Pista 1: recuerda el concepto o la formula, sin numeros del ejercicio.
- Pistas intermedias: identifica los datos y como se sustituyen.
- ULTIMA pista: da la operacion COMPLETA con los numeros ya sustituidos, lista para meter en la calculadora.
  Ejemplo correcto de ultima pista: "Puedes hacer 2 x (12 + 4.5)"
  Esto es CORRECTO: el alumno tiene todo y solo calcula.

PROHIBIDO ABSOLUTAMENTE: que cualquier pista contenga un RESULTADO ya calculado, ni el final ni uno intermedio.
- MAL: "16.5 x 2 = 33" (revela el resultado final)
- MAL: "el area es 20"
- MAL: "Ya sabes que n = 10" (revela un paso intermedio que el alumno debia calcular)
- BIEN: "2 x (12 + 4.5)" (da la operacion, no el resultado)
- BIEN: "Despeja n dividiendo 360 entre el angulo central"
Cada pista dice QUE operacion hacer, nunca CUANTO da.

ENUNCIADO: una sola pregunta con una sola respuesta numerica.
- MAL: "cuantos lados tiene y cuanto mide el angulo interior? Escribe solo el angulo"
- BIEN: "cuanto mide cada angulo interior de un poligono cuyo angulo central es 36 grados?"
Si necesitas escribir "escribe solo..." es senal de que el enunciado esta mal planteado.

El enunciado NUNCA incluye la formula ni la sustitucion. Eso es trabajo de las pistas.
- MAL: "cuanto mide cada lado? (usa que lado = 2 x 8 x sen(36))"
- BIEN: "un pentagono regular esta inscrito en una circunferencia de radio 8 cm. Cuanto mide cada lado?"
Si el alumno necesita una formula que no vio en la leccion, escoge otro ejercicio.

LA SOLUCION:
"solution" es un arreglo de 2 a 5 pasos que SI cierra la cuenta y llega al resultado.
Solo se muestra si el alumno agota las pistas y pide verla. Aqui si puedes escribir "= 33".

OTRAS REGLAS:
1. Espanol de Mexico, directo, para un adolescente. Contextos cotidianos mexicanos cuando ayude.
2. NO uses analogias de videojuegos, K-pop ni ninguna tematica. Los ejercicios son neutros.
3. "unit": la unidad se pinta fija junto al campo y el alumno NO la escribe. Usa cm2, m, kg, grados, etc. Omite el campo si el resultado no tiene unidad.
4. "tolerance" es OBLIGATORIA cuando el resultado no es exacto. Reglas:
   - Resultado entero o decimal exacto (20, -7, 4.5) -> tolerance: 0
   - Resultado con decimales infinitos o irracional (1/6, pi, raices) -> tolerance: 0.01
     y redondea "answer" a 2 decimales. Ejemplo: 1/6 -> answer: 0.17, tolerance: 0.01
   NUNCA escribas answer con mas de 2 decimales. "answer": 0.1666666667 es un ERROR:
   el alumno resuelve bien, escribe 0.17, y el sistema lo reprueba.
5. PREFIERE numeros que den resultado exacto. Escoge los datos del enunciado para que
   la respuesta sea entera o de un decimal. Solo usa tolerance cuando el tema lo exija
   de verdad (trigonometria, raices, pi).
6. Enunciado maximo 200 caracteres. Cada pista maximo 120. Cada paso de solucion maximo 120.
7. Texto plano. Sin Markdown, sin LaTeX. Notacion con caracteres normales: x^2, raiz de 16, 3/4.
8. Los 4 ejercicios deben ser distintos entre si, no variaciones del mismo numero.

${scienceRules}
FORMATO DE SALIDA:
Responde UNICAMENTE con un array JSON de ${EXERCISES} objetos. Sin preambulo, sin backticks.
Si el tema no admite ejercicios numericos, responde con un array vacio: []
Cada objeto: { "q": "...", "answer": 20, "unit": "cm2", "tolerance": 0, "hints": ["...", "..."], "solution": ["...", "..."] }`
}

function parseResponse(raw: string): Exercise[] {
  const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = clean.indexOf('[')
  const end = clean.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No se encontro un array JSON')
  const slice = clean.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    return JSON.parse(slice.replace(/,(\s*[}\]])/g, '$1'))
  }
}

/**
 * Detecta si una pista revela el resultado. Busca "= <answer>" en vez del
 * numero suelto: si la respuesta es 12 y el enunciado dice "12 m de largo",
 * el 12 aparece legitimamente. Lo que no puede aparecer es la cuenta cerrada.
 */
function hintRevealsAnswer(hint: string, answer: number): boolean {
  const a = String(answer)
  const alt = Number.isInteger(answer) ? `${answer}.0` : a
  const re = new RegExp(`=\\s*-?\\s*(${a.replace('.', '\\.')}|${alt.replace('.', '\\.')})\\b`)
  return re.test(hint)
}

function validate(list: Exercise[]): string | null {
  if (!Array.isArray(list)) return 'La respuesta no es un array'
  if (list.length !== EXERCISES) return `Se esperaban ${EXERCISES} ejercicios, llegaron ${list.length}`

  const seen = new Set<string>()
  for (const e of list) {
    if (!e?.q?.trim()) return 'Ejercicio sin enunciado'
    const key = e.q.trim().toLowerCase()
    if (seen.has(key)) return `Ejercicio repetido: ${e.q.slice(0, 40)}`
    seen.add(key)

    if (typeof e.answer !== 'number' || !Number.isFinite(e.answer)) {
      return `answer no es numerico en: ${e.q.slice(0, 40)}`
    }
    // Un answer con muchos decimales y tolerance 0 es un falso negativo
    // garantizado: el alumno resuelve bien, redondea, y el sistema lo reprueba.
    const decimals = (String(e.answer).split('.')[1] ?? '').length
    if (decimals > 2 && !(e.tolerance && e.tolerance > 0)) {
      return `answer con ${decimals} decimales y sin tolerance en: ${e.q.slice(0, 40)}`
    }
    if (!Array.isArray(e.hints) || e.hints.length < 2) {
      return `hints debe tener al menos 2 elementos en: ${e.q.slice(0, 40)}`
    }
    if (e.hints.some((h) => !h?.trim())) return `Pista vacia en: ${e.q.slice(0, 40)}`
    if (!Array.isArray(e.solution) || e.solution.length < 2) {
      return `solution debe tener al menos 2 pasos en: ${e.q.slice(0, 40)}`
    }
    if (e.solution.some((s) => !s?.trim())) return `Paso vacio en: ${e.q.slice(0, 40)}`

    // Solo se revisa la ULTIMA pista. Las anteriores enuncian la formula e
    // identifican datos, y en fisica los datos suelen ser numeros redondos
    // (h = 10 m, g = 9.8) que coinciden con el resultado por casualidad.
    // La operacion final vive en la ultima pista: ahi si importa.
    const lastHint = e.hints[e.hints.length - 1]
    if (hintRevealsAnswer(lastHint, e.answer)) {
      console.log(`\n  [debug] answer=${e.answer} | ultima pista: "${lastHint}"`)
      return `La ultima pista revela el resultado (${e.answer}) en: ${e.q.slice(0, 40)}`
    }
  }
  return null
}

async function fetchTopics(): Promise<TopicRow[]> {
  let q = supabase
    .from('topics')
    .select('id, name, slug, subjects!inner(slug, name, education_level, grades)')
    .eq('published', true)
    .order('name')

  if (TOPIC) {
    q = q.eq('slug', TOPIC)
  } else if (SUBJECT) {
    q = q.eq('subjects.slug', SUBJECT)
  } else {
    q = q.in('subjects.slug', SOLVE_SLUGS)
    if (LEVEL) q = q.eq('subjects.education_level', LEVEL)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as TopicRow[]
}

async function alreadyHasSolve(topicId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('sections')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .eq('type', 'solve')
  if (error) throw error
  return (count ?? 0) > 0
}

/** Tematicas en las que ese topic YA tiene contenido. No se insertan
 *  ejercicios en tematicas sin leccion: no habria donde estudiarlos. */
async function themesWithContent(topicId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sections')
    .select('theme_id')
    .eq('topic_id', topicId)
    .not('theme_id', 'is', null)
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.theme_id as string))]
}

async function main() {
  const scope = TOPIC
    ? `topic=${TOPIC}`
    : SUBJECT
      ? `subject=${SUBJECT}`
      : LEVEL
        ? `matematicas | level=${LEVEL}`
        : 'todas las matematicas'

  console.log('=== generate-solve ===')
  console.log(`alcance: ${scope}${LIMIT ? ` | limit=${LIMIT}` : ''}${DRY_RUN ? ' | DRY RUN' : ''}\n`)

  const topics = await fetchTopics()
  if (topics.length === 0) {
    console.log('No se encontraron topics con ese filtro. Revisa el slug.')
    return
  }
  console.log(`topics encontrados: ${topics.length}\n`)

  let attempted = 0
  let processed = 0
  let skipped = 0
  let failed = 0
  let rows = 0
  let inTokens = 0
  let outTokens = 0

  for (const topic of topics) {
    if (LIMIT !== undefined && attempted >= LIMIT) break

    if (await alreadyHasSolve(topic.id)) {
      skipped++
      console.log(`- SALTA  ${topic.name} (ya tiene bloque)`)
      continue
    }

    const themes = await themesWithContent(topic.id)
    if (themes.length === 0) {
      skipped++
      console.log(`- SALTA  ${topic.name} (sin contenido en ninguna tematica)`)
      continue
    }

    if (DRY_RUN) {
      attempted++
      processed++
      console.log(`- DRY    ${topic.name} (${topic.subjects?.slug}) -> ${themes.length} tematicas`)
      continue
    }

    attempted++
    process.stdout.write(`- ...    ${topic.name} `)

    try {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: buildPrompt(topic) }],
      })

      inTokens += res.usage.input_tokens
      outTokens += res.usage.output_tokens

      if (res.stop_reason === 'max_tokens') {
        throw new Error('Respuesta truncada por MAX_TOKENS')
      }

      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('\n')

      const exercises = parseResponse(text)

      // El modelo devuelve [] cuando el tema no admite ejercicios numericos
      // (nomenclatura, modelos atomicos). No es una falla: se salta.
      if (Array.isArray(exercises) && exercises.length === 0) {
        skipped++
        console.log(`\r- SALTA  ${topic.name} (sin ejercicios numericos posibles)`)
        // La llamada a la API ya se hizo, asi que la pausa de rate limit
        // sigue siendo necesaria antes de la siguiente iteracion.
        await new Promise((r) => setTimeout(r, 1200))
        continue
      }

      const problem = validate(exercises)
      if (problem) throw new Error(problem)

      const data = {
        intro: 'Resuélvelo en tu cuaderno y escribe el resultado',
        questions: exercises,
      }

      const inserts = themes.map((themeId) => ({
        topic_id: topic.id,
        theme_id: themeId,
        type: 'solve',
        content: 'Ejercicios de práctica: resuelve en tu cuaderno.',
        display_order: 99,
        data,
      }))

      const { error } = await supabase.from('sections').insert(inserts)
      if (error) throw error

      processed++
      rows += inserts.length
      console.log(`\r- OK     ${topic.name} (${EXERCISES} ejercicios x ${themes.length} temáticas)`)
    } catch (err) {
      failed++
      console.log(`\r- FALLA  ${topic.name}: ${(err as Error).message}`)
    }

    await new Promise((r) => setTimeout(r, 1200))
  }

  const cost = (inTokens / 1_000_000) * 3 + (outTokens / 1_000_000) * 15
  console.log('\n=== resumen ===')
  console.log(`generados: ${processed} | filas insertadas: ${rows} | saltados: ${skipped} | fallidos: ${failed}`)
  console.log(`tokens: ${inTokens} in / ${outTokens} out`)
  console.log(`costo aprox: $${cost.toFixed(2)} USD`)
  if (failed > 0) {
    console.log('Los fallidos no quedaron a medias. Vuelve a correr el mismo comando.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
