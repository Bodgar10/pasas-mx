// Arma el correo y lo manda por Resend (archivos en Google Drive o, de respaldo, adjuntos).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MIN_JUGADORES } from './data.mjs';
import { driveConfigurado, subirADrive, conEnlaces } from './drive.mjs';

const LETTERS = 'ABCD';

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function fechaLarga(fecha) {
  const s = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`));
  return s.replace(',', '');   // "viernes 16 de octubre"
}

// Hashtags por materia (los mismos que TEMAS_RETO en templates/materias.js)
const TAGS = {
  historia: '#historia #historiademexico #secundaria #prepa #retodiario',
  biologia: '#biologia #ciencia #secundaria #prepa #retodiario',
  geografia: '#geografia #mapas #secundaria #prepa #retodiario',
  ciencias: '#quimica #fisica #ciencia #secundaria #prepa #retodiario',
  espanol: '#espanol #ortografia #lectura #secundaria #prepa #retodiario',
  papas: '#papas #mamas #secundaria #tareas #retodiario',
};

// "Viernes de Español" · "Reto para papás"
export function tituloDelDia(data) {
  if (data.materia_key === 'papas') return 'Reto para papás';
  const dia = fechaLarga(data.fecha).split(' ')[0];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} de ${data.materia_corta || 'Historia'}`;
}

function etiqueta(data) {
  return data.materia_key === 'papas' ? `Reto para papás #${data.numero}` : `${tituloDelDia(data)} · reto #${data.numero}`;
}

export function caption(data) {
  const papas = data.materia_key === 'papas';
  // s48: "Verdadero o mentira", el reto que sale en pasas.mx/arcade.
  if (data.juego === 'vom') {
    return [
      papas
        ? `Reto para papás #${data.numero}. ¿Verdad o mentira? Comenta tu respuesta.`
        : `${tituloDelDia(data)} · reto #${data.numero}. ¿Verdad o mentira? Comenta tu respuesta.`,
      papas
        ? 'Las otras 4 frases, una de cada materia, están en pasas.mx/arcade (link en la bio). Juégalo con tus hijos.'
        : 'Las otras 4 frases están en pasas.mx/arcade (link en la bio).',
      'Mañana te decimos si era verdad o mentira.',
      '',
      TAGS[data.materia_key] || TAGS.historia,
    ].join('\n');
  }
  return [
    papas
      ? `Reto para papás #${data.numero}. ¿Sabes más que un alumno de secundaria? ¿Cuál sobra? Comenta tu respuesta.`
      : `${tituloDelDia(data)} · reto #${data.numero}. ¿Cuál sobra? Comenta tu respuesta.`,
    papas
      ? 'Las otras 4 rondas, una de cada materia, están en pasas.mx/arcade (link en la bio). Juégalo con tus hijos.'
      : 'Las otras 4 rondas están en pasas.mx/arcade (link en la bio).',
    'Mañana te decimos cuántos le atinaron.',
    '',
    TAGS[data.materia_key] || TAGS.historia,
  ].join('\n');
}

const box = 'background:#f5f3fa;border-radius:10px;padding:12px 14px;margin:8px 0 0;white-space:pre-wrap;font-family:inherit';
const h = 'font-size:16px;margin:24px 0 4px';

