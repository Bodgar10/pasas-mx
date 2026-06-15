/**
 * Enriquecimiento masivo de lecciones — Pasas.mx
 * ------------------------------------------------
 * Recorre cada (tema x temática) que YA tiene contenido y le AGREGA bloques
 * interactivos (sort / scrubber / steps) generados por Sonnet.
 * NO borra ni modifica el texto, el quiz ni nada existente. Solo inserta.
 * Es idempotente: si un tema+temática ya tiene bloques interactivos, lo salta.
 *
 * Cómo correrlo (desde la raíz del proyecto):
 *   npx tsx scripts/enrich-interactive.ts --topic=numeros-enteros-suma-resta --theme=Videojuegos   (PILOTO: un solo par)
 *   npx tsx scripts/enrich-interactive.ts --limit=20                                                (los primeros 20)
 *   npx tsx scripts/enrich-interactive.ts --all                                                     (TODO)
 *   npx tsx scripts/enrich-interactive.ts --all --dry-run                                           (no inserta, solo muestra)
 *
 * Requiere en tu .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL  (o SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *
 * Si te faltan dependencias del script:  npm i -D tsx dotenv
 */

import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------- Config ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const INTERACTIVE_TYPES = ['sort', 'scrubber', 'steps']
const START_ORDER = 100 // los interactivos van al final, después del texto (1-5)

const args = process.argv.slice(2)
const getArg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const hasFlag = (k: string) => args.includes(`--${k}`)
const PILOT_TOPIC = getArg('topic')
const PILOT_THEME = getArg('theme')
const LIMIT = getArg('limit') ? parseInt(getArg('limit')!, 10) : null
const DRY_RUN = hasFlag('dry-run')
const RUN_ALL = hasFlag('all')

