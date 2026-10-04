#!/usr/bin/env node
// Ilustra un carrusel con OpenAI: una escena por lámina, con la Pasita oficial como
// protagonista dentro del universo del hobby. SIN texto en la imagen: el texto exacto
// (cuentas, fechas, reglas) lo pone después el renderer HTML encima.
//
//   OPENAI_API_KEY=… node src/ilustrar.mjs --data data/carruseles/X.json [--solo 3,5] [--forzar]
//
// Guarda video/arte/<carrusel>/NN.jpg (1080×1350) y estado.json con el resultado de cada
// lámina. Si una falla, las demás siguen; volver a correrlo solo rehace las que faltan
// o cuyo prompt cambió (el prompt va con hash en estado.json).
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const VIDEO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARTE = path.join(VIDEO, 'arte');
const REFS = ['pasita-confiada.png', 'pasita-pensativa.png', 'pasita-celebrando.png'].map(f => path.join(ARTE, 'referencias', f));
// Ejemplo aprobado por el equipo: dirección de arte y acomodo de los textos (modo "completa")
const REF_ESTILO = path.join(ARTE, 'referencias', 'estilo-lamina.png');
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';

export function slugCarrusel(d) {
  return (d.nombre || d.slides[0].titulo.join(' ')).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

// Biblia de estilo: igual para todas las láminas para que el carrusel se vea de una sola pieza.
const ESTILO = `
STYLE (always the same): polished 2D cartoon illustration for an Instagram educational carousel, thick dark outlines,
rich saturated colors, night-time scene, deep purple/indigo palette (#0f0a1e, #1a1035, #2d1b69) with warm accent lights
and soft neon purple glow (#7c3aed). Expressive, friendly, for Mexican teenagers (13-18). Vertical 4:5 composition.

MAIN CHARACTER: "la Pasita", the PASAS.MX mascot, exactly as in the reference images: a purple raisin (#7C3AED, darker
#4C1D95 wrinkles), big white cartoon eyes with dark pupils, thick eyebrows, small smile, thin purple arms with 4-finger
hands, thin purple legs, white sneakers with purple and orange-yellow details. Keep her proportions, colors and face
consistent with the references. She can wear costume accessories of the universe (headband, cape, jersey, microphone)
but must stay clearly recognizable. Copies/clones of her are allowed when the scene needs it.

COMPOSITION: the TOP 40% of the image must be calm and dark (sky, wall, shadow, soft bokeh) with no important details,
because large white text will be placed there. Put the main action and the character in the lower 60%. Keep important
elements away from the outer 6% border.

STRICT RULES:
- ABSOLUTELY NO TEXT in the image: no letters, numbers, words, signs, captions, logos or watermarks. Symbols on props
  must be abstract shapes (no kanji, no letters, no digits). Numbers will be added later by the layout.
- NO existing copyrighted characters, real people, celebrities, team crests, band logos or brand logos. Evoke the
  universe only through generic setting elements (architecture, costumes, props, lighting).
- No violence beyond cartoon action, nothing scary or suggestive.`.trim();

export function promptDe(d, s, i) {
  const u = d.arte?.universo || '';
  return `${ESTILO}

UNIVERSE OF THIS CAROUSEL: ${u}

SLIDE ${i + 1} of ${d.slides.length}. SCENE: ${s.arte.escena}
${s.arte.pose ? `Pasita pose/expression: ${s.arte.pose}.` : ''}`.trim();
}

// ─── Modo "completa": OpenAI dibuja la lámina entera, con sus textos ───
// El texto se le da EXACTO, lámina por lámina; ** marca lo que va resaltado en color.
const limpio = t => String(t || '').replace(/\*\*(.+?)\*\*/g, '«$1»');
export function textosDe(d, s, i) {
  const L = [];
  const add = (k, v) => { if (v) L.push(`${k}: ${limpio(v)}`); };
  if (s.tipo === 'portada') {
    add('SMALL TAG (pill)', `${d.materia} · ${d.nivel}`.toUpperCase());
    add('BIG TITLE (2 lines)', s.titulo.join(' / '));
    if (d.hobby) { add('SMALL LINE', 'explicado con'); add('HANDWRITTEN-STYLE BIG LABEL', d.hobby.nombre); }
  } else {
    add('SMALL TAG (pill)', (s.etiqueta || '').toUpperCase());
    if (s.titulo) add('BIG TITLE (2 lines)', s.titulo.join(' / '));
  }
  if (s.tipo === 'escena') add('BODY TEXT', s.texto);
  if (s.tipo === 'ejemplo') { add('BODY TEXT', s.problema); s.pasos.forEach((p, k) => add(`NUMBERED STEP ${k + 1} (inside a rounded panel)`, p)); }
  if (s.tipo === 'mapa') { s.pares.forEach(p => add('ROW (left box → right box)', `${p[0]} → ${p[1]}`)); add('BIG FORMULA PANEL', s.formula); add('SMALL NOTE', s.nota); }
  if (s.tipo === 'reglas') { s.reglas.forEach(r => add('RULE PANEL', `${r.si} | badge: ${r.haz} | ${r.formula}`)); add('SMALL NOTE', s.nota); }
  if (s.tipo === 'reto') { add('QUESTION', s.pregunta); s.opciones.forEach((o, k) => add(`OPTION ${'ABC'[k]} (round letter badge + pill)`, o)); add('SMALL LINE', 'Escribe tu respuesta en los comentarios.'); }
  if (s.tipo === 'chuleta') {
    add('FORMULA PANEL', s.formula);
    s.pasos.forEach((p, k) => add(`NUMBERED STEP ${k + 1}`, p.t + (p.f ? ' — ' + p.f : '')));
    add('MEMORY NOTE (on a small paper scroll)', s.recuerdo);
    add('SMALL CORNER BADGE', 'Guárdala para tu examen');
    add('TINY FOOTER', 'Respuesta del reto: ' + limpio(s.respuesta_reto));
  }
  return L.join('\n');
}

const ESTILO_COMPLETA = `
Create ONE finished slide of an Instagram educational carousel for PASAS.MX (Mexican learning platform for teens),
in EXACTLY the same art direction and layout language as the attached example sheet (the 3×3 grid of slides):
dark night scene with purple/indigo palette and warm lantern lights, thick-outline polished cartoon illustration,
rounded neon purple frame around the whole slide, "PASAS.MX" wordmark top-left in white geometric font,
small rounded counter pill top-right showing the slide number, small orange rounded tag pill, very big bold rounded
sans-serif title in white with the second line in orange-yellow, readable body text in white, information panels as
dark rounded boxes with thin neon borders, numbered orange circles for steps. Text sits on the left/top, the
character and scene fill the rest, like the example.

CHARACTER: the protagonist is "la Pasita", the PASAS.MX mascot (the purple raisin in the other reference images:
purple wrinkled raisin body, big white cartoon eyes, thick eyebrows, thin arms and legs, white sneakers with purple and
yellow). Same character on every slide. She may wear costume accessories of the universe.

TEXT RULES (very important):
- Write ONLY the texts listed below, in Spanish, EXACTLY as written, with all accents (á é í ó ú ñ ¿ ¡). Do not add,
  translate, shorten or invent any other words, numbers or labels anywhere in the image.
- Text between « » must be highlighted in orange-yellow (do not draw the « » marks).
- Every word must be perfectly spelled and fully legible; large enough to read on a phone.
- No other logos, no watermarks, no real brands, no existing copyrighted characters or real people, no franchise
  symbols (use abstract swirl symbols on talismans).`.trim();

export function promptCompleta(d, s, i) {
  return `${ESTILO_COMPLETA}

UNIVERSE: ${d.arte?.universo || ''}

THIS IS SLIDE ${i + 1} OF ${d.slides.length} (counter pill shows "${i + 1}/${d.slides.length}").
SCENE: ${s.arte.escena}
${s.arte.pose ? `Pasita pose/expression: ${s.arte.pose}.` : ''}

TEXTS TO WRITE (and nothing else):
PASAS.MX
${i + 1}/${d.slides.length}
${textosDe(d, s, i)}`.trim();
}

const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function llamarOpenAI(prompt, { refs = REFS, size = '1024x1536', calidad = QUALITY } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Falta OPENAI_API_KEY');
  const fd = new FormData();
  fd.append('model', MODEL);
  fd.append('prompt', prompt);
  fd.append('size', size);
  fd.append('quality', calidad);
  fd.append('n', '1');
  for (const r of refs) fd.append('image[]', new Blob([await readFile(r)], { type: 'image/png' }), path.basename(r));
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`OpenAI ${res.status}: ${body?.error?.message || JSON.stringify(body).slice(0, 300)}`);
    // 429 por saldo agotado no se arregla reintentando; 429 por límite de velocidad sí
    e.reintentable = (res.status === 429 && body?.error?.code !== 'insufficient_quota' && !/credits|quota|billing/i.test(body?.error?.message || '')) || res.status >= 500;
    throw e;
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI no devolvió imagen');
  return Buffer.from(b64, 'base64');
}

