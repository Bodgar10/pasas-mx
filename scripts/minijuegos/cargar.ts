/**
 * Cargar minijuegos (Conecta 🔗 + Arma los pasos 🧩) — Pasas.mx · s43
 * -------------------------------------------------------------------
 * Lee UN archivo de contenido por curso (scripts/minijuegos/contenido/<slug>.json),
 * valida TODO con las mismas reglas que usa el componente (src/lib/minijuegos.ts)
 * y escribe en public.sections.
 *
 * Idempotente: por cada (tema × temática) del archivo borra SOLO sus filas
 * 'connect' y 'order_steps' base (user_id NULL) y las vuelve a insertar. No
 * toca ninguna otra sección.
 *
 * Si una sola validación falla, no escribe nada.
 *
 * Uso:
 *   npx tsx scripts/minijuegos/cargar.ts scripts/minijuegos/contenido/matematicas-sec-1.json --dry-run
 *   npx tsx scripts/minijuegos/cargar.ts <archivo> --sql salida.sql   (genera SQL transaccional, no escribe)
 *   npx tsx scripts/minijuegos/cargar.ts <archivo> --sql-compacto salida.sql   (una sola sentencia, ~3x más ligera)
 *   npx tsx scripts/minijuegos/cargar.ts <archivo>                    (escribe con la service key)
 *
 * Requiere en .env.local (solo el modo directo): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * ── Formato del archivo ──────────────────────────────────────────────────
 * {
 *   "subject": "matematicas-sec-1",
 *   "topics": {
 *     "<topic-slug>": {
 *       // Arma los pasos COMPARTIDO por las 4 temáticas (procedimiento académico).
 *       // null = "no aplica" en este tema.
 *       "order_steps": { "prompt": "...", "steps": [...], "completion_feedback": "..." },
 *       "temas": {
 *         "Anime & Manga":    { "connect": { ... } },
 *         "Fútbol":           { "connect": { ... }, "order_steps": { ... } },  // override opcional
 *         "K-pop & K-dramas": { "connect": null },   // null = no aplica
 *         "Videojuegos":      { "connect": { ... } }
 *       }
 *     }
 *   }
 * }
 */

import { readFileSync, writeFileSync } from 'node:fs'
import {
  validarConnect,
  validarOrderSteps,
  type ConnectData,
  type OrderStepsData,
} from '../../src/lib/minijuegos'

export const TEMATICAS = ['Anime & Manga', 'Fútbol', 'K-pop & K-dramas', 'Videojuegos'] as const

/** display_order no decide la posición (eso es LESSON_ORDER); solo desempata. */
const ORDEN = { connect: 50, order_steps: 51 } as const
const TITULO = { connect: 'Conecta', order_steps: 'Arma los pasos' } as const

interface ArchivoMinijuegos {
  subject: string
  topics: Record<
    string,
    {
      order_steps?: OrderStepsData | null
      temas: Record<string, { connect?: ConnectData | null; order_steps?: OrderStepsData | null }>
    }
  >
}

export interface Fila {
  topic: string
  tema: string
  type: 'connect' | 'order_steps'
  data: ConnectData | OrderStepsData
}

