#!/usr/bin/env node
// "Así funciona PASAS" v2 (s44): anuncio de conversión para papás con voz, ~25 s.
//   node src/como-funciona-v2.mjs --data data/anuncios/X.json --revisar          → un PNG por escena
//   node src/como-funciona-v2.mjs --data data/anuncios/X.json --guion            → guion numerado (una línea de voz por escena)
//   node src/como-funciona-v2.mjs --data data/anuncios/X.json                    → MP4 sin voz (duraciones "dur" del JSON)
//   node src/como-funciona-v2.mjs --data data/anuncios/X.json --audios carpeta/  → MP4 con la voz: cada escena dura lo que su audio
// Fondos: los dibuja OpenAI (workflow "Fondos de anuncios") en video/arte/<slug>/reel-NN.jpg; sin fondo, morado de respaldo.
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames } from './render.mjs';
import { ARTE, slugCarrusel } from './ilustrar.mjs';
import { leerAudios, tiemposDe, armarPista, ponerPista } from './voz.mjs';

const { values: a } = parseArgs({ options: {
  data: { type: 'string' }, salida: { type: 'string', default: 'salida/anuncios' },
  revisar: { type: 'boolean', default: false }, guion: { type: 'boolean', default: false }, audios: { type: 'string' },
} });
if (!a.data) throw new Error('Falta --data archivo.json');
const d = JSON.parse(await readFile(a.data, 'utf8'));
const slug = slugCarrusel(d);
const E = d.reel.escenas;
const dir = path.resolve(a.salida); await mkdir(dir, { recursive: true });

if (a.guion) {
  const g = E.map((e, i) => `${String(i + 1).padStart(2, '0')}. ${e.voz || ''}`).join('\n');
  const f = path.join(dir, `${slug}-guion.txt`);
  await writeFile(f, g + '\n');
  console.log(g); console.log(`\nGuion en ${f}`);
  process.exit(0);
}

const fondos = E.map((_, i) => { const f = path.join(ARTE, slug, `reel-${String(i + 1).padStart(2, '0')}.jpg`); return existsSync(f) ? f : null; });
const faltan = E.map((e, i) => (e.arte && !fondos[i] ? i + 1 : null)).filter(Boolean);
if (faltan.length) console.log(`⚠ Sin fondo de OpenAI en la(s) escena(s) ${faltan.join(', ')}: salen con el fondo de respaldo`);

let voz = null;
if (a.audios) {
  const files = await leerAudios(path.resolve(a.audios), E.length);
  d.tiempos = tiemposDe(files);
  voz = { files, pista: path.join(dir, `${slug}-voz.m4a`) };
  console.log(`  ${files.length} audios · ${d.tiempos.reduce((x, y) => x + y, 0).toFixed(1)} s en total`);
}
const datos = { ...d, reel_fondos: fondos };
await withBrowser(async b => {
  if (a.revisar) { console.log((await renderFrames(b, 'como-funciona-v2.html', datos, path.join(dir, slug))).join('\n')); return; }
  const out = path.join(dir, `${slug}.mp4`);
  const { duration } = await renderVideo(b, 'como-funciona-v2.html', datos, out, { log: m => console.log(m) });
  if (voz) {
    armarPista(voz.files, d.tiempos, voz.pista);
    const tmp = out.replace(/\.mp4$/, '.voz.mp4');
    ponerPista(out, voz.pista, tmp); await rename(tmp, out); await rm(voz.pista, { force: true });
    console.log('  voz unida al video');
  }
  if (d.post) await writeFile(path.join(dir, `${slug}.txt`), d.post + '\n');
  console.log(`Anuncio listo: ${out} (${Number(duration).toFixed(1)} s)`);
});