// 1024×1536 (2:3) → 1080×1350 (4:5) recortando arriba y abajo por igual
function aJpg(png, destino, vf = 'scale=1080:-2,crop=1080:1350') {
  const tmp = destino + '.src.png';
  return writeFile(tmp, png).then(() => {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', vf, '-q:v', '3', destino]);
    return rm(tmp, { force: true }).then(() => { if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr); });
  });
}

export async function ilustrar(d, { solo = null, forzar = false, log = console.log } = {}) {
  const dir = path.join(ARTE, slugCarrusel(d));
  await mkdir(dir, { recursive: true });
  const fEstado = path.join(dir, 'estado.json');
  const estado = existsSync(fEstado) ? JSON.parse(await readFile(fEstado, 'utf8')) : {};
  const tareas = d.slides.map((s, i) => ({ s, i })).filter(({ s, i }) => s.arte?.escena && (!solo || solo.includes(i + 1)));
  if (!tareas.length) { log('  este carrusel no trae escenas para ilustrar ("arte.escena")'); return { dir, estado }; }

  async function una({ s, i }) {
    const completa = (d.arte?.modo || 'completa') === 'completa';
    const calidad = completa ? (process.env.OPENAI_IMAGE_QUALITY_COMPLETA || QUALITY) : QUALITY;
    const n = String(i + 1).padStart(2, '0'), prompt = completa ? promptCompleta(d, s, i) : promptDe(d, s, i), h = hash(prompt + MODEL + calidad);
    const archivo = path.join(dir, `${n}.jpg`);
    if (!forzar && estado[n]?.ok && estado[n].hash === h && existsSync(archivo)) { log(`  ${n}: ya estaba`); return; }
    for (let intento = 1; intento <= 3; intento++) {
      try {
        const t0 = Date.now();
        if (completa) {
          // Lámina 4:5 completa; si el modelo no acepta ese tamaño, 2:3 y se rellena sin recortar texto
          let png;
          try { png = await llamarOpenAI(prompt, { refs: [REF_ESTILO, ...REFS], size: '1024x1280', calidad }); }
          catch (e) { if (!/size/i.test(e.message)) throw e; png = await llamarOpenAI(prompt + '\nKeep every text inside the central 4:5 area.', { refs: [REF_ESTILO, ...REFS], calidad }); }
          await aJpg(png, archivo, 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350');
        } else {
          await aJpg(await llamarOpenAI(prompt), archivo);
        }
        estado[n] = { ok: true, hash: h, modo: completa ? 'completa' : 'fondo', modelo: MODEL, calidad, segundos: Math.round((Date.now() - t0) / 1000), fecha: new Date().toISOString() };
        log(`  ${n}: lista (${estado[n].segundos} s)`);
        return;
      } catch (e) {
        estado[n] = { ok: false, hash: h, error: e.message, intento, fecha: new Date().toISOString() };
        log(`  ${n}: falló (intento ${intento}): ${e.message}`);
        if (!e.reintentable && !/fetch failed|ECONN|timeout/i.test(e.message)) return;
        await dormir(5000 * intento);
      }
    }
  }
  // De 3 en 3 para no chocar con el límite de la API
  for (let k = 0; k < tareas.length; k += 3) await Promise.all(tareas.slice(k, k + 3).map(una));
  await writeFile(fEstado, JSON.stringify(estado, null, 2) + '\n');
  return { dir, estado };
}

async function main() {
  const { values: a } = parseArgs({ options: { data: { type: 'string', multiple: true }, solo: { type: 'string' }, forzar: { type: 'boolean', default: false } } });
  if (!a.data?.length) throw new Error('Falta --data');
  const solo = a.solo ? a.solo.split(',').map(Number) : null;
  let fallas = 0;
  for (const f of a.data) {
    const d = JSON.parse(await readFile(f, 'utf8'));
    console.log(`Ilustrando ${f} con ${MODEL} (${QUALITY})`);
    const { estado } = await ilustrar(d, { solo, forzar: a.forzar });
    fallas += Object.values(estado).filter(e => !e.ok).length;
  }
  if (fallas) console.log(`⚠ ${fallas} lámina(s) sin ilustración: saldrán con el diseño sin ilustración y se pueden reintentar con --solo`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
