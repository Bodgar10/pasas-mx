/**
 * scripts/generate-horde.ts
 *
 * Genera el banco del Modo Horda: 6 oleadas x 5 preguntas = 30 por topic.
 * Preguntas BASE (sin tematica): la horda simula el examen real de la escuela.
 *
 * SOLO INSERTA. Nunca borra. Idempotente: salta topics que ya tienen banco,
 * asi que se puede volver a correr para recuperar los que fallaron.
 *
 * Uso:
 *   npx tsx scripts/generate-horde.ts --level=middle_school --dry-run
 *   npx tsx scripts/generate-horde.ts --subject=matematicas-sec-1 --limit=1
 *   npx tsx scripts/generate-horde.ts --subject=matematicas-sec-1
 *   caffeinate -i npx tsx scripts/generate-horde.ts --level=middle_school
 *
 * Banderas:
 *   --topic=<slug>            un solo topic
 *   --subject=<slug>          todos los topics de una materia
 *   --level=middle_school     todos los topics de un nivel
 *   --all                     todo el catalogo
 *   --limit=N                 tope de topics a procesar
 *   --dry-run                 lista sin llamar a la API
 *   --include-unpublished     incluye borradores (por defecto NO)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16000;
const WAVES = 6;
const PER_WAVE = 5;
const TOTAL_Q = WAVES * PER_WAVE;
const LETTERS = ['A', 'B', 'C', 'D'];

// Escalera: oleadas 1-2 => dificultad 1, 3-4 => 2, 5-6 => 3
const waveDifficulty = (wave: number): number => Math.ceil(wave / 2);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : undefined;
};

const SUBJECT = flag('subject');
const TOPIC = flag('topic');
const LEVEL = flag('level');
const LIMIT = flag('limit') ? parseInt(flag('limit')!, 10) : undefined;
const DRY_RUN = args.includes('--dry-run');
const INCLUDE_UNPUBLISHED = args.includes('--include-unpublished');
const ALL = args.includes('--all');

if (!ALL && !SUBJECT && !TOPIC && !LEVEL) {
  console.error('Falta alcance. Usa --all, --level=, --subject= o --topic=.');
  process.exit(1);
}

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  subjects: { slug: string; education_level: string; grades: number[] } | null;
};

type HordeQuestion = {
  wave: number;
  difficulty: number;
  question: string;
  options: { letter: string; text: string }[];
  correct_answer: string;
  hint: string;
  explanation: string;
};

function gradeLabel(level: string, grades: number[]): string {
  const g = grades?.[0] ?? 1;
  return level === 'middle_school'
    ? `${g}o de secundaria (aprox. ${11 + g} anos)`
    : `${g}o de preparatoria (aprox. ${14 + g} anos)`;
}

function buildPrompt(topic: TopicRow): string {
  const ctx = topic.subjects
    ? gradeLabel(topic.subjects.education_level, topic.subjects.grades)
    : 'secundaria';

  return `Eres un profesor mexicano experto que disena bancos de repaso para examen.

TEMA: "${topic.name}"
NIVEL: ${ctx}
MATERIA: ${topic.subjects?.slug ?? 'general'}

Genera EXACTAMENTE ${TOTAL_Q} preguntas de opcion multiple, organizadas en ${WAVES} oleadas de ${PER_WAVE} preguntas cada una.

ESCALERA DE DIFICULTAD (obligatoria):
- Oleada 1 y 2 -> difficulty 1. Definiciones, identificacion, un solo paso.
- Oleada 3 y 4 -> difficulty 2. Dos pasos, aplicar la regla a un caso nuevo.
- Oleada 5 y 6 -> difficulty 3. Varios pasos, casos borde, trampas conceptuales.

REGLAS DEL CONTENIDO:
1. Espanol de Mexico, lenguaje directo para un adolescente. Nada de tecnicismos innecesarios.
2. NO uses analogias de videojuegos, K-pop, futbol ni ninguna tematica. Estas preguntas son neutras: simulan el examen real de la escuela.
3. Exactamente 4 opciones por pregunta, letras A, B, C, D. Una sola correcta.
4. Los distractores deben ser ERRORES TIPICOS reales (signo cambiado, paso omitido, concepto confundido), nunca opciones absurdas o de relleno. Cada distractor debe ser algo que un alumno que estudio a medias podria creer de verdad. Prohibido: opciones que se descartan por pura logica sin saber el tema (fechas que contradicen el enunciado, disparates evidentes) y opciones que culpan o denigran a las victimas de un hecho historico.
5. Prohibido "todas las anteriores", "ninguna de las anteriores" y "no se puede determinar".
6. NUNCA menciones las opciones por su letra en el enunciado, el hint o la explicacion. Prohibido escribir "la opcion D", "el inciso B", "la respuesta A". Refierete al contenido: en lugar de "la opcion D es un error", escribe "creer que las leyes no cambian nada es un error". Las opciones se barajan despues de generarse y cualquier referencia por letra queda apuntando a otra cosa.
7. "hint": una pista de METODO que oriente sin revelar la respuesta. Que le diga que preguntarse, no que contestar.
8. "explanation": por que la correcta es correcta Y por que falla el error mas comun. Maximo 2 oraciones.
9. Texto plano. Sin Markdown, sin LaTeX, sin negritas. Notacion matematica con caracteres normales: - x / ^2 raiz.
10. No inventes datos, fechas ni cifras. Si no estas seguro de un dato, usa otro enfoque para la pregunta.
11. Ninguna pregunta se repite ni parafrasea a otra dentro de las ${TOTAL_Q}.
12. LONGITUD (obligatoria, se lee en un celular): enunciado maximo 200 caracteres. Cada opcion maximo 80. "hint" maximo 140. "explanation" maximo 240. Si el tema pide contexto historico o narrativo, da solo el dato indispensable para responder, no el trasfondo completo.
13. PARIDAD DE OPCIONES (critica). "Escoge la mas larga" es una tactica conocida de examenes: si la correcta es la mas larga, el alumno acierta sin saber el tema y el ejercicio no sirve. Sigue este procedimiento en cada pregunta, en este orden:
   a) Escribe primero la respuesta correcta lo MAS CORTA posible, sin matices ni explicaciones. Solo el dato.
   b) Cuenta sus caracteres.
   c) Escribe los 3 distractores apuntando a ese mismo numero de caracteres, mas o menos 10.
   d) Si algun distractor te quedo mas corto, agregale detalle hasta emparejarlo. Si la correcta te quedo la mas larga de las cuatro, RECORTALA o alarga los distractores hasta que deje de serlo.
   e) Lo ideal es que la correcta sea la segunda o tercera mas larga, nunca la primera.
   La explicacion es el lugar para los matices, no la opcion.

FORMATO DE SALIDA:
Responde UNICAMENTE con un array JSON de ${TOTAL_Q} objetos. Sin preambulo, sin explicacion, sin backticks.
Cada objeto: { "wave": <1-${WAVES}>, "difficulty": <1-3>, "question": "...", "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."}], "correct_answer": "A", "hint": "...", "explanation": "..." }`;
}

function parseResponse(raw: string): HordeQuestion[] {
  const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No se encontro un array JSON');
  return JSON.parse(clean.slice(start, end + 1));
}

/**
 * Limpia basura tipica del modelo antes de validar: comas colgadas,
 * minusculas, espacios, puntos. "A," / "a" / " A." / "Opcion A" -> "A".
 */