export function buildEmail(data, parte) {
  const n = data.numero;
  const dia = fechaLarga(data.fecha);
  if (parte === 'manana' && data.juego === 'vom') {
    const ex = data.extra;
    const resp = ex.verdad ? 'Verdad' : 'Mentira';
    return {
      subject: `${etiqueta(data)} · reel y stories para hoy, ${dia}`,
      html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Todo listo para el <b>reto #${n}</b>, ${esc(tituloDelDia(data).replace(/^R/, 'r'))} (${esc(dia)}). Hoy el juego es <b>¿Verdadero o mentira?</b>, el mismo que sale en pasas.mx/arcade. Van cinco archivos adjuntos.</p>

<h3 style="${h}">1. Reel · en la mañana, en Instagram y TikTok</h3>
<p>Archivo <b>reel.mp4</b>. Al subirlo, agrégale un sonido que esté en tendencia. Como portada usa <b>reel-portada.png</b>: en Instagram, <i>Editar portada → Agregar desde la galería</i>; en TikTok, <i>Editar portada → Subir</i>. Texto para copiar:</p>
<pre style="${box}">${esc(caption(data))}</pre>
<p style="color:#6b6485;font-size:14px">La frase del reel es <b>${data.hoy.verdad ? 'verdad' : 'mentira'}</b>. Mañana la respuesta sale al inicio del reel.</p>

<h3 style="${h}">2. Story · 8:00 AM</h3>
<p>Archivo <b>story-1-aviso.png</b>. Agrega el sticker de <b>link</b> con <b>pasas.mx/arcade</b> en el espacio de abajo, bajo la flecha.</p>

<h3 style="${h}">3. Story · 2:00 PM · Instagram</h3>
<p>Archivo <b>story-2-ronda-extra.png</b>. En el espacio vacío agrega el sticker de <b>quiz</b> con dos opciones y marca la correcta (se pone verde):</p>
<pre style="${box}">Pregunta: ¿Verdad o mentira?
Verdad${ex.verdad ? '   ← correcta' : ''}
Mentira${ex.verdad ? '' : '   ← correcta'}</pre>
<p style="color:#6b6485;font-size:14px">Por si alguien pregunta: ${esc(ex.motivo)}</p>

<h3 style="${h}">4. Story · 2:00 PM · TikTok</h3>
<p>Archivo <b>story-2-ronda-extra-tiktok.png</b>. Ya trae la frase y pide responder en los comentarios; no necesita sticker. Texto para copiar:</p>
<pre style="${box}">¿Verdad o mentira? Comenta 👇
Mañana te decimos.</pre>
<p style="color:#6b6485;font-size:14px">Mañana responde en los comentarios: es <b>${resp}</b>. ${esc(ex.motivo)}</p>

<p style="margin-top:28px;color:#6b6485;font-size:13px">La story de resultados llega en otro correo a las 8:30 PM.</p>
</div>`,
    };
  }
  if (parte === 'manana') {
    const ex = data.extra;
    return {
      subject: `${etiqueta(data)} · reel y stories para hoy, ${dia}`,
      html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Todo listo para el <b>reto #${n}</b>, ${esc(tituloDelDia(data).replace(/^R/, 'r'))} (${esc(dia)}). Van cinco archivos adjuntos.</p>

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
<p>Con menos de ${MIN_JUGADORES} un porcentaje no dice mucho, así que esta noche no hay story de resultados. En cuanto el reto llegue a ${MIN_JUGADORES} jugadores al día, llega sola.</p>
</div>`,
    };
  }
  return {
    subject: `${etiqueta(data)} · story de resultados para esta noche`,
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

// Manda el correo por Resend. Si Google Drive está configurado (GDRIVE_*), los archivos se
// suben a Drive y el correo lleva enlaces en lugar de adjuntos; si Drive falla o no está
// configurado, se adjuntan como antes para que el correo nunca deje de llegar.
export async function sendEmail({ subject, html }, files, opts = {}) {
  const key = process.env.RESEND_API_KEY;
  const to = opts.to || process.env.ARCADE_EMAIL_TO;
  const from = opts.from || process.env.ARCADE_EMAIL_FROM || 'PASAS Arcade <hola@pasas.mx>';
  if (!key) throw new Error('Falta RESEND_API_KEY');
  if (!to) throw new Error(opts.faltaTo || 'Falta ARCADE_EMAIL_TO (a qué correo mandar los videos)');
  if (files.length && driveConfigurado()) {
    try {
      const subida = await subirADrive(files, subject);
      console.log(`  ${files.length} archivo(s) en Google Drive: ${subida.carpeta}`);
      html = conEnlaces(html, subida);
      files = [];
    } catch (e) {
      console.warn(`  aviso: no se pudo subir a Google Drive (${e.message}); van como adjuntos`);
      html += `<p style="color:#b45309;font-size:13px;font-family:system-ui,sans-serif">Esta vez los archivos van adjuntos porque no se pudieron subir a Google Drive: ${String(e.message).replace(/[&<>"]/g, '')}</p>`;
    }
  }
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
