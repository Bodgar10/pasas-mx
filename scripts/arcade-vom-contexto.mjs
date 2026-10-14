/**
 * Exporta el material para escribir frases de "Verdadero o mentira" de una materia.
 *
 *   node scripts/arcade-vom-contexto.mjs <materia> <salida_dir> [--total 300]
 *
 * Escribe <salida_dir>/<materia>.json: un arreglo de temas del reto (los que
 * tienen rondas aprobadas en arcade_rounds) con
 *   { topic_id, subject, tema, meta, ya, quiz: [...], datos: [...] }
 * `meta` = frases que le tocan (proporcional a sus rondas de "¿Cuál sobra?",
 * mínimo 4, siempre par: mitad verdades y mitad mentiras). `ya` = frases que
 * el tema ya tiene en arcade_vom_rounds.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const [materia, salida] = process.argv.slice(2)
const iTotal = process.argv.indexOf('--total')
const total = iTotal >= 0 ? Number(process.argv[iTotal + 1]) : 300
if (!materia || !salida) {
  console.error('Uso: node scripts/arcade-vom-contexto.mjs <materia> <salida_dir> [--total 300]')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Misma regla que arcade_materia_de_slug (056).
function materiaDeSlug(s) {
  if (s.startsWith('historia-')) return 'historia'
  if (s.startsWith('biologia-') || ['temas-selectos-biologia', 'ecologia-medio-ambiente'].includes(s)) return 'biologia'
  if (s === 'geografia' || s.startsWith('geografia-')) return 'geografia'
  if (s.startsWith('quimica-') || s.startsWith('fisica-') || ['temas-selectos-quimica', 'temas-selectos-fisica'].includes(s)) return 'ciencias'
  if (s.startsWith('espanol-') || s.startsWith('lengua-comunicacion-') || s.startsWith('literatura-')) return 'espanol'
  return null
}

// PostgREST corta en 1000 filas: se pide por páginas.
async function todas(consulta) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999)
    if (error) throw error
    filas.push(...data)
    if (data.length < 1000) return filas
  }
}

const rondas = await todas(() =>
  supabase.from('arcade_rounds').select('id, topic_id, topics!inner(name, subjects!inner(slug))').eq('status', 'aprobada').order('id')
)

const temas = new Map()
for (const r of rondas) {
  const subject = r.topics.subjects.slug
  if (materiaDeSlug(subject) !== materia) continue
  const t = temas.get(r.topic_id) ?? { topic_id: r.topic_id, subject, tema: r.topics.name, rondas: 0 }
  t.rondas++
  temas.set(r.topic_id, t)
}
const lista = [...temas.values()].sort((a, b) => (a.subject + a.tema).localeCompare(b.subject + b.tema))
const sumaRondas = lista.reduce((s, t) => s + t.rondas, 0)
for (const t of lista) t.meta = Math.max(4, 2 * Math.round((total * t.rondas) / sumaRondas / 2))

const ids = lista.map((t) => t.topic_id)
const [quiz, secciones, vom] = await Promise.all([
  todas(() => supabase.from('quiz_questions').select('id, topic_id, question, correct_answer, options').in('topic_id', ids).order('id')),
  todas(() => supabase.from('sections').select('id, topic_id, type, title, content').in('topic_id', ids).is('user_id', null).in('type', ['key_fact', 'tip', 'explanation']).order('id')),
  todas(() => supabase.from('arcade_vom_rounds').select('id, topic_id').in('topic_id', ids).order('id')),
])

for (const t of lista) {
  t.ya = vom.filter((v) => v.topic_id === t.topic_id).length
  t.quiz = quiz
    .filter((q) => q.topic_id === t.topic_id)
    .map((q) => ({ p: q.question, ok: q.correct_answer, otras: (q.options ?? []).filter((o) => o !== q.correct_answer) }))
  t.datos = secciones
    .filter((s) => s.topic_id === t.topic_id)
    .map((s) => `[${s.type}] ${s.title ? s.title + ': ' : ''}${(s.content ?? '').replace(/\s+/g, ' ').slice(0, 700)}`)
  delete t.rondas
}

mkdirSync(salida, { recursive: true })
writeFileSync(`${salida}/${materia}.json`, JSON.stringify(lista, null, 1))
console.log(`${materia}: ${lista.length} temas · meta ${lista.reduce((s, t) => s + t.meta, 0)} frases → ${salida}/${materia}.json`)