/** Aplana el archivo a filas y junta errores/avisos. No toca la base. */
export function planear(arch: ArchivoMinijuegos) {
  const filas: Fila[] = []
  const errores: string[] = []
  const avisos: string[] = []
  /** (tema × temática) que el archivo declara: se limpian aunque queden sin filas. */
  const pares: { topic: string; tema: string }[] = []

  if (!arch?.subject || typeof arch.topics !== 'object') {
    return { filas, pares, errores: ['archivo sin "subject" o sin "topics"'], avisos }
  }

  for (const [topic, t] of Object.entries(arch.topics)) {
    const temas = Object.keys(t.temas ?? {})
    const faltan = TEMATICAS.filter((x) => !temas.includes(x))
    const sobran = temas.filter((x) => !(TEMATICAS as readonly string[]).includes(x))
    if (faltan.length) errores.push(`${topic}: faltan temáticas ${faltan.join(', ')}`)
    if (sobran.length) errores.push(`${topic}: temática desconocida ${sobran.join(', ')}`)

    for (const tema of temas) {
      if (!(TEMATICAS as readonly string[]).includes(tema)) continue
      pares.push({ topic, tema })
      const bloque = t.temas[tema] ?? {}

      if (bloque.connect) {
        const v = validarConnect(bloque.connect)
        v.errores.forEach((e) => errores.push(`${topic} · ${tema} · connect: ${e}`))
        v.avisos.forEach((a) => avisos.push(`${topic} · ${tema} · connect: ${a}`))
        filas.push({ topic, tema, type: 'connect', data: bloque.connect })
      }

      // Override por temática > compartido > nada.
      const os = bloque.order_steps !== undefined ? bloque.order_steps : t.order_steps
      if (os) {
        const v = validarOrderSteps(os)
        v.errores.forEach((e) => errores.push(`${topic} · ${tema} · order_steps: ${e}`))
        v.avisos.forEach((a) => avisos.push(`${topic} · ${tema} · order_steps: ${a}`))
        filas.push({ topic, tema, type: 'order_steps', data: os })
      }
    }
  }
  return { filas, pares, errores, avisos }
}

// ── SQL ──────────────────────────────────────────────────────────────────

/** Dollar-quoting: el contenido no puede romper la cadena con una comilla. */
function lit(s: string): string {
  if (s.includes('$mj$')) throw new Error('el contenido contiene "$mj$"')
  return `$mj$${s}$mj$`
}

const subTopic = (subject: string, topic: string) =>
  `(SELECT t.id FROM public.topics t JOIN public.subjects s ON s.id = t.subject_id WHERE s.slug = ${lit(subject)} AND t.slug = ${lit(topic)})`
const subTema = (tema: string) => `(SELECT id FROM public.themes WHERE name = ${lit(tema)})`

export function generarSQL(subject: string, plan: ReturnType<typeof planear>): string {
  const out: string[] = [
    `-- Minijuegos s43 · ${subject} · ${plan.filas.length} filas · generado ${new Date().toISOString()}`,
    'BEGIN;',
  ]
  // 🔴 Si un slug no existe, el INSERT…SELECT no inserta nada y nadie se
  // entera. Por eso se verifica primero que cada tema y temática resuelvan.
  const topics = [...new Set(plan.pares.map((p) => p.topic))]
  out.push(
    `DO $chk$ BEGIN`,
    ...topics.map(
      (t) => `  IF ${subTopic(subject, t)} IS NULL THEN RAISE EXCEPTION 'tema no encontrado: %', ${lit(t)}; END IF;`
    ),
    ...[...TEMATICAS].map(
      (x) => `  IF ${subTema(x)} IS NULL THEN RAISE EXCEPTION 'temática no encontrada: %', ${lit(x)}; END IF;`
    ),
    `END $chk$;`
  )
  for (const { topic, tema } of plan.pares) {
    out.push(
      `DELETE FROM public.sections WHERE user_id IS NULL AND type IN ('connect','order_steps') AND topic_id = ${subTopic(subject, topic)} AND theme_id = ${subTema(tema)};`
    )
  }
  for (const f of plan.filas) {
    const content = (f.data.prompt ?? TITULO[f.type]).trim()
    out.push(
      `INSERT INTO public.sections (topic_id, theme_id, user_id, type, title, content, display_order, data) VALUES (${subTopic(subject, f.topic)}, ${subTema(f.tema)}, NULL, '${f.type}', ${lit(TITULO[f.type])}, ${lit(content)}, ${ORDEN[f.type]}, ${lit(JSON.stringify(f.data))}::jsonb);`
    )
  }
  out.push('COMMIT;')
  return out.join('\n') + '\n'
}

