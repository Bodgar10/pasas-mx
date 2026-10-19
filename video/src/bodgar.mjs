#!/usr/bin/env node
// Videos diarios de bodgar.dev (plataformas en español, apps en inglés). Guía: video/BODGAR.md
//   node src/bodgar.mjs                       → video de hoy (hora de México), sin voz, en salida/bodgar/
//   node src/bodgar.mjs --fecha 2026-10-20    → el de otra fecha
//   node src/bodgar.mjs --data data/bodgar/2026-10-20.json --revisar   → un PNG por escena para aprobar
//   node src/bodgar.mjs --enviar              → además lo manda por correo (Resend)
// Sale sin voz y con pista de audio en silencio. Los tiempos de cada escena y su texto de voz
// van dentro del MP4 (metadato "comment") para que tools/ponvoz.py le ponga la voz en la Mac.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'data', 'bodgar');
const PLANTILLAS = path.join(RAIZ, 'templates', 'bodgar');
const FPS = 30;
const LETRAS_POR_SEG = 15.5;   // ritmo de una voz es-MX a velocidad normal, con margen
const RESPIRO = 0.5, FINAL = 1.8, MINIMO = 2.2;

const { values: a } = parseArgs({ options: {
  fecha: { type: 'string' }, data: { type: 'string' }, salida: { type: 'string', default: 'salida/bodgar' },
  revisar: { type: 'boolean', default: false }, enviar: { type: 'boolean', default: false },
} });

const hoyMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const fechaLarga = f => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(`${f}T12:00:00Z`)).replace(',', '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Cuánto dura cada escena: lo que tarda en decirse su texto + un respiro. La última, un poco más.
export function duraciones(escenas) {
  return escenas.map((e, i) => Math.max(MINIMO, e.voz.length / LETRAS_POR_SEG) + RESPIRO + (i === escenas.length - 1 ? FINAL : 0));
}

async function programados(desde) {
  const fs = (await readdir(DATOS)).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  return fs.filter(f => f.slice(0, 10) >= desde);
}

function ffmpeg(out, dur, meta) {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-metadata', `comment=${meta}`, '-movflags', '+faststart+use_metadata_tags', out];
  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, mal) => { proc.on('error', mal); proc.on('close', c => c === 0 ? ok() : mal(new Error('ffmpeg ' + c))); });
  return { proc, done };
}

async function abrir(browser, plantilla, ids, durs) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const f = path.join(PLANTILLAS, plantilla);
  if (!existsSync(f)) throw new Error(`No existe la plantilla ${plantilla} en templates/bodgar/`);
  await page.goto(pathToFileURL(f).href);
  const n = await page.evaluate(async () => {
    await document.fonts.ready;
    const l = await Promise.all(['800 10px B', '600 10px I', '700 10px I', '600 10px M'].map(x => document.fonts.load(x)));
    return l.filter(x => x.length).length;
  });
  if (n < 4) throw new Error(`Solo cargaron ${n} de 4 tipografías en ${plantilla}; saldría con letra de sistema.`);
  const total = await page.evaluate(d => window.setup(d), { ids, durs });
  return { page, total };
}

// Portada y story: plantillas fijas que se llenan con g.portada / g.story.
async function imagen(browser, plantilla, g, out) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(path.join(PLANTILLAS, plantilla)).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(['800 10px B', '600 10px I', '600 10px M'].map(x => document.fonts.load(x))); });
  await page.evaluate(d => window.setup(d), g);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await page.close();
  return out;
}

export async function generar(g, dir, { revisar = false } = {}) {
  const ids = g.escenas.map(e => e.id), durs = duraciones(g.escenas);
  const base = `${g.fecha}-${g.nombre}`;
  const browser = await chromium.launch();
  try {
    const { page, total } = await abrir(browser, g.plantilla, ids, durs);
    const clip = { x: 0, y: 0, width: 1080, height: 1920 };
    const ts = await page.evaluate(() => window.momentos());
    const portada = path.join(dir, `${base}-portada.png`), story = path.join(dir, `${base}-story.png`);
    if (g.portada) await imagen(browser, 'portada.html', g, portada);
    else { await page.evaluate(x => window.render(x), ts[0]); await page.screenshot({ path: portada, clip }); }
    await imagen(browser, 'story.html', g, story);
    if (revisar) {
      const files = [portada, story];
      for (const [i, t] of ts.entries()) {
        await page.evaluate(x => window.render(x), t);
        const f = path.join(dir, `${base}-revisar-${String(i + 1).padStart(2, '0')}-${ids[i]}.png`);
        await page.screenshot({ path: f, clip }); files.push(f);
      }
      return { files };
    }
    // Tiempos de cada escena, para la voz.
    let t0 = 0;
    const voz = { v: 1, fecha: g.fecha, idioma: g.idioma || 'es-MX', escenas: g.escenas.map((e, i) => { const r = { id: e.id, ini: +t0.toFixed(3), dur: +durs[i].toFixed(3), voz: e.voz }; t0 += durs[i]; return r; }) };
    const video = path.join(dir, `${base}.mp4`);
    const { proc, done } = ffmpeg(video, total, JSON.stringify(voz));
    const n = Math.round(total * FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate(x => window.render(x), i / FPS);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 95, clip });
      if (!proc.stdin.write(jpg)) await new Promise(r => proc.stdin.once('drain', r));
      if (i % 300 === 0) console.log(`  ${Math.round(100 * i / n)}%`);
    }
    proc.stdin.end(); await done;
    await writeFile(path.join(dir, `${base}.voz.json`), JSON.stringify(voz, null, 1));
    return { video, portada, story, total, voz };
  } finally { await browser.close(); }
}

