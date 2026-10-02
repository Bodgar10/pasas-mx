#!/usr/bin/env node
// "Así funciona PASAS": demo de producto para papás (anuncio pagado y para mandar a maestros).
//   node src/como-funciona.mjs              → salida/como-funciona/asi-funciona-pasas.mp4
//   node src/como-funciona.mjs --revisar    → un PNG por paso
// Las pantallas están recreadas del código real en templates/como-funciona.html.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames } from './render.mjs';

const { values: a } = parseArgs({ options: { salida: { type: 'string', default: 'salida/como-funciona' }, revisar: { type: 'boolean', default: false } } });
const dir = path.resolve(a.salida);
await mkdir(dir, { recursive: true });
await withBrowser(async b => {
  if (a.revisar) {
    const files = await renderFrames(b, 'como-funciona.html', {}, path.join(dir, 'asi-funciona'));
    console.log(files.join('\n'));
    return;
  }
  const out = path.join(dir, 'asi-funciona-pasas.mp4');
  const { duration } = await renderVideo(b, 'como-funciona.html', {}, out, { log: m => console.log(m) });
  console.log(`Video listo: ${out} (${duration} s)`);
});
