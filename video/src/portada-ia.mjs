#!/usr/bin/env node
// Portada ilustrada con OpenAI ("hazla con ChatGPT") para un video de la Pasita (tip o lección).
// OpenAI dibuja la portada completa con su título (mismo estilo aprobado que los carruseles);
// la duración y PASAS.MX los pone después pasita.mjs / tematica.mjs encima (portada-ia.html),
// porque la duración real solo se sabe al armar el video.
//
// El JSON del video lleva un bloque "portada_ia" (ver PASITA.md → "Portada con ChatGPT").
// Corre en GitHub Actions (workflow "Portada con OpenAI"), que es donde vive OPENAI_API_KEY:
//   OPENAI_API_KEY=… node src/portada-ia.mjs --data data/publicados/X.json [--forzar]
// Deja video/arte/portadas/<video>.jpg (1080×1920) y su resultado en arte/portadas/estado.json.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ARTE, REFS, REF_APROBADAS, MODEL, QUALITY, CAMPOS, hash, llamarOpenAI, aJpg, dormir } from './ilustrar.mjs';

export const PORTADAS = path.join(ARTE, 'portadas');
const COLORES = { cian: '#22d3ee', rosa: '#ec4899', amarillo: '#facc15', morado: '#a78bfa' };

// Mismo nombre que usan pasita.mjs y tematica.mjs para sus archivos
export function slugVideo(d) {
  const p = d.pantallas?.[0];
  const base = d.nombre || p?.lineas?.join(' ') || p?.titulo || d.portada_titulo?.join(' ') || 'video';
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'video';
}
export const archivoPortadaIA = d => path.join(PORTADAS, `${slugVideo(d)}.jpg`);

// Título, etiqueta y color: lo que diga portada_ia o, si no, lo mismo que la portada normal
export function textosPortada(d) {
  const pi = d.portada_ia || {}, p = d.pantallas || [];
  const g = p.find(x => x.tipo === 'gancho');
  const promesa = p.find(x => x.tipo === 'grande');
  const titulo = pi.titulo || g?.lineas || d.portada_titulo || [p[0]?.titulo || ''];
  const etiqueta = pi.etiqueta ?? (promesa ? [promesa.titulo, promesa.texto].filter(Boolean).join(' ') : d.tematica ? `${d.materia || ''} con ${d.tematica}`.trim() : '');
  const color = pi.color || COLORES[g?.color] || '#22d3ee';
  return { titulo, etiqueta, color };
}

export function validarPortadaIA(d) {
  const e = [], pi = d.portada_ia;
  if (!pi) return ['falta el bloque "portada_ia" (con al menos "escena")'];
  if (!pi.escena) e.push('"portada_ia" necesita "escena": qué se ve en la portada (en inglés, sin texto)');
  const { titulo } = textosPortada(d);
  if (!titulo.length || titulo.length > 4) e.push('el título de la portada lleva de 1 a 4 líneas');
  titulo.forEach(l => { if (l.replace(/\*\*/g, '').length > 18) e.push(`"${l}" es muy larga para el título de la portada (máx. 18)`); });
  return e;
}

const ESTILO_PORTADA = `
Create the COVER IMAGE of a vertical reel (Instagram / TikTok) for PASAS.MX, a Mexican learning platform for teens 13-18.
REFERENCE IMAGES, in order: (1-2) two APPROVED images from PASAS.MX itself: the quality bar to keep (cinematic 2D
cartoon illustration, rich color, depth, lighting, text styling) and the exact look of the Pasita; (3+) the official
Pasita character sheet.

FORMAT: vertical 9:16. SAFE ZONE (very important): the Instagram profile grid crops the cover to its central 3:4 area,
so put ALL the text and the Pasita's face between 14% and 84% of the image height. Keep the bottom 16% free of text and
key elements (a duration badge and the PASAS.MX wordmark are added there later); top and bottom edges are background only.

LAYOUT: a big bold rounded sans-serif TITLE in the upper half of the safe zone (white, key words in the ACCENT COLOR,
dark outline or shadow so it reads on a phone at thumbnail size). If there is a TAG, a rounded pill in the accent color
just above or below the title. Below the title, the Pasita as protagonist of ONE clear scene that shows the topic at a
glance. A thin rounded neon frame in the accent color just inside the safe zone. Polished cinematic 2D cartoon style,
thick confident outlines, depth (foreground, midground, background), lighting integrated in the set.

TONE: honest and warm, NO clickbait: no arrows, no red circles, no exaggerated shocked faces, no "!!!", no fake urgency.

SENSITIVE TOPICS (bullying, anxiety, self-esteem, family, health): show empathy, support and safety. Never depict
violence, injuries, despair, humiliation or someone being attacked; prefer a moment of support (someone standing by a
classmate, a hand offered, a group making room for someone, talking with a trusted adult). Other characters are
original cute raisins or generic cartoon teens, never real people.

CHARACTER (strict consistency): the protagonist is "la Pasita", the PASAS.MX mascot exactly as in the references: wrinkled
purple raisin body (#7C3AED with darker #4C1D95 wrinkles), big white cartoon eyes, thick eyebrows, small mouth, thin
purple arms with 4-finger hands, thin legs, white sneakers with purple and yellow details. Identical body, color, face,
limbs and sneakers; only pose, expression and accessories change. If she is thinking, she has BOTH hands visible: one on
her chin and the other on her waist.

TEXT RULES:
- Write ONLY the texts listed below, in Spanish, EXACTLY as written, with all accents (á é í ó ú ñ ¿ ¡). Do not add,
  translate, shorten or invent any other words, numbers, labels or signs. No PASAS.MX wordmark (it is added later).
- Words listed under HIGHLIGHT go in the accent color. Never draw quotation marks or asterisks that are not in the text.
- Every word perfectly spelled and fully legible on a phone screen.
- No logos, watermarks, real brands, existing copyrighted characters, franchise symbols or real people. On clothes or
  props use only the PASAS emblem (a raisin silhouette inside a circle) or plain abstract shapes.`.trim();