function correo(g, r, quedan) {
  const guion = g.escenas.map((e, i) => `${String(i + 1).padStart(2, '0')}. ${e.voz}`).join('\n');
  const box = 'background:#F4F1EA;border-radius:10px;padding:12px 14px;margin:8px 0 0;white-space:pre-wrap;font-family:inherit';
  const mono = box + ';font-family:ui-monospace,Menlo,monospace;font-size:14px';
  const h = 'font-size:17px;margin:26px 0 6px';
  const mp4 = path.basename(r.video), conVoz = path.basename(r.video, '.mp4') + '-voz.mp4';
  const voz = (g.idioma || 'es-MX').startsWith('en') ? ' --voz en-US-GuyNeural' : '';
  const aviso = quedan <= 3 ? `<p style="color:#B35D3A;margin-top:26px"><b>Quedan ${quedan} videos programados.</b> Pide en el chat el lote de la siguiente semana.</p>` : `<p style="color:#8A9893;margin-top:26px">Quedan ${quedan} videos programados.</p>`;
  return {
    subject: `Video de hoy · ${fechaLarga(g.fecha)} · ${g.linea}`,
    html: `<div style="font-family:system-ui,sans-serif;color:#1F332E;max-width:580px;line-height:1.5">
<p>Todo listo para hoy, <b>${esc(fechaLarga(g.fecha))}</b>: <b>${esc(g.linea)}</b>. Van tres archivos adjuntos:</p>
<ul style="padding-left:20px;margin:6px 0">
<li><b>${esc(mp4)}</b>: el reel, <b>sin voz</b> (${Math.round(r.total)} s).</li>
<li><b>${esc(path.basename(r.portada))}</b>: la portada del reel.</li>
<li><b>${esc(path.basename(r.story))}</b>: la story del día.</li>
</ul>
<h3 style="${h}">1. Ponle la voz (Mac)</h3>
<p>Guarda <b>${esc(mp4)}</b> en la carpeta <b>Películas → bodgar-videos</b> (Movies/bodgar-videos). Abre la Terminal y pega:</p>
<pre style="${mono}">cd ~/Movies/bodgar-videos
python3 ponvoz.py${voz}</pre>
<p>Al terminar dice <i>✓ Listo</i> y en la carpeta aparece <b>${esc(conVoz)}</b>. Ése es el que se publica.</p>
<h3 style="${h}">2. Publica el reel a las 12:30 PM (Instagram y TikTok)</h3>
<p>Sube <b>${esc(conVoz)}</b>. En Instagram: <i>Editar portada → Agregar de la galería</i> y elige <b>${esc(path.basename(r.portada))}</b>. Descripción para copiar:</p>
<pre style="${box}">${esc(g.post)}</pre>
<h3 style="${h}">3. Sube la story después del reel</h3>
<p>Sube <b>${esc(path.basename(r.story))}</b> y pon el sticker de <b>enlace</b> en el espacio libre de abajo, con esta dirección:</p>
<pre style="${mono}">https://${esc(g.url)}</pre>
<h3 style="${h}">Guion de voz (por si prefieres grabarla tú)</h3>
<pre style="${box}">${esc(guion)}</pre>
${aviso}
</div>`,
  };
}

async function mandar({ subject, html }, files) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.BODGAR_EMAIL_TO || process.env.ARCADE_EMAIL_TO;
  const from = process.env.BODGAR_EMAIL_FROM || 'Videos bodgar.dev <hola@pasas.mx>';
  if (!key) throw new Error('Falta RESEND_API_KEY');
  if (!to) throw new Error('Falta BODGAR_EMAIL_TO');
  const attachments = await Promise.all(files.map(async f => ({ filename: path.basename(f), content: (await readFile(f)).toString('base64') })));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: to.split(',').map(s => s.trim()), subject, html, attachments: attachments.length ? attachments : undefined }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// Solo corre como programa, no cuando otro script lo importa.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fecha = a.fecha || hoyMx();
  const archivo = a.data ? path.resolve(a.data) : path.join(DATOS, `${fecha}.json`);
  const dir = path.resolve(a.salida); await mkdir(dir, { recursive: true });
  if (!existsSync(archivo)) {
    const quedan = (await programados(fecha)).length;
    console.log(`No hay video programado para ${fecha} (${archivo}). Quedan ${quedan}.`);
    const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    if (a.enviar && dia >= 1 && dia <= 5) await mandar({ subject: `Sin video para hoy · ${fechaLarga(fecha)}`,
      html: `<p style="font-family:system-ui,sans-serif">No hay video programado para hoy (${esc(fechaLarga(fecha))}). Quedan ${quedan}. Pide en el chat el lote de la siguiente semana.</p>` }, []);
    process.exit(0);
  }
  const g = JSON.parse(await readFile(archivo, 'utf8'));
  for (const k of ['fecha', 'plantilla', 'nombre', 'linea', 'post', 'escenas']) if (!g[k]) throw new Error(`Al JSON le falta "${k}"`);
  const t = Date.now();
  if (a.revisar) { const { files } = await generar(g, dir, { revisar: true }); console.log(files.join('\n')); process.exit(0); }
  const r = await generar(g, dir);
  console.log(`Video listo: ${r.video} (${r.total.toFixed(1)} s, ${Math.round((Date.now() - t) / 1000)} s de render)`);
  if (a.enviar) {
    const quedan = (await programados(fecha)).length - 1;
    const res = await mandar(correo(g, r, quedan), [r.video, r.portada, r.story]);
    console.log('Correo enviado', res.id || '');
  }
}
