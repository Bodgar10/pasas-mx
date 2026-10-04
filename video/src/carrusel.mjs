#!/usr/bin/env node
// Carrusel de "regalo": un tema real de PASAS en láminas 1080×1350 para guardar y compartir.
//   node src/carrusel.mjs --data data/carruseles/ejemplo-pitagoras.json [--salida salida/carruseles]
// Deja una carpeta con 01.png … NN.png y post.txt (texto para la publicación).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, openPage } from './render.mjs';
import { sendEmail } from './email.mjs';

export const TIPOS = ['portada', 'idea', 'escena', 'mapa', 'reglas', 'ejemplo', 'lista', 'tematicas', 'reto', 'cierre', 'chuleta'];

export function validarCarrusel(d) {
  const e = [];
  if (!d.materia || !d.nivel) e.push('faltan "materia" y "nivel"');
  if (!Array.isArray(d.slides) || d.slides.length < 5 || d.slides.length > 10) e.push('"slides" debe tener entre 5 y 10 láminas');
  (d.slides || []).forEach((s, i) => {
    if (!TIPOS.includes(s.tipo)) e.push(`lámina ${i + 1}: tipo "${s.tipo}" no existe (usa ${TIPOS.join(', ')})`);
    (s.titulo || []).forEach(l => { if (l.length > 18) e.push(`lámina ${i + 1}: "${l}" es muy larga para el título (máx. 18)`); });
    const todo = JSON.stringify({ ...s, svg: undefined });
    if (/\?/.test(todo) && !/¿/.test(todo)) e.push(`lámina ${i + 1}: hay una pregunta sin "¿"`);
  });
  if (d.slides?.[0]?.tipo !== 'portada') e.push('la primera lámina debe ser la portada');
  const ultima = d.slides?.at(-1)?.tipo;
  if (d.hobby) {
    // Fórmula PASAS: la última lámina es la chuleta, la que vale la pena guardar
    if (ultima !== 'chuleta') e.push('la última lámina debe ser la chuleta (lo que se guarda para el examen)');
    const reto = d.slides?.find(s => s.tipo === 'reto');
    if (reto && !d.slides.at(-1)?.respuesta_reto) e.push('la chuleta debe traer "respuesta_reto"');
    if (d.slides?.[5]?.tipo !== 'mapa') e.push('la lámina 6 debe ser el reveal (tipo "mapa"): lo del hobby → su nombre real');
  } else if (ultima !== 'cierre' && ultima !== 'chuleta') e.push('la última lámina debe ser el cierre o la chuleta');
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

function correo(d, n) {
  const titulo = d.slides[0].titulo.join(' ') + (d.hobby ? ` con ${d.hobby.nombre}` : '');
  const e = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return {
    subject: `Carrusel · ${titulo} (${d.materia}, ${d.nivel})`,
    html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Carrusel listo: <b>${e(titulo)}</b>. Van ${n} láminas en orden (01, 02…).</p>
<p>Súbelas como <b>carrusel</b> en Instagram (máximo 20 fotos) y en TikTok en <b>modo foto</b>, con una canción en tendencia. Texto para copiar:</p>
<pre style="background:#f5f3fa;border-radius:10px;padding:12px 14px;white-space:pre-wrap;font-family:inherit">${e(d.post || '')}</pre>
<p style="color:#6b6485;font-size:14px">Al día siguiente, responde en los comentarios con la respuesta del reto (está en la última lámina).</p>
</div>`,
  };
}

async function main() {
  const { values: a } = parseArgs({ options: {
    data: { type: 'string', multiple: true }, salida: { type: 'string', default: 'salida/carruseles' }, enviar: { type: 'boolean', default: false },
  } });
  if (!a.data?.length) throw new Error('Falta --data archivo.json (se puede repetir)');
  for (const file of a.data) {
    const d = JSON.parse(await readFile(file, 'utf8'));
    const errores = validarCarrusel(d);
    if (errores.length) throw new Error(`${file}: el carrusel no se generó:\n  - ` + errores.join('\n  - '));
    const dir = path.resolve(a.salida, slug(d.nombre || d.slides[0].titulo.join(' ')));
    const files = await withBrowser(b => renderCarrusel(b, d, dir));
    console.log(`Carrusel listo (${files.length} láminas): ${dir}`);
    if (a.enviar) {
      const r = await sendEmail(correo(d, files.length), files);
      console.log(`  correo enviado (${r.id})`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