export function promptPortada(d) {
  const { titulo, etiqueta, color } = textosPortada(d);
  const e = d.portada_ia.escena;
  const escena = typeof e === 'string' ? `SCENE: ${e}` : CAMPOS.filter(([k]) => e[k]).map(([k, n]) => `${n}: ${e[k]}`).join('\n');
  const marcados = titulo.flatMap(l => [...l.matchAll(/\*\*(.+?)\*\*/g)].map(m => m[1]));
  const resaltar = marcados.length ? marcados : [titulo.at(-1).replace(/\*\*/g, '')];
  return `${ESTILO_PORTADA}

ACCENT COLOR: ${color}
TOPIC OF THE VIDEO: ${d.portada_ia.tema || titulo.join(' ').replace(/\*\*/g, '')}
${escena}

TEXTS TO WRITE (and nothing else):
TITLE (${titulo.length} lines): ${titulo.map(l => l.replace(/\*\*/g, '')).join(' / ')}${etiqueta ? `\nTAG (pill): ${etiqueta}` : ''}

HIGHLIGHT (accent color): ${resaltar.join(' · ')}`.trim();
}

export async function portadaIA(d, { forzar = false, log = console.log } = {}) {
  const errores = validarPortadaIA(d);
  if (errores.length) throw new Error('La portada no se generó:\n  - ' + errores.join('\n  - '));
  await mkdir(PORTADAS, { recursive: true });
  const fEstado = path.join(PORTADAS, 'estado.json');
  const estado = existsSync(fEstado) ? JSON.parse(await readFile(fEstado, 'utf8')) : {};
  const n = slugVideo(d), archivo = archivoPortadaIA(d), prompt = promptPortada(d), h = hash(prompt + MODEL + QUALITY);
  if (!forzar && estado[n]?.ok && estado[n].hash === h && existsSync(archivo)) { log(`  ${n}: ya estaba`); return { archivo, ok: true }; }
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const t0 = Date.now();
      await aJpg(await llamarOpenAI(prompt, { refs: [...REF_APROBADAS, ...REFS] }), archivo, 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920');
      estado[n] = { ok: true, hash: h, modelo: MODEL, calidad: QUALITY, segundos: Math.round((Date.now() - t0) / 1000), fecha: new Date().toISOString() };
      log(`  ${n}: lista (${estado[n].segundos} s)`);
      break;
    } catch (e) {
      estado[n] = { ok: false, hash: h, error: e.message, intento, fecha: new Date().toISOString() };
      log(`  ${n}: falló (intento ${intento}): ${e.message}`);
      if (!e.reintentable && !/fetch failed|ECONN|timeout/i.test(e.message)) break;
      await dormir(5000 * intento);
    }
  }
  await writeFile(fEstado, JSON.stringify(estado, null, 2) + '\n');
  return { archivo, ok: !!estado[n]?.ok, error: estado[n]?.error };
}

async function main() {
  const { values: a } = parseArgs({ options: { data: { type: 'string', multiple: true }, forzar: { type: 'boolean', default: false }, prompt: { type: 'boolean', default: false } } });
  if (!a.data?.length) throw new Error('Falta --data archivo.json');
  let fallas = 0;
  for (const f of a.data) {
    const d = JSON.parse(await readFile(f, 'utf8'));
    if (a.prompt) { console.log(promptPortada(d)); continue; }
    console.log(`Portada con ${MODEL} (${QUALITY}) para ${f}`);
    const r = await portadaIA(d, { forzar: a.forzar });
    if (!r.ok) fallas++;
  }
  if (fallas) { console.error(`✖ ${fallas} portada(s) no se generaron`); process.exit(1); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