/**
 * Misma operación que `generarSQL`, en UNA sentencia: las filas viajan como
 * un solo JSON y se resuelven con un JOIN. Pesa ~3 veces menos, que importa
 * cuando el SQL se pega en un conector en vez de correrse con psql.
 *
 * Es atómica por ser una sola sentencia; si un tema o temática no existe,
 * la verificación del CTE `faltan` tira la sentencia completa.
 */
export function generarSQLCompacto(subject: string, plan: ReturnType<typeof planear>): string {
  const pares = plan.pares.map((p) => ({ t: p.topic, m: p.tema }))
  // Un Arma compartido se repite en las 4 temáticas: se manda UNA vez y las
  // filas lo referencian por índice.
  const datos: string[] = []
  const indice = new Map<string, number>()
  const filas = plan.filas.map((f) => {
    const clave = JSON.stringify(f.data)
    if (!indice.has(clave)) {
      indice.set(clave, datos.length)
      datos.push(clave)
    }
    return { t: f.topic, m: f.tema, y: f.type, i: indice.get(clave) }
  })
  const titulos = JSON.stringify(TITULO)
  const ordenes = JSON.stringify(ORDEN)
  return `-- Minijuegos s43 · ${subject} · ${plan.filas.length} filas (compacto)
WITH
pares AS (
  SELECT x->>'t' AS topic_slug, x->>'m' AS tema
  FROM jsonb_array_elements(${lit(JSON.stringify(pares))}::jsonb) x
),
resueltos AS (
  SELECT p.topic_slug, p.tema, t.id AS topic_id, th.id AS theme_id
  FROM pares p
  LEFT JOIN public.subjects s ON s.slug = ${lit(subject)}
  LEFT JOIN public.topics t ON t.subject_id = s.id AND t.slug = p.topic_slug
  LEFT JOIN public.themes th ON th.name = p.tema
),
-- 🔴 Un tema o temática que no resuelve aborta TODO. No con 1/0: Postgres
-- puede plegar esa constante al planear y tronar aunque no falte nada. El
-- cast de un texto que depende de los datos solo falla en ejecución, y el
-- mensaje de error trae los slugs que faltan.
faltan AS (
  SELECT coalesce((
    SELECT ('FALTA: ' || string_agg(topic_slug || ' · ' || tema, ', '))::int
    FROM resueltos WHERE topic_id IS NULL OR theme_id IS NULL
    HAVING count(*) > 0
  ), 0) AS ok
),
borrados AS (
  DELETE FROM public.sections se
  USING resueltos r, faltan
  WHERE faltan.ok = 0 AND se.user_id IS NULL AND se.type IN ('connect','order_steps')
    AND se.topic_id = r.topic_id AND se.theme_id = r.theme_id
  RETURNING se.id
),
datos AS (
  SELECT (n - 1)::int AS i, d AS data
  FROM jsonb_array_elements(${lit(`[${datos.join(',')}]`)}::jsonb) WITH ORDINALITY AS z(d, n)
),
filas AS (
  SELECT x->>'t' AS topic_slug, x->>'m' AS tema, x->>'y' AS tipo,
         ${lit(titulos)}::jsonb->>(x->>'y') AS titulo,
         coalesce(nullif(trim(d.data->>'prompt'), ''), ${lit(titulos)}::jsonb->>(x->>'y')) AS contenido,
         (${lit(ordenes)}::jsonb->>(x->>'y'))::int AS orden,
         d.data
  FROM jsonb_array_elements(${lit(JSON.stringify(filas))}::jsonb) x
  JOIN datos d ON d.i = (x->>'i')::int
),
ins AS (
  INSERT INTO public.sections (topic_id, theme_id, user_id, type, title, content, display_order, data)
  SELECT r.topic_id, r.theme_id, NULL, f.tipo::section_type, f.titulo, f.contenido, f.orden, f.data
  FROM filas f
  JOIN resueltos r ON r.topic_slug = f.topic_slug AND r.tema = f.tema
  CROSS JOIN faltan
  WHERE faltan.ok = 0 AND (SELECT count(*) FROM borrados) >= 0
  RETURNING type
)
-- Resumen en vez de una fila por inserción: es lo que se compara contra el dry-run.
SELECT type, count(*) FROM ins GROUP BY type;
`
}