function normalize(qs: HordeQuestion[]): HordeQuestion[] {
  const letter = (v: unknown): string =>
    String(v ?? '').toUpperCase().replace(/[^A-D]/g, '');

  return (Array.isArray(qs) ? qs : []).map((q) => ({
    ...q,
    correct_answer: letter(q.correct_answer),
    options: Array.isArray(q.options)
      ? q.options.map((o) => ({ ...o, letter: letter(o.letter) }))
      : q.options,
  }));
}

function validate(qs: HordeQuestion[]): string | null {
  if (!Array.isArray(qs)) return 'La respuesta no es un array';
  if (qs.length !== TOTAL_Q) return `Se esperaban ${TOTAL_Q} preguntas, llegaron ${qs.length}`;

  for (let w = 1; w <= WAVES; w++) {
    const inWave = qs.filter((q) => q.wave === w);
    if (inWave.length !== PER_WAVE) {
      return `La oleada ${w} tiene ${inWave.length} preguntas, se esperaban ${PER_WAVE}`;
    }
    if (inWave.some((q) => q.difficulty !== waveDifficulty(w))) {
      return `La oleada ${w} tiene dificultad fuera de la escalera`;
    }
  }

  const seen = new Set<string>();
  for (const q of qs) {
    if (!q.question?.trim()) return 'Pregunta vacia';
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) return `Pregunta repetida: ${q.question.slice(0, 50)}`;
    seen.add(key);

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      return `Pregunta sin 4 opciones: ${q.question.slice(0, 50)}`;
    }
    const letters = q.options.map((o) => o.letter);
    if (LETTERS.some((l) => !letters.includes(l))) {
      return `Letras invalidas [${letters.map((l) => l || '(vacia)').join(',')}] en: ${q.question.slice(0, 50)}`;
    }
    if (q.options.some((o) => !o.text?.trim())) {
      return `Opcion vacia en: ${q.question.slice(0, 50)}`;
    }
    if (!LETTERS.includes(q.correct_answer)) {
      return `correct_answer invalido (${q.correct_answer})`;
    }
    if (!q.hint?.trim()) return `Falta hint en: ${q.question.slice(0, 50)}`;
    if (!q.explanation?.trim()) return `Falta explanation en: ${q.question.slice(0, 50)}`;

    const LETTER_REF = /\b(opci[oó]n|inciso|respuesta)\s+[A-D]\b/i;
    for (const campo of [q.question, q.hint, q.explanation]) {
      if (LETTER_REF.test(campo)) {
        return `Referencia a opcion por letra en: ${q.question.slice(0, 50)}`;
      }
    }
  }
  return null;
}

