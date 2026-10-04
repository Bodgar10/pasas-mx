#!/usr/bin/env node
// Carrusel de "regalo": un tema real de PASAS en láminas 1080×1350 para guardar y compartir.
//   node src/carrusel.mjs --data data/carruseles/ejemplo-pitagoras.json [--salida salida/carruseles]
// Deja una carpeta con 01.png … NN.png y post.txt (texto para la publicación).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, openPage, renderVideo } from './render.mjs';
import { spawnSync } from 'node:child_process';
import { sendEmail } from './email.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { ARTE, slugCarrusel } from './ilustrar.mjs';

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
  // Si existe la ilustración de una lámina (video/arte/<carrusel>/NN.jpg), va de fondo
  const arte = path.join(ARTE, slugCarrusel(d));
  d = { ...d, slides: d.slides.map((s, i) => {
    const f = path.join(arte, `${String(i + 1).padStart(2, '0')}.jpg`);
    if (!existsSync(f)) return s;
    // Lámina completa hecha por OpenAI (con sus textos): va tal cual
    if ((d.arte?.modo || 'completa') === 'completa') return { ...s, lamina_img: `../arte/${slugCarrusel(d)}/${path.basename(f)}` };
    return { ...s, fondo_img: `../arte/${slugCarrusel(d)}/${path.basename(f)}` };
  }) };
  for (let i = 0; i < d.slides.length; i++) {
    const page = await openPage(browser, 'carrusel.html', { width: 1080, height: 1350 });
    await page.evaluate(([x, k]) => window.setup(x, k), [d, i]);
    if (d.slides[i].lamina_img) await page.evaluate(src => new Promise(ok => {
      document.body.innerHTML = '<img id="L" style="position:fixed;inset:0;width:1080px;height:1350px;object-fit:cover">';
      const im = document.getElementById('L'); im.onload = im.onerror = ok; im.src = src;
    }), d.slides[i].lamina_img);
    await page.evaluate(() => window.ready || null);
    const f = path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
    await page.close();
    files.push(f);
  }
  if (d.post) await writeFile(path.join(dir, 'post.txt'), d.post + '\n');
  return files;
}

// Reel (descubrir) del mismo tema: fondos de OpenAI + texto animado. Deja reel.mp4 y reel-portada.jpg
export async function renderReel(browser, d, dir, log = () => {}) {
  if (!d.reel?.escenas?.length) return [];
  await mkdir(dir, { recursive: true });
  const slugC = slugCarrusel(d);
  const fondos = d.reel.escenas.map((_, i) => {
    const f = path.join(ARTE, slugC, `reel-${String(i + 1).padStart(2, '0')}.jpg`);
    return existsSync(f) ? `../arte/${slugC}/${path.basename(f)}` : null;
  });
  const out = path.join(dir, 'reel.mp4');
  const { duration } = await renderVideo(browser, 'reel-ilustrado.html', { ...d, reel_fondos: fondos }, out, { log });
  // Portada: el momento de la revelación (escena "formula") o la primera escena
  let t = 1.6, acc = 0;
  for (const e of d.reel.escenas) { if (e.tipo === 'formula') { t = acc + (e.dur || 3.5) - 0.4; break; } acc += e.dur || 3.5; }
  const portada = path.join(dir, 'reel-portada.jpg');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(t, duration - 0.2)), '-i', out, '-frames:v', '1', '-q:v', '2', portada]);
  if (d.reel.post) await writeFile(path.join(dir, 'reel.txt'), d.reel.post + '\n');
  return [out, portada];
}

// Láminas cuya ilustración falló (estado.json de ilustrar.mjs), para avisar en el correo
function sinIlustrar(d) {
  try {
    const e = JSON.parse(readFileSync(path.join(ARTE, slugCarrusel(d), 'estado.json'), 'utf8'));
    return Object.entries(e).filter(([, v]) => !v.ok).map(([k, v]) => `${k.startsWith('reel') ? 'fondo ' + k : 'lámina ' + Number(k)} (${v.error})`);
  } catch { return []; }
}

function correo(d, n, conReel) {
  const fallas = sinIlustrar(d);
  const titulo = d.slides[0].titulo.join(' ') + (d.hobby ? ` con ${d.hobby.nombre}` : '');
  const e = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return {
    subject: `${conReel ? 'Reel + carrusel' : 'Carrusel'} · ${titulo} (${d.materia}, ${d.nivel})`,
    html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
${conReel ? `<h3 style="font-size:16px;margin:8px 0 4px">1. Reel · me descubre</h3>
<p>Archivo <b>reel.mp4</b> (con <b>reel-portada.jpg</b> de portada: en Instagram, <i>Editar portada → Agregar desde la galería</i>; en TikTok, <i>Editar portada → Subir</i>). Va sin audio: agrégale una canción en tendencia. Publícalo primero; el carrusel unas horas después. Texto para copiar:</p>
<pre style="background:#f5f3fa;border-radius:10px;padding:12px 14px;white-space:pre-wrap;font-family:inherit">${e(d.reel.post || '')}</pre>
<h3 style="font-size:16px;margin:20px 0 4px">2. Carrusel · me enseña y lo guardo</h3>` : ''}
<p>Carrusel listo: <b>${e(titulo)}</b>. Van ${n} láminas en orden (01, 02…).</p>
<p>Súbelas como <b>carrusel</b> en Instagram (máximo 20 fotos) y en TikTok en <b>modo foto</b>, con una canción en tendencia. Texto para copiar:</p>
<pre style="background:#f5f3fa;border-radius:10px;padding:12px 14px;white-space:pre-wrap;font-family:inherit">${e(d.post || '')}</pre>
${fallas.length ? `<p style="color:#b45309;font-size:14px">Estas láminas salieron sin ilustración porque falló OpenAI: ${e(fallas.join('; '))}. Se pueden rehacer en GitHub → Actions → "Carruseles de PASAS" → Run workflow, con "solo" = esos números.</p>` : ''}
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
    const [files, reel] = await withBrowser(async b => [await renderCarrusel(b, d, dir), await renderReel(b, d, dir, m => console.log(m))]);
    console.log(`Carrusel listo (${files.length} láminas)${reel.length ? ' + reel' : ''}: ${dir}`);
    if (a.enviar) {
      const r = await sendEmail(correo(d, files.length, reel.length > 0), [...reel, ...files]);
      console.log(`  correo enviado (${r.id})`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
