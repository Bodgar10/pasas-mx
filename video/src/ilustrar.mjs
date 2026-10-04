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
// Filosofía: la escena ENSEÑA. Cada lámina es una composición ilustrada distinta cuyo objeto
// protagonista comunica la idea de esa lámina; no es un fondo oscuro detrás de una plantilla.
const ESTILO = `
ART DIRECTION: cinematic 2D cartoon illustration for an Instagram educational carousel aimed at Mexican teenagers
(13-18). Polished, expressive, thick confident outlines, rich saturated color, painterly lighting. Each slide is a
DIFFERENT illustrated composition that TEACHES the idea of that slide through a protagonist object (not a generic
backdrop). The world feels alive and specific to the analogy: atmosphere, smoke, particles, glowing light sources
integrated in the set (lanterns, screens, stage lights, moon), reflections and rim light on the character.

DEPTH: always build clear cinematic depth with a foreground layer (props or elements close to camera, slightly
blurred or dark), a midground (the character and the protagonist object) and a background (environment, sky,
architecture), with atmospheric perspective and light haze between layers.

COMPOSITION: vary shot types across slides as requested (close-up, medium shot, character at the side, giant object,
crowd of clones, wide establishing shot). The character's scale, pose and position change from slide to slide; never
default to "small character at the bottom". Leave the specific TEXT ZONE described for this slide visually calm
(simple sky, wall, shadow or soft bokeh, no faces or key props there) so text can be placed on top later; the rest of
the frame can be rich and detailed. Keep key elements away from the outer 5% border. Vertical 4:5 framing.

MAIN CHARACTER: "la Pasita", the PASAS.MX mascot, exactly as in the reference images: a purple raisin (#7C3AED with
darker #4C1D95 wrinkles), big white cartoon eyes with dark pupils, thick eyebrows, small mouth, thin purple arms with
4-finger hands, thin purple legs, white sneakers with purple and orange-yellow details. Same proportions, colors and
face on every slide, clearly recognizable. She may wear costume accessories of the universe (headband, scarf, jersey,
microphone, headset). Copies/clones of her only when the scene asks for them.

STRICT RULES:
- ABSOLUTELY NO TEXT in the image: no letters, numbers, digits, words, signs, captions, labels, logos or watermarks.
  Symbols on props must be abstract shapes. Exact numbers and words are added later by the layout.
- NO existing copyrighted characters, real people, celebrities, team crests, band logos, brand logos or franchise
  symbols. Evoke the universe only through generic setting elements (architecture, costumes, props, lighting).
- No violence beyond cartoon action, nothing scary or suggestive.`.trim();

// arte.escena puede ser un texto o, mejor, un objeto con todos sus campos (ver CARRUSELES.md)
const CAMPOS = [
  ['accion', 'MAIN ACTION'], ['protagonista', 'PROTAGONIST'], ['objeto', 'PROTAGONIST TEACHING OBJECT'],
  ['foreground', 'FOREGROUND'], ['midground', 'MIDGROUND'], ['background', 'BACKGROUND'],
  ['iluminacion', 'LIGHTING'], ['emocion', 'EMOTION'], ['composicion', 'COMPOSITION / SHOT'],
];
const ZONAS = {
  arriba: 'the upper ~45% of the frame', 'arriba-grande': 'the upper ~70% of the frame (keep the action in the bottom 30%)',
  abajo: 'the lower ~40% of the frame', izquierda: 'the left ~55% of the frame, full height', derecha: 'the right ~55% of the frame, full height',
};
export function zonaDe(s) { return s.arte?.zona_texto || 'arriba'; }

export function promptDe(d, s, i) {
  const u = d.arte?.universo || '', e = s.arte.escena;
  const escena = typeof e === 'string' ? `SCENE: ${e}${s.arte.pose ? `\nPasita pose/expression: ${s.arte.pose}.` : ''}`
    : CAMPOS.filter(([k]) => e[k]).map(([k, n]) => `${n}: ${e[k]}`).join('\n');
  return `${ESTILO}

UNIVERSE OF THIS CAROUSEL: ${u}

SLIDE ${i + 1} of ${d.slides.length}.
${escena}
TEXT ZONE (keep calm, no key elements): ${ZONAS[zonaDe(s)] || ZONAS.arriba}.`.trim();
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
Create ONE finished slide of an Instagram educational carousel for PASAS.MX (a Mexican learning platform for teens 13-18).
Match the art direction, text styling and creative freedom of the attached EXAMPLE SHEET (the 3×3 grid of finished slides):
polished cinematic 2D cartoon illustration, thick confident outlines, rich color, depth (foreground, midground,
background), lighting integrated in the set, atmosphere (smoke, particles, glow). Use the example for principles of
composition, text styling and density, not to copy its exact scenes.

LAYOUT AND TEXT DESIGN (creative freedom, like the example):
- Rounded neon frame around the whole slide in the ACCENT COLOR given below (not pink/fuchsia unless that is the accent).
- "PASAS.MX" wordmark small in the top-left corner (white, geometric) and a small rounded counter pill top-right.
- Place the texts wherever the composition works best for THIS slide (left column, top, beside the character, inside
  rounded panels, on a scroll, in a speech bubble, as a badge). Vary placement between slides. Big bold rounded
  sans-serif titles (white, with the second line or key words in the accent color), short readable body text, small
  orange tag pills, dark rounded info panels with thin neon borders, numbered circles for steps, letter badges for options.
- You MAY integrate a key number or phrase from the texts into the scene (e.g. painted on a giant door or a scroll)
  as long as it is written exactly as listed.

CHARACTER: the protagonist is "la Pasita", the PASAS.MX mascot (the purple raisin in the reference images: wrinkled
purple raisin body, big white cartoon eyes, thick eyebrows, thin arms and legs, white sneakers with purple and yellow).
Same character on every slide, varying pose, scale and position. She may wear costume accessories of the universe.

TEXT RULES (very important):
- Write ONLY the texts listed below, in Spanish, EXACTLY as written, with all accents (á é í ó ú ñ ¿ ¡). Do not add,
  translate, shorten or invent any other words, numbers or labels.
- Text between « » is highlighted in the accent color (do not draw the « » marks).
- Every word perfectly spelled and fully legible on a phone screen.
- No other logos, no watermarks, no real brands, no existing copyrighted characters or real people, no franchise
  symbols (use abstract symbols).`.trim();

export function promptCompleta(d, s, i) {
  const e = s.arte.escena;
  const escena = typeof e === 'string' ? `SCENE: ${e}${s.arte.pose ? `\nPasita pose/expression: ${s.arte.pose}.` : ''}`
    : CAMPOS.filter(([k]) => e[k]).map(([k, n]) => `${n}: ${e[k]}`).join('\n');
  return `${ESTILO_COMPLETA}

ACCENT COLOR OF THIS CAROUSEL: ${d.hobby?.color || '#7c3aed'}
UNIVERSE: ${d.arte?.universo || ''}

THIS IS SLIDE ${i + 1} OF ${d.slides.length} (counter pill shows "${i + 1}/${d.slides.length}").
${escena}

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