/**
 * Baraja las opciones (Fisher-Yates) y reasigna letras A-D.
 * Necesario porque el modelo carga la respuesta correcta en B:
 * en el piloto salio B 21 de 30 veces y D cero. Un alumno que
 * picaba B sin leer avanzaba tres oleadas.
 * Corre DESPUES de validar, con datos ya bien formados.
 */
function shuffleOptions(qs: HordeQuestion[]): HordeQuestion[] {
  return qs.map((q) => {
    const correctText = q.options.find((o) => o.letter === q.correct_answer)!.text;
    const pool = [...q.options];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const options = pool.map((o, i) => ({ letter: LETTERS[i], text: o.text }));
    const correct_answer = options.find((o) => o.text === correctText)!.letter;
    return { ...q, options, correct_answer };
  });
}

async function fetchTopics(): Promise<TopicRow[]> {
  const all: TopicRow[] = [];
  const PAGE = 500;
  let from = 0;

  while (true) {
    let q = supabase
      .from('topics')
      .select('id, name, slug, subjects!inner(slug, education_level, grades)')
      .order('name')
      .range(from, from + PAGE - 1);

    if (!INCLUDE_UNPUBLISHED) q = q.eq('published', true);
    if (TOPIC) q = q.eq('slug', TOPIC);
    if (SUBJECT) q = q.eq('subjects.slug', SUBJECT);
    if (LEVEL) q = q.eq('subjects.education_level', LEVEL);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as unknown as TopicRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function alreadyHasBank(topicId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('horde_questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function main() {
  const scope = TOPIC
    ? `topic=${TOPIC}`
    : SUBJECT
      ? `subject=${SUBJECT}`
      : LEVEL
        ? `level=${LEVEL}`
        : 'TODOS';

  console.log('=== generate-horde ===');
  console.log(
    `alcance: ${scope}${LIMIT ? ` | limit=${LIMIT}` : ''}` +
      `${DRY_RUN ? ' | DRY RUN' : ''}${INCLUDE_UNPUBLISHED ? ' | incluye borradores' : ''}\n`
  );

  const topics = await fetchTopics();
  if (topics.length === 0) {
    console.log('No se encontraron topics con ese filtro. Revisa el slug.');
    return;
  }
  console.log(`topics encontrados: ${topics.length}\n`);

  let processed = 0;
  let attempted = 0;
  let skipped = 0;
  let failed = 0;
  let inTokens = 0;
  let outTokens = 0;

  for (const topic of topics) {
    if (LIMIT !== undefined && attempted >= LIMIT) break;

    if (await alreadyHasBank(topic.id)) {
      skipped++;
      console.log(`- SALTA  ${topic.name} (ya tiene banco)`);
      continue;
    }

    if (DRY_RUN) {
      attempted++;
      processed++;
      console.log(`- DRY    ${topic.name} (${topic.subjects?.slug})`);
      continue;
    }

    attempted++;

    try {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: buildPrompt(topic) }],
      });

      inTokens += res.usage.input_tokens;
      outTokens += res.usage.output_tokens;

      if (res.stop_reason === 'max_tokens') {
        throw new Error('Respuesta truncada por MAX_TOKENS. Sube el limite.');
      }

      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('\n');

      const questions = normalize(parseResponse(text));
      const problem = validate(questions);
      if (problem) throw new Error(problem);

      const rows = shuffleOptions(questions).map((q) => ({
        topic_id: topic.id,
        wave: q.wave,
        difficulty: q.difficulty,
        question: q.question.trim(),
        options: q.options,
        correct_answer: q.correct_answer,
        hint: q.hint.trim(),
        explanation: q.explanation.trim(),
        source: 'ai',
      }));

      const { error } = await supabase.from('horde_questions').insert(rows);
      if (error) throw error;

      const { error: flagError } = await supabase
        .from('topics')
        .update({ horde_ready: true })
        .eq('id', topic.id);
      if (flagError) throw flagError;

      processed++;
      console.log(`- OK     ${topic.name} (${TOTAL_Q} preguntas)`);
    } catch (err) {
      failed++;
      console.error(`- FALLA  ${topic.name}: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  const cost = (inTokens / 1_000_000) * 3 + (outTokens / 1_000_000) * 15;
  console.log('\n=== resumen ===');
  console.log(`generados: ${processed} | saltados: ${skipped} | fallidos: ${failed}`);
  console.log(`tokens: ${inTokens} in / ${outTokens} out`);
  console.log(`costo aprox: $${cost.toFixed(2)} USD`);
  if (failed > 0) {
    console.log('Los fallidos no quedaron a medias. Vuelve a correr el mismo comando para reintentarlos.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
