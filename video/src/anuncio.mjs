#!/usr/bin/env node
// Anuncio pagado del reto diario para papás (Meta/TikTok): gancho → "¿Cuál sobra?" con el
// toque → por qué sobra → un reto nuevo cada día → pasas.mx/arcade.
//   node src/anuncio.mjs --data data/anuncios/2026-10-reto-historia-papas.json [--revisar]
//
// Fondos: los dibuja OpenAI (workflow "Fondos de anuncios", ~$0.09 USD por escena) y quedan
// en video/arte/<anuncio>/reel-NN.jpg. Si falta alguno, esa escena sale con el fondo morado
// de respaldo, así que se puede revisar el texto antes de pagar las ilustraciones.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames } from './render.mjs';
import { ARTE, slugCarrusel } from './ilustrar.mjs';

const { values: a } = parseArgs({ options: { data: { type: 'string' }, salida: { type: 'string', default: 'salida/anuncios' }, revisar: { type: 'boolean', default: false } } });
if (!a.data) throw new Error('Falta --data archivo.json');
const d = JSON.parse(await readFile(a.data, 'utf8'));
const slug = slugCarrusel(d);
const fondos = d.reel.escenas.map((_, i) => {
  const f = path.join(ARTE, slug, `reel-${String(i + 1).padStart(2, '0')}.jpg`);
  return existsSync(f) ? f : null;
});
const faltan = fondos.map((f, i) => (f ? null : i + 1)).filter(Boolean);
if (faltan.length) console.log(`⚠ Sin fondo de OpenAI en la(s) escena(s) ${faltan.join(', ')}: salen con el fondo de respaldo`);
const dir = path.resolve(a.salida); await mkdir(dir, { recursive: true });
const datos = { ...d, reel_fondos: fondos };
await withBrowser(async b => {
  if (a.revisar) { console.log((await renderFrames(b, 'anuncio-reto.html', datos, path.join(dir, slug))).join('\n')); return; }
  const out = path.join(dir, `${slug}.mp4`);
  const { duration } = await renderVideo(b, 'anuncio-reto.html', datos, out, { log: m => console.log(m) });
  if (d.post) await writeFile(path.join(dir, `${slug}.txt`), d.post + '\n');
  console.log(`Anuncio listo: ${out} (${duration} s)`);
});
