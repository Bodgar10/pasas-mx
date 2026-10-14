/**
 * Cargar contenido COMPLETO de un tema — Pasas.mx · s44
 * ------------------------------------------------------
 * Para las materias nuevas de la auditoría s44 (Tecnología, Artes, ICS,
 * Ciencias de la Salud, Inglés VI, Matemáticas Financieras). Todo el
 * contenido lo escribe Claude a mano en un JSON por tema; este script NO
 * llama a ninguna API de generación.
 *
 * Un archivo = un tema completo:
 *   - 4 temáticas × (analogía, explicación, ejemplo, dato clave, tip,
 *     "Resuélvelo conmigo" (steps), clasifica (sort), memorama (match),
 *     Conecta y Arma los pasos)
 *   - 5 preguntas de quiz por temática (20)
 *   - 30 preguntas de Horda (6 oleadas × 5, neutras, escalera 1-1-2-2-3-3)
 *   - 1 pregunta de diagnóstico
 *
 * Valida TODO con las reglas de la app (minijuegos.ts, prompts de
 * generate-topic y generate-horde, README de diagnósticos). Si algo falla
 * no genera nada. Baraja las opciones con barajarOpciones (la misma regla
 * que s43) y escribe UN bloque SQL atómico por tema.
 *
 * El SQL lleva el contenido como texto con su md5: si al pegarlo en el
 * conector se altera un solo carácter, el bloque aborta sin escribir nada.
 * Se niega a reescribir un tema PUBLICADO (las respuestas de los alumnos
 * apuntan a los ids de quiz/horda).
 *
 * Uso:
 *   npx tsx scripts/contenido-materias/cargar.ts scripts/contenido-materias/tecnologia-sec-1/01-*.json
 *   npx tsx scripts/contenido-materias/cargar.ts <archivos...> --sql-dir <carpeta>
 *   npx tsx scripts/contenido-materias/cargar.ts --minijuegos tecnologia-sec-1
 *       (vuelve a escribir scripts/minijuegos/contenido/<materia>.json con los
 *        Conecta/Arma de todos los temas, en el formato del cargador de s43)
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { validarConnect, validarOrderSteps, type ConnectData, type OrderStepsData } from '../../src/lib/minijuegos'
import { barajarOpciones } from '../../src/lib/barajar-opciones'

export const TEMATICAS = ['Anime & Manga', 'Fútbol', 'K-pop & K-dramas', 'Videojuegos'] as const
const LETRAS = ['A', 'B', 'C', 'D']

type Opcion = { letter: string; text: string }
type Texto = { title: string; content: string }
type Interactivo = Texto & { data: Record<string, unknown> }
type Quiz = { question: string; options: Opcion[]; correct_answer: string; explanation: string; difficulty: number }
type Horda = Quiz & { wave: number; hint: string }
type Diag = { question: string; options: Opcion[]; correct_answer: string; explanation: string }

interface BloqueTematica {
  analogy: Texto
  explanation: Texto
  example: Texto
  key_fact: Texto
  tip: Texto
  steps: Interactivo
  sort: Interactivo
  match: Interactivo
  connect: ConnectData
  order_steps?: OrderStepsData
  quiz: Quiz[]
}

export interface ArchivoTema {
  subject: string
  topic: string
  order_steps: OrderStepsData
  temas: Record<string, BloqueTematica>
  horde: Horda[]
  diagnostic: Diag
}

// ── Reglas ───────────────────────────────────────────────────────────────

/** Rangos en caracteres. Salen del promedio real de la base (s44). */
const LARGO: Record<string, [number, number]> = {
  analogy: [550, 1150],
  explanation: [350, 800],
  example: [350, 850],
  key_fact: [140, 400],
  tip: [80, 280],
}

