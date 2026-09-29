// Arma el correo con los archivos adjuntos y lo manda por Resend.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LETTERS = 'ABCD';

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function fechaLarga(fecha) {
  const s = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`));
  return s.replace(',', '');   // "viernes 16 de octubre"
}

export function caption(data) {
  return [
    `Reto de ${data.materia_corta || 'Historia'} #${data.numero}. ¿Cuál sobra? Comenta tu respuesta.`,
    'Las otras 4 rondas están en pasas.mx/arcade (link en la bio).',
    'Mañana te decimos cuántos le atinaron.',
    '',
    '#historia #historiademexico #secundaria #prepa #retodiario',
  ].join('\n');
}

const box = 'background:#f5f3fa;border-radius:10px;padding:12px 14px;margin:8px 0 0;white-space:pre-wrap;font-family:inherit';
const h = 'font-size:16px;margin:24px 0 4px';

export function buildEmail(data, parte) {
  const n = data.numero;
  const dia = fechaLarga(data.fecha);
  if (parte === 'manana') {
    const ex = data.extra;
    return {
      subject: `Reto #${n} · reel y stories para hoy, ${dia}`,
      html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Todo listo para el <b>reto #${n}</b> (${esc(dia)}). Van cinco archivos adjuntos.</p>

<h3 style="${h}">1. Reel · en la mañana, en Instagram y TikTok</h3>
<p>Archivo <b>reel.mp4</b>. Al subirlo, agrégale un sonido que esté en tendencia. Como portada usa <b>reel-portada.png</b>: en Instagram, <i>Editar portada → Agregar desde la galería</i>; en TikTok, <i>Editar portada → Subir</i>. Texto para copiar:</p>
<pre style="${box}">${esc(caption(data))}</pre>

<h3 style="${h}">2. Story · 8:00 AM</h3>
<p>Archivo <b>story-1-aviso.png</b>. Agrega el sticker de <b>link</b> con <b>pasas.mx/arcade</b> en el espacio de abajo, bajo la flecha.</p>

<h3 style="${h}">3. Story · 2:00 PM · Instagram</h3>
<p>Archivo <b>story-2-ronda-extra.png</b>. En el espacio vacío agrega el sticker de <b>quiz</b> y toca la bolita junto a la respuesta correcta para marcarla (se pone verde):</p>
<pre style="${box}">Pregunta: ¿Cuál sobra?
${ex.opciones.map((o, i) => `${LETTERS[i]}. ${esc(o)}${i === ex.sobra ? '   ← correcta' : ''}`).join('\n')}</pre>
${ex.motivo ? `<p style="color:#6b6485;font-size:14px">Por si alguien pregunta: ${esc(ex.motivo)}</p>` : ''}

<h3 style="${h}">4. Story · 2:00 PM · TikTok</h3>
<p>Archivo <b>story-2-ronda-extra-tiktok.png</b>. Ya trae las cuatro opciones y pide responder en los comentarios; no necesita sticker. Súbela como historia o como publicación de foto. Texto para copiar:</p>
<pre style="${box}">¿Cuál sobra? Comenta A, B, C o D 👇
Mañana te decimos cuál era.</pre>
<p style="color:#6b6485;font-size:14px">Mañana responde en los comentarios: la correcta es la <b>${LETTERS[ex.sobra]}</b> (${esc(ex.opciones[ex.sobra])}).</p>

<p style="margin-top:28px;color:#6b6485;font-size:13px">La story de resultados llega en otro correo a las 8:30 PM.</p>
</div>`,
    };
  }
  if (data.sinResultados) {
    return {
      subject: `Reto #${n} · hoy no hay story de resultados`,
      html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Hoy jugaron <b>${data.jugadores}</b> ${data.jugadores === 1 ? 'persona' : 'personas'} el reto #${n}.</p>
<p>Con menos de 20 un porcentaje no dice mucho, así que esta noche no hay story de resultados. En cuanto el reto pase de 20 jugadores al día, llega sola.</p>
</div>`,
    };
  }
  return {
    subject: `Reto #${n} · story de resultados para esta noche`,
    html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<h3 style="${h}">Story · 9:00 PM</h3>
<p>Archivo <b>story-3-resultados.png</b>. En el espacio vacío agrega el sticker de <b>encuesta</b>:</p>
<pre style="${box}">¿Cuántas sacaste?
5 de 5
Me faltó alguna</pre>
<p>Si alguien compartió su resultado y te etiquetó, compártelo también en stories esta noche.</p>
</div>`,
  };
}

export async function sendEmail({ subject, html }, files) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ARCADE_EMAIL_TO;
  const from = process.env.ARCADE_EMAIL_FROM || 'PASAS Arcade <hola@pasas.mx>';
  if (!key) throw new Error('Falta RESEND_API_KEY');
  if (!to) throw new Error('Falta ARCADE_EMAIL_TO (a qué correo mandar los videos)');
  const attachments = await Promise.all(files.map(async f => ({
    filename: path.basename(f),
    content: (await readFile(f)).toString('base64'),
  })));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: to.split(",").map(s => s.trim()), subject, html, attachments: attachments.length ? attachments : undefined }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${JSON.stringify(body)}`);
  return body;
}
