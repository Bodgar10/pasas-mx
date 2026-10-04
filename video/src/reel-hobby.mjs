#!/usr/bin/env node
// Reel "con hobby" (20-25 s): la microhistoria del carrusel con un solo momento de
// revelación ("¿eso era una ecuación?"). Reel = descubrir; carrusel = aprender y guardar.
//   node src/reel-hobby.mjs --data data/reels/2026-10-ecuaciones-naruto.json [--revisar]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames } from './render.mjs';

const { values: a } = parseArgs({ options: { data: { type: 'string' }, salida: { type: 'string', default: 'salida/reels' }, revisar: { type: 'boolean', default: false } } });
if (!a.data) throw new Error('Falta --data archivo.json');
const d = JSON.parse(await readFile(a.data, 'utf8'));
if ((d.total - d.inicial) % d.por_unidad) throw new Error('Las cuentas no cierran: (total − inicial) debe dividirse entre por_unidad');
const nombre = d.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const dir = path.resolve(a.salida); await mkdir(dir, { recursive: true });
await withBrowser(async b => {
  if (a.revisar) { console.log((await renderFrames(b, 'reel-hobby.html', d, path.join(dir, nombre))).join('\n')); return; }
  const out = path.join(dir, `${nombre}.mp4`);
  const { duration } = await renderVideo(b, 'reel-hobby.html', d, out, { log: m => console.log(m) });
  const notas = [d.post && `TEXTO PARA LA PUBLICACIÓN\n${d.post}`, d.guion && `GUION PARA VOZ (una línea por escena)\n${d.guion.map((g, i) => `${String(i + 1).padStart(2, '0')} · ${g}`).join('\n')}`].filter(Boolean).join('\n\n');
  if (notas) await writeFile(path.join(dir, `${nombre}.txt`), notas + '\n');
  console.log(`Reel listo: ${out} (${duration} s)`);
});