// ── CLI ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const archivo = args.find((a) => !a.startsWith('--'))
  const dry = args.includes('--dry-run')
  const compacto = args.includes('--sql-compacto')
  const iSql = args.findIndex((a) => a === '--sql' || a === '--sql-compacto')
  const salidaSql = iSql >= 0 ? args[iSql + 1] : null

  if (!archivo) {
    console.error('Uso: npx tsx scripts/minijuegos/cargar.ts <archivo.json> [--dry-run] [--sql salida.sql]')
    process.exit(1)
  }

  const arch = JSON.parse(readFileSync(archivo, 'utf8')) as ArchivoMinijuegos
  const plan = planear(arch)
  const n = (t: Fila['type']) => plan.filas.filter((f) => f.type === t).length
  console.log(`📄 ${arch.subject}: ${Object.keys(arch.topics).length} temas · ${n('connect')} Conecta · ${n('order_steps')} Arma los pasos`)
  plan.avisos.forEach((a) => console.log(`  ⚠️  ${a}`))
  if (plan.errores.length) {
    plan.errores.forEach((e) => console.error(`  ❌ ${e}`))
    console.error(`\n${plan.errores.length} errores. No se escribió nada.`)
    process.exit(1)
  }
  console.log('  ✅ validación OK')
  if (dry) return

  if (salidaSql) {
    writeFileSync(salidaSql, (compacto ? generarSQLCompacto : generarSQL)(arch.subject, plan))
    console.log(`  📝 SQL en ${salidaSql}`)
    return
  }

  const { config } = await import('dotenv')
  config({ path: '.env.local' })
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local')
  const db = createClient(url, key)

  const { data: subj } = await db.from('subjects').select('id').eq('slug', arch.subject).single()
  if (!subj) throw new Error(`materia no encontrada: ${arch.subject}`)
  const { data: temas } = await db.from('themes').select('id, name').in('name', [...TEMATICAS])
  const temaId = new Map((temas ?? []).map((t) => [t.name as string, t.id as string]))
  const { data: tops } = await db.from('topics').select('id, slug').eq('subject_id', subj.id).in('slug', Object.keys(arch.topics))
  const topicId = new Map((tops ?? []).map((t) => [t.slug as string, t.id as string]))
  for (const t of Object.keys(arch.topics)) if (!topicId.has(t)) throw new Error(`tema no encontrado: ${t}`)
  for (const x of TEMATICAS) if (!temaId.has(x)) throw new Error(`temática no encontrada: ${x}`)

  for (const { topic, tema } of plan.pares) {
    const { error } = await db
      .from('sections')
      .delete()
      .is('user_id', null)
      .in('type', ['connect', 'order_steps'])
      .eq('topic_id', topicId.get(topic)!)
      .eq('theme_id', temaId.get(tema)!)
    if (error) throw error
  }
  const filas = plan.filas.map((f) => ({
    topic_id: topicId.get(f.topic)!,
    theme_id: temaId.get(f.tema)!,
    user_id: null,
    type: f.type,
    title: TITULO[f.type],
    content: (f.data.prompt ?? TITULO[f.type]).trim(),
    display_order: ORDEN[f.type],
    data: f.data,
  }))
  const { error } = await db.from('sections').insert(filas)
  if (error) throw error
  console.log(`  💾 ${filas.length} filas escritas`)
}

// Solo corre como CLI; las pruebas importan `planear` y `generarSQL`.
if (process.argv[1]?.endsWith('cargar.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
