// Manda un correo por video (con su texto para TikTok e Instagram) por Resend.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(await readFile(path.join(dir, 'envio.json'), 'utf8'));
const key = process.env.RESEND_API_KEY;
if (!key) throw new Error('Falta RESEND_API_KEY');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const box = 'background:#f5f3fa;border-radius:10px;padding:12px 14px;margin:8px 0 0;white-space:pre-wrap;font-family:inherit';
const h = 'font-size:16px;margin:24px 0 4px';
const n = cfg.videos.length;
const resultados = [];

for (const [i, v] of cfg.videos.entries()) {
  const html = `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Hola, Katya. Este es el <b>short ${i + 1} de ${n}</b> del video de Yolanda <i>"Mi hijo no puede soltar el control"</i>. El video va adjunto (<b>${esc(v.file)}</b>), listo para subir en vertical.</p>
<p style="color:#6b6485;font-size:14px">Ya trae subtítulos, portada al inicio y el cierre "Mira el video completo en YouTube". Al subirlo, elige el primer cuadro como portada. Video completo: <a href="${cfg.youtube}">${cfg.youtube}</a> (conviene ponerlo en la bio, porque en TikTok e Instagram los links de la descripción no se pueden tocar).</p>
<h3 style="${h}">Texto para TikTok</h3>
<pre style="${box}">${esc(v.tiktok)}</pre>
<h3 style="${h}">Texto para Instagram (Reels)</h3>
<pre style="${box}">${esc(v.instagram)}</pre>
</div>`;
  const content = (await readFile(path.join(dir, v.file))).toString('base64');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to: [cfg.to], subject: `Short ${i + 1}/${n} · ${v.titulo}`, html,
      attachments: [{ filename: v.file, content }] }),
  });
  const body = await res.json().catch(() => ({}));
  resultados.push({ file: v.file, ok: res.ok, status: res.status, body });
  console.log(v.file, res.status, JSON.stringify(body));
  await new Promise(r => setTimeout(r, 1500));
}
await writeFile(path.join(dir, 'resultado.json'), JSON.stringify(resultados, null, 2));
if (resultados.some(r => !r.ok)) process.exitCode = 1;