const MARKDOWN = /\*\*|__|`|^#|\$\$/m
const REF_LETRA = /([Oo]pci[oó]n|[Ii]nciso|[Rr]espuesta|[Ll]etra)\s+\(?[A-D]\b|\b[A-D]\)|(primera|segunda|tercera|cuarta|[uú]ltima) opci/
const RELLENO = /todas las anteriores|ninguna de las anteriores|no se puede determinar/i
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const palabras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const ok = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0

function validarOpciones(ctx: string, p: Quiz | Horda | Diag, err: string[], maxOpc?: number) {
  if (!Array.isArray(p.options) || p.options.length !== 4) {
    err.push(`${ctx}: debe tener 4 opciones`)
    return
  }
  p.options.forEach((o, i) => {
    if (o.letter !== LETRAS[i]) err.push(`${ctx}: letras deben ser A-D en orden`)
    if (!ok(o.text)) err.push(`${ctx}: opción ${o.letter} vacía`)
    if (maxOpc && o.text.length > maxOpc) err.push(`${ctx}: opción "${o.text}" > ${maxOpc} caracteres`)
    if (RELLENO.test(o.text)) err.push(`${ctx}: opción de relleno "${o.text}"`)
  })
  if (new Set(p.options.map((o) => norm(o.text))).size !== 4) err.push(`${ctx}: opciones repetidas`)
  const c = p.options.find((o) => o.letter === p.correct_answer)
  if (!c) {
    err.push(`${ctx}: correct_answer ${p.correct_answer} no existe`)
    return
  }
  // Paridad: la correcta nunca es estrictamente la más larga.
  const otras = Math.max(...p.options.filter((o) => o !== c).map((o) => o.text.length))
  if (c.text.length > otras) err.push(`${ctx}: la correcta es la más larga ("${c.text}" ${c.text.length} > ${otras})`)
  const texto = `${p.question} ${p.explanation} ${'hint' in p ? p.hint : ''}`
  if (REF_LETRA.test(texto)) err.push(`${ctx}: menciona opciones por letra`)
  if (!ok(p.question)) err.push(`${ctx}: sin pregunta`)
  if (!ok(p.explanation)) err.push(`${ctx}: sin explicación`)
}

export function validar(a: ArchivoTema): { errores: string[]; avisos: string[] } {
  const err: string[] = []
  const av: string[] = []
  if (!ok(a.subject) || !ok(a.topic)) err.push('falta subject o topic')

  const os = validarOrderSteps(a.order_steps)
  os.errores.forEach((e) => err.push(`order_steps: ${e}`))
  os.avisos.forEach((e) => av.push(`order_steps: ${e}`))

  const nombres = Object.keys(a.temas ?? {})
  for (const t of TEMATICAS) if (!nombres.includes(t)) err.push(`falta temática ${t}`)
  for (const t of nombres) if (!(TEMATICAS as readonly string[]).includes(t)) err.push(`temática desconocida ${t}`)

  const quizVistas = new Set<string>()
  for (const t of TEMATICAS) {
    const b = a.temas?.[t]
    if (!b) continue
    const ctx = (x: string) => `${t} · ${x}`

    for (const tipo of Object.keys(LARGO)) {
      const s = (b as unknown as Record<string, Texto>)[tipo]
      if (!s || !ok(s.title) || !ok(s.content)) {
        err.push(ctx(`${tipo} vacío`))
        continue
      }
      const [min, max] = LARGO[tipo]
      if (s.content.length < min || s.content.length > max)
        err.push(ctx(`${tipo} mide ${s.content.length} (rango ${min}-${max})`))
      if (s.title.length > 90) err.push(ctx(`${tipo}: título > 90`))
    }
    if (b.explanation?.content && !/^Lo que acabas de ver/.test(b.explanation.content))
      av.push(ctx('la explicación no abre con "Lo que acabas de ver…"'))
    if (b.analogy?.content && /\*\*/.test(b.analogy.content)) av.push(ctx('la analogía lleva negritas'))
    if (b.key_fact?.content && !/\*\*/.test(b.key_fact.content)) av.push(ctx('el dato clave no tiene negritas'))

    // steps
    const st = b.steps?.data as { intro?: string; visual?: string; start?: number; steps?: { text: string; delta?: number }[] }
    if (!st || !ok(st.intro) || !Array.isArray(st.steps)) err.push(ctx('steps sin intro o sin pasos'))
    else {
      if (st.steps.length < 3 || st.steps.length > 5) err.push(ctx(`steps con ${st.steps.length} pasos (3-5)`))
      if (st.visual === 'bar') {
        let v = st.start ?? 0
        if (v < 0 || v > 100) err.push(ctx('steps: start fuera de 0-100'))
        for (const p of st.steps) {
          if (typeof p.delta !== 'number' || p.delta === 0) err.push(ctx(`steps bar: paso sin delta "${p.text}"`))
          v += p.delta ?? 0
          if (v < 0 || v > 100) err.push(ctx(`steps bar: el valor sale de 0-100 (${v})`))
        }
      } else if (st.visual === 'chain') {
        if (st.steps.some((p) => p.delta != null)) err.push(ctx('steps chain no lleva delta'))
      } else err.push(ctx('steps.visual debe ser bar o chain'))
      st.steps.forEach((p) => {
        if (!ok(p.text) || p.text.length > 220) err.push(ctx(`steps: paso vacío o > 220 "${p.text?.slice(0, 30)}"`))
      })
    }
    if (!ok(b.steps?.title) || !ok(b.steps?.content)) err.push(ctx('steps sin title/content'))

    // sort
    const so = b.sort?.data as { prompt?: string; buckets?: string[]; items?: { t: string; b: number }[] }
    if (!so || !ok(so.prompt) || !Array.isArray(so.buckets) || !Array.isArray(so.items)) err.push(ctx('sort incompleto'))
    else {
      if (so.buckets.length < 2 || so.buckets.length > 4) err.push(ctx('sort: 2-4 cubetas'))
      so.buckets.forEach((c) => c.length > 34 && err.push(ctx(`sort: cubeta larga "${c}"`)))
      if (so.items.length < 4 || so.items.length > 6) err.push(ctx(`sort: ${so.items.length} items (4-6)`))
      so.items.forEach((it) => {
        if (!Number.isInteger(it.b) || it.b < 0 || it.b >= so.buckets!.length) err.push(ctx(`sort: cubeta inválida "${it.t}"`))
        if (!ok(it.t) || it.t.length > 48) err.push(ctx(`sort: item vacío o > 48 "${it.t}"`))
      })
      so.buckets.forEach((_, i) => !so.items!.some((it) => it.b === i) && err.push(ctx(`sort: cubeta ${i} sin items`)))
      if (new Set(so.items.map((i) => norm(i.t))).size !== so.items.length) err.push(ctx('sort: items repetidos'))
    }
    if (!ok(b.sort?.title) || !ok(b.sort?.content)) err.push(ctx('sort sin title/content'))

    // match (memorama): 4 parejas, cartas cortas y TODAS distintas (si dos
    // cartas dicen lo mismo, el alumno elige la "equivocada" y falla).
    const ma = b.match?.data as { prompt?: string; pairs?: { a: string; b: string }[] }
    if (!ma || !Array.isArray(ma.pairs)) err.push(ctx('match sin pares'))
    else {
      if (ma.pairs.length !== 4) err.push(ctx(`match con ${ma.pairs.length} pares (4)`))
      const cartas = ma.pairs.flatMap((p) => [p.a, p.b])
      if (new Set(cartas.map(norm)).size !== cartas.length) err.push(ctx('match: cartas repetidas'))
      cartas.forEach((c) => {
        if (!ok(c) || c.length > 26) err.push(ctx(`match: carta vacía o > 26 "${c}"`))
        else if (palabras(c) > 4) av.push(ctx(`match: carta de más de 4 palabras "${c}"`))
      })
    }
    if (!ok(b.match?.title) || !ok(b.match?.content)) err.push(ctx('match sin title/content'))

    // minijuegos
    const cn = validarConnect(b.connect)
    cn.errores.forEach((e) => err.push(ctx(`connect: ${e}`)))
    cn.avisos.forEach((e) => av.push(ctx(`connect: ${e}`)))
    if (b.order_steps) {
      const o = validarOrderSteps(b.order_steps)
      o.errores.forEach((e) => err.push(ctx(`order_steps: ${e}`)))
    }

    // quiz
    if (!Array.isArray(b.quiz) || b.quiz.length !== 5) err.push(ctx('quiz debe tener 5 preguntas'))
    else {
      const difs = b.quiz.map((q) => q.difficulty).sort().join('')
      if (difs !== '12233') err.push(ctx(`quiz: dificultades ${difs} (deben ser 1,2,2,3,3)`))
      b.quiz.forEach((q, i) => {
        validarOpciones(ctx(`quiz ${i + 1}`), q, err)
        if (q.explanation && palabras(q.explanation) > 60) err.push(ctx(`quiz ${i + 1}: explicación > 60 palabras`))
        if (quizVistas.has(norm(q.question))) err.push(ctx(`quiz ${i + 1}: pregunta repetida`))
        quizVistas.add(norm(q.question))
      })
    }
  }

  // horda
  if (!Array.isArray(a.horde) || a.horde.length !== 30) err.push(`horde: ${a.horde?.length} preguntas (30)`)
  else {
    for (let w = 1; w <= 6; w++) {
      const n = a.horde.filter((h) => h.wave === w).length
      if (n !== 5) err.push(`horde: oleada ${w} tiene ${n} (5)`)
    }
    const vistas = new Set<string>()
    a.horde.forEach((h, i) => {
      const c = `horde ${i + 1} (oleada ${h.wave})`
      if (h.difficulty !== Math.ceil(h.wave / 2)) err.push(`${c}: difficulty ${h.difficulty} ≠ ${Math.ceil(h.wave / 2)}`)
      validarOpciones(c, h, err, 80)
      if (h.question.length > 200) err.push(`${c}: enunciado > 200`)
      if (!ok(h.hint) || h.hint.length > 140) err.push(`${c}: hint vacío o > 140`)
      if (h.explanation.length > 240) err.push(`${c}: explicación > 240`)
      if (MARKDOWN.test(`${h.question} ${h.hint} ${h.explanation} ${h.options.map((o) => o.text).join(' ')}`))
        err.push(`${c}: lleva Markdown`)
      if (vistas.has(norm(h.question))) err.push(`${c}: pregunta repetida`)
      vistas.add(norm(h.question))
    })
  }

  // diagnóstico
  if (!a.diagnostic) err.push('falta diagnostic')
  else {
    validarOpciones('diagnostic', a.diagnostic, err)
    if (palabras(a.diagnostic.explanation ?? '') > 60) err.push('diagnostic: explicación > 60 palabras')
  }

  return { errores: err, avisos: av }
}

// ── SQL ──────────────────────────────────────────────────────────────────

const DISPLAY: Record<string, number> = {
  analogy: 1, explanation: 2, example: 3, key_fact: 4, tip: 5,
  connect: 50, order_steps: 51, sort: 100, steps: 101, match: 110,
}
const XP: Record<number, number> = { 1: 20, 2: 30, 3: 50 }

export function armarCarga(a: ArchivoTema) {
  const sections: Record<string, unknown>[] = []
  const quiz: Record<string, unknown>[] = []
  for (const t of TEMATICAS) {
    const b = a.temas[t]
    for (const tipo of ['analogy', 'explanation', 'example', 'key_fact', 'tip', 'steps', 'sort', 'match'] as const) {
      const s = b[tipo] as Interactivo
      sections.push({
        theme: t, type: tipo, title: s.title, content: s.content,
        display_order: DISPLAY[tipo], data: s.data ?? null, interests: [t],
      })
    }
    sections.push({
      theme: t, type: 'connect', title: 'Conecta', content: (b.connect.prompt ?? 'Conecta').trim(),
      display_order: DISPLAY.connect, data: b.connect, interests: null,
    })
    const os = b.order_steps ?? a.order_steps
    sections.push({
      theme: t, type: 'order_steps', title: 'Arma los pasos', content: (os.prompt ?? 'Arma los pasos').trim(),
      display_order: DISPLAY.order_steps, data: os, interests: null,
    })
    // Se baraja por lote (temática): la secuencia de correctas no se repite.
    for (const q of barajarOpciones(b.quiz.map((q) => ({ ...q })))) {
      quiz.push({ theme: t, ...q, xp_reward: XP[q.difficulty] })
    }
  }
  const horde = barajarOpciones([...a.horde].sort((x, y) => x.wave - y.wave).map((h) => ({ ...h })))
  const [diagnostic] = barajarOpciones([{ ...a.diagnostic }])
  return { subject: a.subject, topic: a.topic, sections, quiz, horde, diagnostic }
}

export function generarSQL(a: ArchivoTema): string {
  const carga = armarCarga(a)
  const raw = JSON.stringify(carga)
  if (raw.includes('$pj$')) throw new Error('el contenido contiene "$pj$"')
  const md5 = createHash('md5').update(raw, 'utf8').digest('hex')
  return `-- Contenido s44 · ${a.subject} · ${a.topic} · ${carga.sections.length} secciones · ${carga.quiz.length} quiz · ${carga.horde.length} horda · 1 diagnóstico
