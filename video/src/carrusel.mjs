#!/usr/bin/env node
// Carrusel de "regalo": un tema real de PASAS en láminas 1080×1350 para guardar y compartir.
//   node src/carrusel.mjs --data data/carruseles/ejemplo-pitagoras.json [--salida salida/carruseles]
// Deja una carpeta con 01.png … NN.png y post.txt (texto para la publicación).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, openPage } from './render.mjs';

export const TIPOS = ['portada', 'idea', 'reglas', 'ejemplo', 'lista', 'tematicas', 'reto', 'cierre'];

export function validarCarrusel(d) {
  const e = [];
  if (!d.materia || !d.nivel) e.push('faltan "materia" y "nivel"');
  if (!Array.isArray(d.slides) || d.slides.length < 5 || d.slides.length > 10) e.push('"slides" debe tener entre 5 y 10 láminas');
  (d.slides || []).forEach((s, i) => {
    if (!TIPOS.includes(s.tipo)) e.push(`lámina ${i + 1}: tipo "${s.tipo}" no existe (usa ${TIPOS.join(', ')})`);
    (s.titulo || []).forEach(l => { if (l.length > 18) e.push(`lámina ${i + 1}: "${l}" es muy larga para el título (máx. 18)`); });
    const todo = JSON.stringify(s);
    if (/\?/.test(todo) && !/¿/.test(todo)) e.push(`lámina ${i + 1}: hay una pregunta sin "¿"`);
  });
  if (d.slides?.[0]?.tipo !== 'portada') e.push('la primera lámina debe ser la portada');
  if (d.slides?.at(-1)?.tipo !== 'cierre') e.push('la última lámina debe ser el cierre');
  return e;
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

export async function renderCarrusel(browser, d, dir) {
  await mkdir(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < d.slides.length; i++) {
    const page = await openPage(browser, 'carrusel.html', { width: 1080, height: 1350 });
    await page.evaluate(([x, k]) => window.setup(x, k), [d, i]);
    await page.evaluate(() => window.ready || null);
    const f = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: f, type: 'png' });
    await page.close();
    files.push(f);
  }
  if (d.post) await writeFile(path.join(dir, 'post.txt'), d.post + '\n');
  return files;
}

async function main() {
  const { values: a } = parseArgs({ options: { data: { type: 'string' }, salida: { type: 'string', default: 'salida/carruseles' } } });
  if (!a.data) throw new Error('Falta --data archivo.json');
  const d = JSON.parse(await readFile(a.data, 'utf8'));
  const errores = validarCarrusel(d);
  if (errores.length) throw new Error('El carrusel no se generó:\n  - ' + errores.join('\n  - '));
  const dir = path.resolve(a.salida, slug(d.nombre || d.slides[0].titulo.join(' ')));
  const files = await withBrowser(b => renderCarrusel(b, d, dir));
  console.log(`Carrusel listo (${files.length} láminas): ${dir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