if (!SUPABASE_URL || !SERVICE_KEY || !process.env.ANTHROPIC_API_KEY) {
  console.error('Faltan variables de entorno. Revisa .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const anthropic = new Anthropic()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- Prompt ----------
function buildPrompt(topicName: string, themeName: string, existing: { type: string; content: string }[]) {
  const contenido = existing.map((s) => `[${s.type}] ${s.content}`).join('\n\n')

  const system = `Eres diseñador de contenido educativo interactivo para Pasas.mx (estudiantes mexicanos de 13-18, gamificado).
Te doy el contenido EN TEXTO de un tema, ya escrito, dentro del mundo de la temática "${themeName}".
NO reescribas ese texto. Tu trabajo es crear bloques INTERACTIVOS que refuercen el MISMO concepto, manteniendo la temática "${themeName}".
No inventes datos, fechas ni fórmulas; si hay matemáticas, los números deben ser exactos.
Responde ÚNICAMENTE con un array JSON válido. Sin markdown, sin texto adicional, sin \`\`\`.`

  const user = `Tema: "${topicName}"
Temática: "${themeName}"

Contenido existente (no lo cambies, úsalo de base):
${contenido}

Genera entre 1 y 3 bloques interactivos. Elige el tipo según el contenido:
- "steps": procesos paso a paso o acumulación de una cantidad. "visual":"bar" si hay un número que sube/baja (cada paso lleva "delta" numérico) y "start" inicial; "visual":"chain" para pasos narrativos (cada paso solo "text").
- "sort": clasificar en 2 categorías (máx 3). 4 a 6 items; cada item lleva "b" = índice de la cubeta correcta (0,1,...).
- "scrubber": un eje/continuo (recta numérica, línea del tiempo, escala). "min" < "max", "start" en rango, 2 a 5 "points" con valor "v" y etiqueta "l".

Si el tema no encaja con naturalidad, devuelve [].

Formato EXACTO de cada bloque (el campo "content" es una frase corta de respaldo, obligatoria):
[
  { "type": "scrubber", "title": "Pruébalo", "content": "respaldo",
    "data": { "intro": "1-2 frases con la temática", "unit": "qué se mide", "min": -64, "max": 120, "start": 64, "points": [ { "v": 64, "l": "etiqueta" } ], "question": "opcional" } },
  { "type": "sort", "title": "Clasifica", "content": "respaldo",
    "data": { "prompt": "instrucción en una frase", "buckets": ["A","B"], "items": [ { "t": "texto", "b": 0 } ] } },
  { "type": "steps", "title": "Resuélvelo conmigo", "content": "respaldo",
    "data": { "intro": "1-2 frases con la temática", "visual": "bar", "start": 75, "steps": [ { "text": "qué pasa", "delta": -40 } ] } }
]`

  return { system, user }
}

function parseBlocks(raw: string): Record<string, unknown>[] {
  let clean = raw.replace(/```json|```/g, '').trim()
  const match = clean.match(/\[[\s\S]*\]/)
  if (match) clean = match[0]
  const parsed = JSON.parse(clean)
  if (!Array.isArray(parsed)) throw new Error('La respuesta no es un array')
  return parsed.filter(
    (b) => b && INTERACTIVE_TYPES.includes(b.type) && b.data && typeof b.content === 'string'
  )
}

// ---------- Main ----------
async function main() {
  if (!PILOT_TOPIC && !RUN_ALL && !LIMIT) {
    console.error('Especifica --topic= y --theme= (piloto), o --limit=N, o --all.')
    process.exit(1)
  }

  // Catálogos
  const { data: topics } = await supabase.from('topics').select('id, name, slug')
  const { data: themes } = await supabase.from('themes').select('id, name')
  const topicById = new Map((topics ?? []).map((t) => [t.id, t]))
  const themeById = new Map((themes ?? []).map((t) => [t.id, t]))

  // Pares (tema, temática) que tienen contenido con temática
  const { data: rows } = await supabase
    .from('sections')
    .select('topic_id, theme_id')
    .not('theme_id', 'is', null)

  let pairs = [...new Map((rows ?? []).map((r) => [`${r.topic_id}|${r.theme_id}`, r])).values()]

  // Filtro piloto
  if (PILOT_TOPIC) {
    const t = (topics ?? []).find((x) => x.slug === PILOT_TOPIC)
    const th = (themes ?? []).find((x) => x.name === PILOT_THEME)
    if (!t || !th) {
      console.error(`No encontré topic slug="${PILOT_TOPIC}" o theme name="${PILOT_THEME}".`)
      process.exit(1)
    }
    pairs = pairs.filter((p) => p.topic_id === t.id && p.theme_id === th.id)
  }
  if (LIMIT) pairs = pairs.slice(0, LIMIT)

  console.log(`Pares a procesar: ${pairs.length}${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  let ok = 0, skip = 0, fail = 0
  for (let i = 0; i < pairs.length; i++) {
    const { topic_id, theme_id } = pairs[i]
    const topic = topicById.get(topic_id)
    const theme = themeById.get(theme_id)
    const label = `[${i + 1}/${pairs.length}] ${topic?.name ?? topic_id} · ${theme?.name ?? theme_id}`

    try {
      // Idempotencia: ya tiene interactivos?
      const { data: existingInteractive } = await supabase
        .from('sections')
        .select('id')
        .eq('topic_id', topic_id)
        .eq('theme_id', theme_id)
        .in('type', INTERACTIVE_TYPES)
        .limit(1)
      if (existingInteractive && existingInteractive.length > 0) {
        console.log(`${label} → ya tiene, salto`); skip++; continue
      }

      // Texto existente
      const { data: existing } = await supabase
        .from('sections')
        .select('type, content')
        .eq('topic_id', topic_id)
        .eq('theme_id', theme_id)
        .order('display_order', { ascending: true })
      if (!existing || existing.length === 0) { console.log(`${label} → sin texto, salto`); skip++; continue }

      // Sonnet
      const { system, user } = buildPrompt(topic?.name ?? '', theme?.name ?? '', existing)
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const blocks = parseBlocks(raw)

      if (blocks.length === 0) { console.log(`${label} → 0 bloques (no aplica), salto`); skip++; continue }

      if (DRY_RUN) {
        console.log(`${label} → ${blocks.length} bloques: ${blocks.map((b) => b.type).join(', ')} (no insertado)`)
        ok++; await sleep(800); continue
      }

      const toInsert = blocks.map((b, idx) => ({
        topic_id, theme_id, user_id: null,
        type: b.type as string,
        title: (b.title as string) ?? null,
        content: b.content as string,
        data: b.data as Record<string, unknown>,
        display_order: START_ORDER + idx,
        interests_used: [theme?.name ?? null],
      }))
      const { error } = await supabase.from('sections').insert(toInsert)
      if (error) throw error

      console.log(`${label} → +${blocks.length} bloques (${blocks.map((b) => b.type).join(', ')})`)
      ok++
    } catch (e) {
      console.error(`${label} → ERROR: ${e instanceof Error ? e.message : e}`)
      fail++
    }
    await sleep(1000) // gentil con el rate limit
  }

  console.log(`\nListo. Insertados: ${ok} · Saltados: ${skip} · Errores: ${fail}`)
}

main()
