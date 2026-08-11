/**
 * generate-audio.ts — Genera audio narrado (voz Bodgar) para las secciones de texto.
 *
 * Pipeline por sección:
 *   1. Sonnet adapta el texto → guión de voz (puntuación TTS, "eme equis", etc.)
 *   2. POST /generate a Voicebox (perfil Bodgar, español)
 *   3. Polling a /history/{id} hasta status="completed"
 *   4. GET /audio/{id} → descarga el WAV
 *   5. ffmpeg convierte a MP3 mono 96kbps
 *   6. Sube al bucket "section-audio" de Supabase Storage
 *   7. Guarda audio_url + audio_duration en la sección
 *
 * Idempotente: salta secciones que ya tienen audio_url.
 * Solo INSERTA (nunca borra). Igual filosofía que enrich-interactive.ts.
 *
 * Uso:
 *   npx tsx scripts/generate-audio.ts --subject=<slug> [--limit=N] [--dry-run]
 *   caffeinate -i npx tsx scripts/generate-audio.ts --subject=matematicas-1
 *
 * Requiere: Voicebox ABIERTO en la Mac (API local en 127.0.0.1:17493) + ffmpeg.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileP = promisify(execFile)

// ─── Config ───
const VOICEBOX_URL = 'http://127.0.0.1:17493'
const BODGAR_PROFILE_ID = '74ae963c-6ff2-4a44-b138-3050895e5441'
const BUCKET = 'section-audio'
const ALL_AUDIO_TEXT_TYPES = ['explanation', 'analogy', 'example', 'key_fact', 'tip']
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 300000 // 5 min por audio (analogías largas + carga inicial del modelo)

// ─── Flags ───
const args = process.argv.slice(2)
const getFlag = (name: string): string | undefined => {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  return a ? a.split('=').slice(1).join('=') : undefined
}
const subjectSlug = getFlag('subject')
const limit = getFlag('limit') ? parseInt(getFlag('limit')!, 10) : undefined
const dryRun = args.includes('--dry-run')
const typesFlag = getFlag('types')
const AUDIO_TEXT_TYPES = typesFlag
  ? typesFlag.split(',').map((t) => t.trim()).filter((t) => ALL_AUDIO_TEXT_TYPES.includes(t))
  : ALL_AUDIO_TEXT_TYPES

if (!subjectSlug) {
  console.error('❌ Falta --subject=<slug>. Ej: --subject=matematicas-1')
  process.exit(1)
}

// ─── Clients ───
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error('❌ Faltan variables en .env.local (SUPABASE_URL / SERVICE_ROLE_KEY / ANTHROPIC_API_KEY)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

// ─── Reglas de adaptación a guión de voz (las validadas en las pruebas) ───
const VOICE_SCRIPT_SYSTEM = `Eres un adaptador de texto a "guión de voz" para un motor TTS en español (voz clonada).
Recibes el texto de una sección educativa y devuelves SOLO el texto adaptado para que suene bien al leerse en voz alta.
NO cambies el significado ni el contenido. NO agregues ni quites información. Solo ajusta la forma.

REGLAS:
- Quita el markdown: los **asteriscos** de negritas se eliminan (deja la palabra sin asteriscos).
- Convierte URLs/dominios a fonético: "algo.mx" → "algo punto eme equis", "www" → "doble u doble u doble u".
- ANGLICISMOS — REGLA CONSERVADORA. Sé MUY selectivo; en la duda, NO toques la palabra.
  · NOMBRES PROPIOS DE MARCAS, GRUPOS, ARTISTAS, APPS, LUGARES (BTS, BLACKPINK, Billboard, Twitter, Netflix, Minecraft, Spotify, Fortnite, etc.): DÉJALOS TAL CUAL, escritos igual que el original. NO inventes su pronunciación fonética. El motor los dice aceptablemente y así garantizas consistencia entre audios.
  · EXCEPCIÓN — solo reescribe fonéticamente estos casos concretos y bien conocidos:
    - "K-drama" → "kdrama", "K-pop" → "kpop" (une la K sin guion; NO uses "key").
    - Palabras COMUNES en inglés (no nombres propios) que el motor pronunciaría muy mal: "streaming" → "estrímin", "gaming" → "gueimin", "highlight" → "jailait", "comeback" → "cambak". Solo si son de uso común y el motor claramente fallaría.
  · SIGLAS que se deletrean (no se leen como palabra): déjalas en mayúsculas tal cual (BTS, ARMY, BLINK). NO las escribas fonéticamente ("bítíes" está MAL).
  · NO inventes pronunciaciones tipo "bléipink", "Jot Uan", "baiás". Si no estás 100% seguro de una forma fonética estándar, DEJA la palabra original.
  · Prioridad absoluta: CONSISTENCIA. La misma palabra debe salir idéntica siempre.
- TEXTO EN INGLÉS DENTRO DE CONTENIDO ESPAÑOL (materias de Inglés). El audio es en español con voz española; las frases/palabras en inglés hay que ESCRIBIRLAS FONÉTICAMENTE EN ESPAÑOL para que el motor las pronuncie bien:
  · Identifica qué partes están en inglés (oraciones de ejemplo, vocabulario, frases a traducir) y transcríbelas a fonética española aproximada. Ejemplos:
    - "The cat is black" → "de cat is blak"
    - "How are you?" → "jau ar iu?"
    - "I have a book" → "ai jav a buk"
    - "She is running" → "shi is ránin"
    - "Thank you very much" → "zenk iu veri moch"
  · Las INSTRUCCIONES en español (ej. "Traduce la siguiente oración", "Completa el espacio") se dejan en español normal.
  · Vocabulario/palabras sueltas en inglés → fonética española: "house"→"jaus", "water"→"uára", "friend"→"frend", "beautiful"→"biútiful".
  · Objetivo: que un hispanohablante escuche el inglés pronunciado de forma reconocible y CLARA. El inglés debe sonar MÁS LENTO y SEPARADO que el español que lo rodea.
  · RITMO DEL INGLÉS — crítico para que se entienda:
    - Antes de una frase en inglés, mete una pausa media ("..") para separarla del español.
    - Entre las palabras inglesas de una frase, separa con pausas cortas para que no se atropellen: "der is.. uan.. si dí" en vez de "der is uan si dí".
    - Deletrea las siglas con guiones y pausa: "CD" → "si.. dí", "USA" → "iu.. es.. ei".
    - Palabras clave del vocabulario que se enseñan, aíslalas con pausa a ambos lados para que resalten: ".. fader .. papá".
  · Ejemplo de ritmo correcto:
    - En vez de: "der is uan si dí"
    - Escribe: "der is.. uan.. si dí"
    - En vez de: "der ar faiv fótocards"
    - Escribe: "der ar.. faiv.. fóto cards"
  · Objetivo: como lo diría un buen maestro de inglés mexicano hablando DESPACIO y marcando cada palabra para que los alumnos la repitan.
  · Mantén CONSISTENCIA: la misma palabra inglesa siempre con la misma fonética.
- Números en cifra → escríbelos con letra como se dicen: "10x10" → "diez por diez", "2024" → "dos mil veinticuatro".
- Símbolos matemáticos → palabras: "+" → "más", "−"/"-" → "menos", "×"/"*" → "por", "=" → "igual a", "%" → "por ciento".
- Puntuación para ritmo natural: usa ".." (dos puntos) para pausas medias entre ideas; usa "..." (tres puntos) SOLO en 1-2 remates de impacto por texto; usa "¡ !" donde haya énfasis o entusiasmo.
- Si hay fórmulas o expresiones, escríbelas habladas (ej. "x²" → "equis al cuadrado").
- NO uses corchetes ni instrucciones de emoción (el motor los lee literal).
- Mantén el texto en español latino neutro.

Devuelve ÚNICAMENTE el texto adaptado, sin comillas, sin explicaciones, sin encabezados.`

async function adaptToVoiceScript(text: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: VOICE_SCRIPT_SYSTEM,
    messages: [{ role: 'user', content: text }],
  })
  const out = msg.content.find((b) => b.type === 'text')
  return out && out.type === 'text' ? out.text.trim() : text
}

// ─── Voicebox: generar + esperar + descargar ───
async function voiceboxGenerate(text: string): Promise<string> {
  const res = await fetch(`${VOICEBOX_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      profile_id: BODGAR_PROFILE_ID,
      language: 'es',
      engine: 'qwen',
      model_size: '1.7B',
      personality: false,
    }),
  })
  if (!res.ok) throw new Error(`/generate falló: HTTP ${res.status}`)
  const data = await res.json()
  return data.id as string
}

async function voiceboxWait(genId: string): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(`${VOICEBOX_URL}/history/${genId}`)
    if (!res.ok) continue
    const data = await res.json()
    if (data.status === 'completed') return (data.duration as number) ?? 0
    if (data.status === 'failed' || data.error) {
      throw new Error(`Generación falló: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Timeout esperando la generación')
}

async function voiceboxDownloadWav(genId: string, destPath: string): Promise<void> {
  const res = await fetch(`${VOICEBOX_URL}/audio/${genId}`)
  if (!res.ok) throw new Error(`/audio falló: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(destPath, buf)
}

// ─── ffmpeg: WAV → MP3 mono 96k ───
async function toMp3(wavPath: string, mp3Path: string): Promise<void> {
  await execFileP('ffmpeg', [
    '-y', '-i', wavPath,
    '-ac', '1', '-b:a', '96k', '-ar', '44100',
    mp3Path,
  ])
}

// ─── Supabase Storage ───
async function uploadMp3(sectionId: string, mp3Path: string): Promise<string> {
  const buf = await readFile(mp3Path)
  const key = `sections/${sectionId}.mp3`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`Storage upload: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return data.publicUrl
}

// ─── Main ───
async function main() {
  console.log(`\n🎙️  Generate Audio — piloto`)
  console.log(`   Materia: ${subjectSlug}${limit ? ` · límite ${limit}` : ''}${dryRun ? ' · DRY RUN' : ''}\n`)

  // 1. Resolver subject
  const { data: subject, error: subErr } = await supabase
    .from('subjects').select('id, name, slug').eq('slug', subjectSlug).single()
  if (subErr || !subject) {
    console.error(`❌ No encontré la materia "${subjectSlug}". ¿El slug es correcto?`)
    process.exit(1)
  }

  // 2. Traer topics de la materia
  const { data: topics } = await supabase
    .from('topics').select('id').eq('subject_id', subject.id)
  const topicIds = (topics ?? []).map((t) => t.id)
  if (topicIds.length === 0) {
    console.log('   No hay topics en esta materia.')
    return
  }

  // 3. Traer secciones de texto sin audio (paginado, Supabase corta a 1000)
  let sections: { id: string; type: string; content: string }[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('sections')
      .select('id, type, content, audio_url')
      .in('topic_id', topicIds)
      .in('type', AUDIO_TEXT_TYPES)
      .is('audio_url', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Query sections: ${error.message}`)
    const batch = (data ?? []) as { id: string; type: string; content: string; audio_url: string | null }[]
    sections.push(...batch.map((s) => ({ id: s.id, type: s.type, content: s.content })))
    if (batch.length < PAGE) break
    from += PAGE
  }

  if (limit) sections = sections.slice(0, limit)

  console.log(`   ${sections.length} secciones de texto sin audio.\n`)
  if (sections.length === 0) {
    console.log('✓ Nada que hacer. Todas ya tienen audio.')
    return
  }

  // 4. Procesar
  const tmp = await mkdtemp(join(tmpdir(), 'pasas-audio-'))
  let ok = 0, skipped = 0, errors = 0

  for (const [i, section] of sections.entries()) {
    const tag = `[${i + 1}/${sections.length}] ${section.type} ${section.id.slice(0, 8)}`

    // Saltar contenido no narrable (SVG que se coló, o vacío)
    if (!section.content || section.content.trim().startsWith('<svg') || section.content.trim().length < 3) {
      console.log(`   ⏭  ${tag} — sin texto narrable`)
      skipped++
      continue
    }

    if (dryRun) {
      try {
        const voiceScript = await adaptToVoiceScript(section.content)
        console.log(`\n   📝 ${tag}`)
        console.log(`   ─── ORIGINAL ───`)
        console.log(section.content.split('\n').map((l) => `   ${l}`).join('\n'))
        console.log(`   ─── GUIÓN DE VOZ ───`)
        console.log(voiceScript.split('\n').map((l) => `   ${l}`).join('\n'))
        console.log(``)
        ok++
      } catch (err) {
        console.error(`   ✕ ${tag} — ${err instanceof Error ? err.message : 'error'}`)
        errors++
      }
      continue
    }

    const MAX_RETRIES = 3
    let done = false
    for (let attempt = 1; attempt <= MAX_RETRIES && !done; attempt++) {
      try {
        const voiceScript = await adaptToVoiceScript(section.content)
        const genId = await voiceboxGenerate(voiceScript)
        const duration = await voiceboxWait(genId)

        const wavPath = join(tmp, `${section.id}.wav`)
        const mp3Path = join(tmp, `${section.id}.mp3`)
        await voiceboxDownloadWav(genId, wavPath)
        await toMp3(wavPath, mp3Path)
        const url = await uploadMp3(section.id, mp3Path)

        const { error: upErr } = await supabase
          .from('sections')
          .update({ audio_url: url, audio_duration: duration })
          .eq('id', section.id)
        if (upErr) throw new Error(`Update section: ${upErr.message}`)

        await unlink(wavPath).catch(() => {})
        await unlink(mp3Path).catch(() => {})

        console.log(`   ✓ ${tag} — ${duration.toFixed(1)}s${attempt > 1 ? ` (intento ${attempt})` : ''}`)
        ok++
        done = true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'error'
        if (attempt < MAX_RETRIES) {
          console.warn(`   ↻ ${tag} — falló (${msg}), reintento ${attempt + 1}/${MAX_RETRIES} en ${attempt * 3}s`)
          await new Promise((r) => setTimeout(r, attempt * 3000))
        } else {
          console.error(`   ✕ ${tag} — ${msg} (falló tras ${MAX_RETRIES} intentos)`)
          errors++
        }
      }
    }
  }

  console.log(`\n─────────────────────────────`)
  console.log(`   ✓ Generados: ${ok}`)
  console.log(`   ⏭  Saltados:  ${skipped}`)
  console.log(`   ✕ Errores:   ${errors}`)
  console.log(`─────────────────────────────\n`)
}

main().catch((err) => {
  console.error('\n💥 Error fatal:', err)
  process.exit(1)
})
