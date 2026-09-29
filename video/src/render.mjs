// Genera el reel (MP4) y los fondos de story (PNG) a partir de los datos de un reto.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const FPS = 30;
const SIZE = { width: 1080, height: 1920 };

async function openPage(browser, template) {
  const page = await browser.newPage({ viewport: SIZE });
  await page.goto(pathToFileURL(path.join(TEMPLATES, template)).href);
  // El navegador solo descarga una fuente cuando algo visible la usa; aquí se fuerzan las seis.
  const fonts = await page.evaluate(async () => {
    const faces = ['400 10px Nunito', '700 10px Nunito', '800 10px Nunito', '900 10px Nunito', '700 10px Orbitron', '900 10px Orbitron'];
    const loaded = await Promise.all(faces.map(f => document.fonts.load(f)));
    return loaded.filter(list => list.length > 0).length;
  });
  if (fonts < 6) throw new Error(`Solo cargaron ${fonts} de 6 tipografías en ${template}; el video saldría con letra de sistema.`);
  return page;
}

function ffmpeg(out) {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    // pista de audio en silencio: algunas apps rechazan videos sin audio
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out,
  ];
  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg terminó con código ${code}`))));
  });
  return { proc, done };
}

// Cualquier plantilla que exponga window.setup(data) → segundos y window.render(t).
export async function renderVideo(browser, template, data, out, { log = () => {} } = {}) {
  const page = await openPage(browser, template);
  const duration = await page.evaluate(d => window.setup(d), data);
  // Plantillas con imágenes (Pasita) exponen window.ready: se espera a que carguen.
  await page.evaluate(() => window.ready || null);
  await page.evaluate(() => document.fonts.load('400 10px Anton'));
  const frames = Math.round(duration * FPS);
  const { proc, done } = ffmpeg(out);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!proc.stdin.write(png)) await new Promise(r => proc.stdin.once('drain', r));
    if (i % 60 === 0) log(`  ${template} ${Math.round((i / frames) * 100)}%`);
  }
  proc.stdin.end();
  await done;
  await page.close();
  return { out, duration };
}

// Un PNG por pantalla, para aprobar el texto antes de generar el video completo.
// La plantilla expone window.momentos() → segundos a capturar.
export async function renderFrames(browser, template, data, prefix) {
  const page = await openPage(browser, template);
  await page.evaluate(d => window.setup(d), data);
  await page.evaluate(() => window.ready || null);
  await page.evaluate(() => document.fonts.load('400 10px Anton'));
  const ts = await page.evaluate(() => (window.momentos ? window.momentos() : [0]));
  const files = [];
  for (const [i, t] of ts.entries()) {
    await page.evaluate(x => window.render(x), t);
    const f = `${prefix}-${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: f, type: 'png' });
    files.push(f);
  }
  await page.close();
  return files;
}

export function renderReel(browser, data, out, opts) {
  return renderVideo(browser, 'reel.html', data, out, opts);
}

export async function renderStory(browser, data, variant, out) {
  const page = await openPage(browser, 'story.html');
  await page.evaluate(([d, v]) => window.setup(d, v), [data, variant]);
  await page.screenshot({ path: out, type: 'png' });
  await page.close();
  return { out };
}

export async function withBrowser(fn) {
  const browser = await chromium.launch();
  try { return await fn(browser); } finally { await browser.close(); }
}
