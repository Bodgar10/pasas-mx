/**
 * Carga rondas del Arcade desde uno o más JSON al banco (arcade_rounds).
 *
 *   node scripts/arcade-cargar-rondas.mjs [--aplicar] [--status aprobada|borrador] a.json b.json …
 *
 * Sin --aplicar solo valida y reporta. Cada JSON es un arreglo de
 *   { topic_id, options: [4], odd_index, explanation, difficulty, kind }
 *
 * Qué revisa antes de cargar:
 *   - forma: 4 opciones distintas, odd_index 0–3, dificultad 1–3, largos.
 *   - que el topic exista.
 *   - casi-duplicados: dos rondas (nuevas o ya en la base) que comparten 3+
 *     opciones son la misma pregunta con otra ropa. Se reportan y NO se cargan.
 *
 * 🔴 REVUELVE LAS OPCIONES al cargar. Quien escribe rondas tiende a poner la
 * que sobra al final, y ese patrón delata la respuesta.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const args = process.argv.slice(2)
const aplicar = args.includes('--aplicar')
const iStatus = args.indexOf('--status')
const status = iStatus >= 0 ? args[iStatus + 1] : 'aprobada'
const archivos = args.filter((a, i) => a.endsWith(".json") && (iStatus < 0 || i !== iStatus + 1))

const MAX_OPCION = 28
const MAX_EXPLICACION = 260

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

function revolver(r) {
  const orden = [0, 1, 2, 3]
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[orden[i], orden[j]] = [orden[j], orden[i]]
  }
  return {
    ...r,
    options: orden.map((k) => r.options[k]),
    odd_index: orden.indexOf(r.odd_index),
  }
}

const { data: temas, error: e1 } = await supabase.from('topics').select('id, name, subjects!inner(slug)')
if (e1) throw e1
const nombreTema = new Map(temas.map((t) => [t.id, t.name]))

// Materia del reto de cada tema: misma regla que arcade_materia_de_slug (056).
function materiaDeSlug(s) {
  if (s.startsWith('historia-')) return 'historia'
  if (s.startsWith('biologia-') || ['temas-selectos-biologia', 'ecologia-medio-ambiente'].includes(s)) return 'biologia'
  if (s === 'geografia' || s.startsWith('geografia-')) return 'geografia'
  if (s.startsWith('quimica-') || s.startsWith('fisica-') || ['temas-selectos-quimica', 'temas-selectos-fisica'].includes(s)) return 'ciencias'
  if (s.startsWith('espanol-') || s.startsWith('lengua-comunicacion-') || s.startsWith('literatura-')) return 'espanol'
  return null
}
const materiaTema = new Map(temas.map((t) => [t.id, materiaDeSlug(t.subjects.slug)]))

const { data: existentes, error: e2 } = await supabase
  .from('arcade_rounds')
  .select('id, topic_id, options')
if (e2) throw e2

const nuevas = archivos.flatMap((f) =>
  JSON.parse(readFileSync(f, 'utf8')).map((r, i) => ({ ...r, _origen: `${f.split('/').pop()}#${i}` }))
)

const errores = []
const avisos = []
const buenas = []
const vistas = existentes.map((r) => ({ set: new Set(r.options.map(norm)), origen: `base:${r.id.slice(0, 8)}` }))

for (const r of nuevas) {
  const e = []
  if (!nombreTema.has(r.topic_id)) e.push('topic_id no existe')
  else if (!materiaTema.get(r.topic_id)) e.push('el tema no es de ninguna materia del reto (056)')
  if (!Array.isArray(r.options) || r.options.length !== 4) e.push('no son 4 opciones')
  else {
    if (new Set(r.options.map(norm)).size !== 4) e.push('opciones repetidas')
    for (const o of r.options) {
      if (typeof o !== 'string' || !o.trim()) e.push('opción vacía')
      else if (o.length > MAX_OPCION) avisos.push(`${r._origen}: opción larga (${o.length}) "${o}"`)
    }
  }
  if (!Number.isInteger(r.odd_index) || r.odd_index < 0 || r.odd_index > 3) e.push('odd_index fuera de rango')
  if (![1, 2, 3].includes(r.difficulty)) e.push('difficulty inválida')
  if (!['text', 'year'].includes(r.kind)) e.push('kind inválido')
  if (r.kind === 'year' && r.options?.some((o) => !/^\d{3,4}$/.test(o))) e.push('kind year con opciones que no son años')
  if (typeof r.explanation !== 'string' || !r.explanation.trim()) e.push('sin explicación')
  else if (r.explanation.length > MAX_EXPLICACION) avisos.push(`${r._origen}: explicación larga (${r.explanation.length})`)

  if (e.length) {
    errores.push(`${r._origen}: ${e.join(', ')}`)
    continue
  }

  const set = new Set(r.options.map(norm))
  const choque = vistas.find((v) => [...set].filter((o) => v.set.has(o)).length >= 3)
  if (choque) {
    errores.push(`${r._origen}: casi duplicada de ${choque.origen} (${r.options.join(' | ')})`)
    continue
  }
  vistas.push({ set, origen: r._origen })
  buenas.push(r)
}

const porTema = new Map()
for (const r of buenas) porTema.set(r.topic_id, (porTema.get(r.topic_id) ?? 0) + 1)
const posiciones = [0, 0, 0, 0]
for (const r of buenas) posiciones[r.odd_index]++

console.log(`Leídas: ${nuevas.length} · válidas: ${buenas.length} · descartadas: ${errores.length}`)
console.log(`Posición de la que sobra (antes de revolver): ${posiciones.join(' / ')}`)
console.log(`Temas cubiertos: ${porTema.size}`)
const porMateria = {}
for (const r of buenas) { const m = materiaTema.get(r.topic_id); porMateria[m] = (porMateria[m] ?? 0) + 1 }
console.log(`Por materia: ${JSON.stringify(porMateria)}`)
if (avisos.length) console.log(`\nAvisos (${avisos.length}):\n  ` + avisos.join('\n  '))
if (errores.length) console.log(`\nDescartadas (${errores.length}):\n  ` + errores.join('\n  '))

if (!aplicar) {
  console.log('\nSolo validación. Usa --aplicar para cargar.')
  process.exit(0)
}

const filas = buenas.map((r) => {
  const x = revolver(r)
  return {
    topic_id: x.topic_id,
    options: x.options,
    odd_index: x.odd_index,
    explanation: x.explanation.trim(),
    difficulty: x.difficulty,
    kind: x.kind,
    status,
    source: 'claude',
  }
})

const { data: insertadas, error: e3 } = await supabase
  .from('arcade_rounds')
  .upsert(filas, { onConflict: 'topic_id,options', ignoreDuplicates: true })
  .select('id')
if (e3) throw e3
console.log(`\nInsertadas: ${insertadas.length} con status "${status}"`)

// Los días futuros que cayeron a historia por falta de rondas de esta
// materia se rearman con el calendario (057).
const { data: dias, error: e4 } = await supabase.rpc('arcade_rearmar_calendario', { p_dias: 14 })
if (e4) console.error('No se pudo rearmar el calendario:', e4.message)
else console.log(`Calendario rearmado: ${dias} días con reto`)
