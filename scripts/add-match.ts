/**
 * Agregar memorama (match) — Pasas.mx
 * ------------------------------------
 * Agrega UN bloque interactivo "match" (memorama de 4 parejas) SOLO a los temas
 * que aún no tienen 3 mecánicas distintas. NO toca los que ya están variados,
 * NO regenera nada, SOLO inserta. Idempotente: salta los que ya tienen match.
 *
 * Regla de candidatos: un par (tema × temática) recibe match si NO cumple alguna de:
 *   - ya tiene un bloque 'match', o
 *   - ya tiene los tres: scrubber + steps + sort.
 *
 * Uso:
 *   npx tsx scripts/add-match.ts --topic=<slug> --theme=<name>   (PILOTO)
 *   npx tsx scripts/add-match.ts --limit=20
 *   npx tsx scripts/add-match.ts --all
 *   npx tsx scripts/add-match.ts --all --dry-run
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const INTERACTIVE = ['scrubber', 'steps', 'sort', 'match']
const MATCH_ORDER = 110

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
if (!PILOT_TOPIC && !RUN_ALL && !LIMIT) {
  console.error('Especifica --topic= y --theme= (piloto), o --limit=N, o --all.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const anthropic = new Anthropic()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function buildPrompt(topicName: string, themeName: string, existing: { type: string; content: string }[]) {
  const contenido = existing.map((s) => `[${s.type}] ${s.content}`).join('\n\n')
  const system = `Eres diseñador de contenido educativo interactivo para Pasas.mx (estudiantes mexicanos 13-18, gamificado).
Te doy el contenido de un tema dentro del mundo de "${themeName}". Genera UN memorama (bloque "match") que refuerce el MISMO concepto, manteniendo la temática.
Un memorama empareja conceptos: término↔definición corta, fecha↔evento, fórmula↔nombre, ejemplo↔categoría, etc.
REGLA CLAVE: ambos lados de cada pareja deben ser MUY CORTOS (máximo 4 palabras cada uno) para que quepan en una carta. No inventes datos; si hay matemáticas, exactos.
Responde ÚNICAMENTE con un objeto JSON válido. Sin markdown, sin texto, sin \`\`\`.`
  const user = `Tema: "${topicName}"
Temática: "${themeName}"

Contenido existente (úsalo de base, no lo cambies):
${contenido}

Genera EXACTAMENTE 4 parejas. Formato EXACTO:
{ "type": "match", "title": "Memorama", "content": "frase corta de respaldo", "data": { "prompt": "Empareja cada concepto con su par.", "pairs": [ { "a": "lado corto", "b": "su par corto" } ] } }`
  return { system, user }
}

function parseBlock(raw: string): Record<string, unknown> | null {
  let clean = raw.replace(/```json|```/g, '').trim()
  const m = clean.match(/\{[\s\S]*\}/)
  if (m) clean = m[0]
  const obj = JSON.parse(clean)
  if (obj?.type !== 'match' || !obj?.data?.pairs || !Array.isArray(obj.data.pairs) || obj.data.pairs.length < 3) {
    return null
  }
  return obj
}

async function main() {
  const { data: topics } = await supabase.from('topics').select('id, name, slug')
  const { data: themes } = await supabase.from('themes').select('id, name')
  const topicById = new Map((topics ?? []).map((t) => [t.id, t]))
  const themeById = new Map((themes ?? []).map((t) => [t.id, t]))

  // Traer todas las secciones interactivas (paginado) para saber qué tipos tiene cada par
  const rows: { topic_id: string; theme_id: string; type: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase
      .from('sections')
      .select('topic_id, theme_id, type')
      .not('theme_id', 'is', null)
      .in('type', INTERACTIVE)
      .range(from, from + 999)
    if (error) { console.error('Error leyendo sections:', error.message); process.exit(1) }
    if (!page || page.length === 0) break
    rows.push(...(page as { topic_id: string; theme_id: string; type: string }[]))
    if (page.length < 1000) break
  }

  // Agrupar tipos por par
  const byPair = new Map<string, Set<string>>()
  for (const r of rows) {
    const key = `${r.topic_id}|${r.theme_id}`
    if (!byPair.has(key)) byPair.set(key, new Set())
    byPair.get(key)!.add(r.type)
  }

  // Candidatos: NO tiene match Y NO tiene los tres (scrubber+steps+sort)
  let candidates = [...byPair.entries()]
    .filter(([, types]) => {
      if (types.has('match')) return false
      const hasAllThree = types.has('scrubber') && types.has('steps') && types.has('sort')
      return !hasAllThree
    })
    .map(([key]) => {
      const [topic_id, theme_id] = key.split('|')
      return { topic_id, theme_id }
    })

  if (PILOT_TOPIC) {
    const t = (topics ?? []).find((x) => x.slug === PILOT_TOPIC)
    const th = (themes ?? []).find((x) => x.name === PILOT_THEME)
    if (!t || !th) { console.error(`No encontré topic="${PILOT_TOPIC}" o theme="${PILOT_THEME}".`); process.exit(1) }
    candidates = candidates.filter((c) => c.topic_id === t.id && c.theme_id === th.id)
  }
  if (LIMIT) candidates = candidates.slice(0, LIMIT)

  console.log(`Candidatos a recibir memorama: ${candidates.length}${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  let ok = 0, skip = 0, fail = 0
  for (let i = 0; i < candidates.length; i++) {
    const { topic_id, theme_id } = candidates[i]
    const topic = topicById.get(topic_id)
    const theme = themeById.get(theme_id)
    const label = `[${i + 1}/${candidates.length}] ${topic?.name ?? topic_id} · ${theme?.name ?? theme_id}`
    try {
      const { data: existing } = await supabase
        .from('sections')
        .select('type, content')
        .eq('topic_id', topic_id)
        .eq('theme_id', theme_id)
        .order('display_order', { ascending: true })
      if (!existing || existing.length === 0) { console.log(`${label} → sin texto, salto`); skip++; continue }

      const { system, user } = buildPrompt(topic?.name ?? '', theme?.name ?? '', existing)
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const block = parseBlock(raw)
      if (!block) { console.log(`${label} → match inválido, salto`); skip++; continue }

      if (DRY_RUN) { console.log(`${label} → match con ${(block.data as { pairs: unknown[] }).pairs.length} parejas (no insertado)`); ok++; await sleep(700); continue }

      const { error } = await supabase.from('sections').insert({
        topic_id, theme_id, user_id: null,
        type: 'match',
        title: (block.title as string) ?? 'Memorama',
        content: (block.content as string) ?? 'Memorama del tema.',
        data: block.data as Record<string, unknown>,
        display_order: MATCH_ORDER,
        interests_used: [theme?.name ?? null],
      })
      if (error) throw error
      console.log(`${label} → +1 memorama`)
      ok++
    } catch (e) {
      console.error(`${label} → ERROR: ${e instanceof Error ? e.message : e}`)
      fail++
    }
    await sleep(800)
  }

  console.log(`\nListo. Insertados: ${ok} · Saltados: ${skip} · Errores: ${fail}`)
}

main()