DO $do$
DECLARE
  raw text := $pj$${raw}$pj$;
  d jsonb;
  v_topic uuid; v_subject uuid; v_pub boolean; v_name text; v_grade int; v_orden int; v_level text;
  n int;
BEGIN
  IF md5(raw) <> '${md5}' THEN RAISE EXCEPTION 'md5 no coincide: el contenido se alteró al copiarlo'; END IF;
  d := raw::jsonb;
  SELECT t.id, s.id, t.published, t.name, t.grade, t.display_order, s.education_level::text
    INTO v_topic, v_subject, v_pub, v_name, v_grade, v_orden, v_level
    FROM public.topics t JOIN public.subjects s ON s.id = t.subject_id
   WHERE s.slug = d->>'subject' AND t.slug = d->>'topic';
  IF v_topic IS NULL THEN RAISE EXCEPTION 'tema no encontrado: %', d->>'topic'; END IF;
  IF v_pub THEN RAISE EXCEPTION 'tema publicado: no se reescribe (%).', d->>'topic'; END IF;
  SELECT count(*) INTO n FROM public.themes WHERE name IN ('Anime & Manga','Fútbol','K-pop & K-dramas','Videojuegos');
  IF n <> 4 THEN RAISE EXCEPTION 'faltan temáticas en themes'; END IF;

  -- Solo inserta. Si el tema ya tiene algo, aborta: para recargar hay que
  -- vaciarlo a mano primero (ver README). Así una carga nunca borra nada.
  IF EXISTS (SELECT 1 FROM public.sections WHERE topic_id = v_topic AND user_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.quiz_questions WHERE topic_id = v_topic)
     OR EXISTS (SELECT 1 FROM public.horde_questions WHERE topic_id = v_topic)
     OR EXISTS (SELECT 1 FROM public.diagnostic_questions WHERE topic_id = v_topic) THEN
    RAISE EXCEPTION 'el tema % ya tiene contenido: vacíalo antes de recargar', d->>'topic';
  END IF;

  INSERT INTO public.sections (topic_id, theme_id, user_id, type, title, content, display_order, data, interests_used)
  SELECT v_topic, th.id, NULL, (x->>'type')::public.section_type, x->>'title', x->>'content',
         (x->>'display_order')::int, NULLIF(x->'data', 'null'::jsonb),
         CASE WHEN jsonb_typeof(x->'interests') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(x->'interests')) END
    FROM jsonb_array_elements(d->'sections') x JOIN public.themes th ON th.name = x->>'theme';

  INSERT INTO public.quiz_questions (topic_id, theme_id, question, options, correct_answer, explanation, difficulty, xp_reward, source)
  SELECT v_topic, th.id, x->>'question', x->'options', x->>'correct_answer', x->>'explanation',
         (x->>'difficulty')::int, (x->>'xp_reward')::int, 'manual'
    FROM jsonb_array_elements(d->'quiz') x JOIN public.themes th ON th.name = x->>'theme';

  INSERT INTO public.horde_questions (topic_id, wave, difficulty, question, options, correct_answer, hint, explanation, source)
  SELECT v_topic, (x->>'wave')::smallint, (x->>'difficulty')::smallint, x->>'question', x->'options',
         x->>'correct_answer', x->>'hint', x->>'explanation', 'manual'
    FROM jsonb_array_elements(d->'horde') x;

  INSERT INTO public.diagnostic_questions (subject_id, topic_id, topic_name, question, options, correct_answer, explanation, education_level, grade, display_order)
  SELECT v_subject, v_topic, v_name, d->'diagnostic'->>'question', d->'diagnostic'->'options',
         d->'diagnostic'->>'correct_answer', d->'diagnostic'->>'explanation', v_level, v_grade, v_orden;

  SELECT count(*) INTO n FROM public.sections WHERE topic_id = v_topic AND user_id IS NULL;
  IF n <> ${carga.sections.length} THEN RAISE EXCEPTION 'secciones: % de ${carga.sections.length}', n; END IF;
  SELECT count(*) INTO n FROM public.quiz_questions WHERE topic_id = v_topic;
  IF n <> ${carga.quiz.length} THEN RAISE EXCEPTION 'quiz: % de ${carga.quiz.length}', n; END IF;
  SELECT count(*) INTO n FROM public.horde_questions WHERE topic_id = v_topic;
  IF n <> 30 THEN RAISE EXCEPTION 'horda: % de 30', n; END IF;

  UPDATE public.topics SET horde_ready = true WHERE id = v_topic;
