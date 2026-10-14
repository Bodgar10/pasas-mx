/**
 * Carga frases de "Verdadero o mentira" desde uno o más JSON (arcade_vom_rounds).
 *
 *   node scripts/arcade-cargar-vom.mjs [--aplicar] [--status aprobada|borrador] a.json b.json …
 *
 * Sin --aplicar solo valida y reporta. Cada JSON es un arreglo de
 *   { topic_id, statement, is_true, explanation, difficulty }
 * Reglas de redacción: supabase/seeds/vom/REGLAS.md
 *
 * Qué revisa antes de cargar:
 *   - forma: largos de la tabla (062), dificultad 1–3, que la explicación
 *     empiece con "Verdad:" o "Mentira:" y coincida con is_true.
 *   - que el tema exista y sea de una materia del reto.
 *   - duplicados exactos (normalizados) en el mismo tema, nuevos o ya en la base:
 *     se descartan.
 *   - parecidas: dos frases de la misma materia que comparten casi todas sus
 *     palabras de contenido. Solo se avisan: hay que revisarlas a mano.
 *   - equilibrio: cada tema con al menos 2 verdades y 2 mentiras (contando la base).
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const args = process.argv.slice(2)
const aplicar = args.includes('--aplicar')
const iStatus = args.indexOf('--status')
const status = iStatus >= 0 ? args[iStatus + 1] : 'aprobada'
const archivos = args.filter((a, i) => a.endsWith('.json') && (iStatus < 0 || i !== iStatus + 1))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function todas(consulta) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999)
    if (error) throw error
    filas.push(...data)
    if (data.length < 1000) return filas
  }
}

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()

const VACIAS = new Set(
  'el la los las un una unos unas de del al a en y o u e que se su sus por para con sin es son fue fueron era eran lo le les como mas muy no si ya hay ha han este esta estos estas ese esa'.split(' ')
)
const palabras = (s) => new Set(norm(s).split(' ').filter((p) => p.length > 2 && !VACIAS.has(p)))
function parecido(a, b) {
  const comunes = [...a].filter((p) => b.has(p)).length
  return comunes / Math.min(a.size, b.size)
}

// Misma regla que arcade_materia_de_slug (056).
function materiaDeSlug(s) {
  if (s.startsWith('historia-')) return 'historia'
  if (s.startsWith('biologia-') || ['temas-selectos-biologia', 'ecologia-medio-ambiente'].includes(s)) return 'biologia'
  if (s === 'geografia' || s.startsWith('geografia-')) return 'geografia'
  if (s.startsWith('quimica-') || s.startsWith('fisica-') || ['temas-selectos-quimica', 'temas-selectos-fisica'].includes(s)) return 'ciencias'
  if (s.startsWith('espanol-') || s.startsWith('lengua-comunicacion-') || s.startsWith('literatura-')) return 'espanol'
  return null
}

const temas = await todas(() => supabase.from('topics').select('id, name, subjects!inner(slug)').order('id'))
const nombreTema = new Map(temas.map((t) => [t.id, t.name]))
const materiaTema = new Map(temas.map((t) => [t.id, materiaDeSlug(t.subjects.slug)]))

const existentes = await todas(() =>
  supabase.from('arcade_vom_rounds').select('id, topic_id, statement, is_true, status').neq('status', 'rechazada').order('id')
)

const nuevas = archivos.flatMap((f) =>
  JSON.parse(readFileSync(f, 'utf8')).map((r, i) => ({ ...r, _origen: `${f.split('/').pop()}#${i}` }))
)

const errores = []
const avisos = []
const buenas = []
const vistas = existentes.map((r) => ({
  topic_id: r.topic_id,
  clave: norm(r.statement),
  pal: palabras(r.statement),
  materia: materiaTema.get(r.topic_id),
  texto: r.statement,
  origen: `base:${r.id.slice(0, 8)}`,
}))

for (const r of nuevas) {
  const e = []
  if (!nombreTema.has(r.topic_id)) e.push('topic_id no existe')
  else if (!materiaTema.get(r.topic_id)) e.push('el tema no es de ninguna materia del reto (056)')
  const st = typeof r.statement === 'string' ? r.statement.trim() : ''
  const ex = typeof r.explanation === 'string' ? r.explanation.trim() : ''
  if (st.length < 10 || st.length > 160) e.push(`statement mide ${st.length}`)
  if (ex.length < 10 || ex.length > 260) e.push(`explanation mide ${ex.length}`)
  if (typeof r.is_true !== 'boolean') e.push('is_true no es booleano')
  else if (!ex.startsWith(r.is_true ? 'Verdad:' : 'Mentira:')) e.push('la explicación no empieza con Verdad:/Mentira: según is_true')
  if (![1, 2, 3].includes(r.difficulty)) e.push('difficulty inválida')
  if (e.length) {
    errores.push(`${r._origen}: ${e.join(', ')}`)
    continue
  }

  const clave = norm(st)
  const igual = vistas.find((v) => v.topic_id === r.topic_id && v.clave === clave)
  if (igual) {
    errores.push(`${r._origen}: duplicada de ${igual.origen} "${st}"`)
    continue
  }
  const pal = palabras(st)
  const materia = materiaTema.get(r.topic_id)
  const similar = vistas.find((v) => v.materia === materia && Math.min(v.pal.size, pal.size) >= 3 && parecido(v.pal, pal) >= 0.75)
  if (similar) avisos.push(`${r._origen} ~ ${similar.origen}\n      "${st}"\n      "${similar.texto}"`)

  vistas.push({ topic_id: r.topic_id, clave, pal, materia, texto: st, origen: r._origen })
  buenas.push({ ...r, statement: st, explanation: ex })
}

// Equilibrio por tema, contando lo que ya hay en la base.
const cuenta = new Map()
for (const r of [...existentes.filter((x) => x.status === 'aprobada' || status === 'borrador'), ...buenas]) {
  const c = cuenta.get(r.topic_id) ?? { v: 0, m: 0 }
  r.is_true ? c.v++ : c.m++
  cuenta.set(r.topic_id, c)
}
const cortos = [...new Set(buenas.map((r) => r.topic_id))]
  .filter((id) => cuenta.get(id).v < 2 || cuenta.get(id).m < 2)
  .map((id) => `${nombreTema.get(id)} (${cuenta.get(id).v}V/${cuenta.get(id).m}M)`)

const porMateria = {}
for (const r of buenas) {
  const m = materiaTema.get(r.topic_id)
  porMateria[m] = (porMateria[m] ?? 0) + 1
}
const dif = [0, 0, 0]
for (const r of buenas) dif[r.difficulty - 1]++
const largas = buenas.filter((r) => r.statement.split(/\s+/).length > 16).length

console.log(`Leídas: ${nuevas.length} · válidas: ${buenas.length} · descartadas: ${errores.length}`)
console.log(`Verdades / mentiras: ${buenas.filter((r) => r.is_true).length} / ${buenas.filter((r) => !r.is_true).length}`)
console.log(`Dificultad 1/2/3: ${dif.join(' / ')} · frases de más de 16 palabras: ${largas}`)
console.log(`Temas: ${new Set(buenas.map((r) => r.topic_id)).size} · por materia: ${JSON.stringify(porMateria)}`)
if (cortos.length) console.log(`\nTemas sin 2 verdades y 2 mentiras (${cortos.length}):\n  ` + cortos.join('\n  '))
if (avisos.length) console.log(`\nParecidas, revisar a mano (${avisos.length}):\n  ` + avisos.join('\n  '))
if (errores.length) console.log(`\nDescartadas (${errores.length}):\n  ` + errores.join('\n  '))

if (!aplicar) {
  console.log('\nSolo validación. Usa --aplicar para cargar.')
  process.exit(0)
}

const filas = buenas.map((r) => ({
  topic_id: r.topic_id,
  statement: r.statement,
  is_true: r.is_true,
  explanation: r.explanation,
  difficulty: r.difficulty,
  status,
  source: 'claude',
}))

let insertadas = 0
for (let i = 0; i < filas.length; i += 500) {
  const { data, error } = await supabase
    .from('arcade_vom_rounds')
    .upsert(filas.slice(i, i + 500), { onConflict: 'topic_id,statement', ignoreDuplicates: true })
    .select('id')
  if (error) throw error
  insertadas += data.length
}
console.log(`\nInsertadas: ${insertadas} con status "${status}"`)
