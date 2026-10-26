#!/usr/bin/env node
// "Un tema, cuatro hobbies" (s45): retador A/B del "Así funciona PASAS" para papás.
//   node src/cuatro-hobbies.mjs --data data/anuncios/X.json [--revisar]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames } from './render.mjs';
import { slugCarrusel } from './ilustrar.mjs';

const { values: a } = parseArgs({ options: { data: { type: 'string' }, salida: { type: 'string', default: 'salida/anuncios' }, revisar: { type: 'boolean', default: false } } });
if (!a.data) throw new Error('Falta --data archivo.json');
const d = JSON.parse(await readFile(a.data, 'utf8'));
const slug = slugCarrusel(d);
const dir = path.resolve(a.salida); await mkdir(dir, { recursive: true });
await withBrowser(async b => {
  if (a.revisar) { console.log((await renderFrames(b, 'cuatro-hobbies.html', d, path.join(dir, slug))).join('\n')); return; }
  const out = path.join(dir, `${slug}.mp4`);
  const { duration } = await renderVideo(b, 'cuatro-hobbies.html', d, out, { log: m => console.log(m) });
  if (d.post) await writeFile(path.join(dir, `${slug}.txt`), d.post + '\n');
  console.log(`Anuncio listo: ${out} (${Number(duration).toFixed(1)} s)`);
});