END
$do$;
`
}

// ── Minijuegos: espejo en el formato de scripts/minijuegos/contenido ─────

function escribirMinijuegos(materia: string) {
  const dir = join('scripts/contenido-materias', materia)
  const topics: Record<string, unknown> = {}
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const a = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ArchivoTema
    const temas: Record<string, unknown> = {}
    for (const t of TEMATICAS) {
      const b = a.temas[t]
      temas[t] = b.order_steps ? { connect: b.connect, order_steps: b.order_steps } : { connect: b.connect }
    }
    topics[a.topic] = { order_steps: a.order_steps, temas }
  }
  const salida = `scripts/minijuegos/contenido/${materia}.json`
  writeFileSync(salida, JSON.stringify({ subject: materia, topics }, null, 2) + '\n')
  console.log(`✓ ${salida} (${Object.keys(topics).length} temas)`)
}

// ── CLI ──────────────────────────────────────────────────────────────────

if (process.argv[1] && basename(process.argv[1]).startsWith('cargar')) {
  const args = process.argv.slice(2)
  const iMini = args.indexOf('--minijuegos')
  if (iMini >= 0) {
    escribirMinijuegos(args[iMini + 1])
    process.exit(0)
  }
  const iDir = args.indexOf('--sql-dir')
  const sqlDir = iDir >= 0 ? args[iDir + 1] : null
  const archivos = args.filter((x, i) => !x.startsWith('--') && (iDir < 0 || i !== iDir + 1))
  let fallo = false
  for (const f of archivos) {
    const a = JSON.parse(readFileSync(f, 'utf8')) as ArchivoTema
    const { errores, avisos } = validar(a)
    console.log(`\n── ${basename(f)} · ${errores.length} errores · ${avisos.length} avisos`)
    errores.forEach((e) => console.log(`  ✗ ${e}`))
    avisos.forEach((e) => console.log(`  · ${e}`))
    if (errores.length) {
      fallo = true
      continue
    }
    if (sqlDir) {
      mkdirSync(sqlDir, { recursive: true })
      const out = join(sqlDir, basename(f).replace(/\.json$/, '.sql'))
      writeFileSync(out, generarSQL(a))
      console.log(`  ✓ ${out}`)
    }
  }
  process.exit(fallo ? 1 : 0)
}
