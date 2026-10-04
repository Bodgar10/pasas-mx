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

const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function llamarOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Falta OPENAI_API_KEY');
  const fd = new FormData();
  fd.append('model', MODEL);
  fd.append('prompt', prompt);
  fd.append('size', '1024x1536');
  fd.append('quality', QUALITY);
  fd.append('n', '1');
  for (const r of REFS) fd.append('image[]', new Blob([await readFile(r)], { type: 'image/png' }), path.basename(r));
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`OpenAI ${res.status}: ${body?.error?.message || JSON.stringify(body).slice(0, 300)}`);
    e.reintentable = res.status === 429 || res.status >= 500;
    throw e;
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI no devolvió imagen');
  return Buffer.from(b64, 'base64');
}

// 1024×1536 (2:3) → 1080×1350 (4:5) recortando arriba y abajo por igual
function aJpg(png, destino) {
  const tmp = destino + '.src.png';
  return writeFile(tmp, png).then(() => {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', 'scale=1080:-2,crop=1080:1350', '-q:v', '3', destino]);
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
    const n = String(i + 1).padStart(2, '0'), prompt = promptDe(d, s, i), h = hash(prompt + MODEL + QUALITY);
    const archivo = path.join(dir, `${n}.jpg`);
    if (!forzar && estado[n]?.ok && estado[n].hash === h && existsSync(archivo)) { log(`  ${n}: ya estaba`); return; }
    for (let intento = 1; intento <= 3; intento++) {
      try {
        const t0 = Date.now();
        await aJpg(await llamarOpenAI(prompt), archivo);
        estado[n] = { ok: true, hash: h, modelo: MODEL, calidad: QUALITY, segundos: Math.round((Date.now() - t0) / 1000), fecha: new Date().toISOString() };
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
