#!/usr/bin/env node
// Historias (martes y jueves) y efemérides (fechas icónicas): un reel de 25-35 s que cuenta
// la historia real detrás de un tema del temario, con escenas dibujadas por OpenAI (sin texto)
// y el texto animado encima (templates/historia.html, el formato del video del 2 de octubre).
// Guía: video/HISTORIAS.md.
//
//   node src/historia.mjs --data data/historias/2026-10-12-colon.json [--revisar] [--enviar]
//
// Fondos: workflow "Historias de PASAS" (ilustrar.mjs --solo r) → video/arte/<historia>/reel-NN.jpg.
// Sin fondos, cada escena sale con el fondo de respaldo: sirve para revisar textos sin pagar.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderFrames, renderVideo, renderImage } from './render.mjs';
import { sendEmail } from './email.mjs';
import { ARTE, slugCarrusel } from './ilustrar.mjs';

export function validarHistoria(d) {
  const e = [], E = d.reel?.escenas || [];
  const plano = x => String(x || '').replace(/\*\*|\[\[|\]\]/g, '');
  if (!d.nombre || !d.materia || !d.nivel) e.push('faltan "nombre", "materia" o "nivel"');
  if (!['historia', 'efemeride'].includes(d.tipo)) e.push('"tipo" es "historia" o "efemeride"');
  if (d.tipo === 'efemeride' && !d.fecha_iconica) e.push('una efeméride lleva "fecha_iconica" (ej. "12 de octubre de 1492")');
  if (d.arte?.estilo !== 'documental' || !d.arte?.universo) e.push('"arte" lleva "estilo": "documental" y "universo" (época y lugar, en inglés)');
  if (E.length < 6 || E.length > 9) e.push('el reel lleva de 6 a 9 escenas');
  const total = E.reduce((a, x) => a + (x.dur || 3.5), 0);
  if (total < 25 || total > 45) e.push(`dura ${total.toFixed(1)} s: debe quedar entre 25 y 45 s (el del 2 de octubre duraba 1:45 y casi todos se iban en el segundo 2)`);
  E.forEach((x, i) => {
    const n = `escena ${i + 1}`;
    if (x.tipo && x.tipo !== 'cierre') e.push(`${n}: tipo "${x.tipo}" no existe (omítelo, o "cierre" en la última)`);
    if (!x.titulo?.length) e.push(`${n}: falta "titulo"`);
    (x.titulo || []).forEach(l => { if (plano(l).length > 18) e.push(`${n}: "${plano(l)}" es muy larga para un título (máx. 18)`); });
    if (x.marcador && plano(x.marcador).length > 26) e.push(`${n}: el marcador pasa de 26 caracteres`);
    const cuerpo = (x.cuerpo || []).map(plano).join(' ');
    if (cuerpo.length > 70) e.push(`${n}: el cuerpo pasa de 70 caracteres: una sola frase corta`);
    if ((x.cuerpo || []).length > 1) e.push(`${n}: el cuerpo lleva una sola frase`);
    // Tiempo para leer con calma: 1.2 s + 0.33 s por palabra (el equipo: "no se alcanza a leer")
    const palabras = [...(x.titulo || []), x.marcador || '', ...(x.cuerpo || [])].map(plano).join(' ').split(/\s+/).filter(Boolean).length;
    const minimo = Math.round((1.2 + 0.33 * palabras) * 10) / 10;
    if (i > 0 && (x.dur || 3.5) < minimo) e.push(`${n}: ${palabras} palabras necesitan al menos ${minimo} s (tiene ${x.dur || 3.5}); alarga o recorta texto`);
    if (i > 0 && palabras > 16) e.push(`${n}: ${palabras} palabras es demasiado texto (máx. 16 por escena)`);
    if (x.tipo !== 'cierre' && x.fondo_de == null && !x.arte?.escena) e.push(`${n}: falta "arte.escena" (o "fondo_de" para reusar otro fondo)`);
    const todo = JSON.stringify({ ...x, arte: undefined });
    if (/\?/.test(todo) && !/¿/.test(todo)) e.push(`${n}: hay una pregunta sin "¿"`);
    if (/chuleta/i.test(todo)) e.push(`${n}: en México se dice "acordeón", no "chuleta"`);
  });
  if (E[0] && (E[0].dur || 3.5) > 3.4) e.push('la escena 1 (el gancho) dura máximo 3.4 s: lo más fuerte va completo en el primer cuadro');
  if (E[0]?.cuerpo?.length) e.push('la escena 1 no lleva cuerpo: solo título (y marcador/fecha), que se lee en un vistazo');
  if (E.at(-1)?.tipo !== 'cierre') e.push('la última escena es el cierre ("tipo": "cierre")');
  if (!d.post) e.push('falta "post"');
  const dia = d.fecha_iconica?.split(' de ').slice(0, 2).join(' de ');
  if (d.tipo === 'efemeride' && d.post && dia && !d.post.toLowerCase().includes(dia.toLowerCase())) e.push(`el post debe decir la fecha tal cual ("${dia}"): así lo encuentran en búsqueda`);
  return e;
}

export async function renderHistoria(b, d, dir, log = () => {}) {
  const slug = slugCarrusel({ ...d, slides: [] });
  const fondos = d.reel.escenas.map((_, i) => { const f = path.join(ARTE, slug, `reel-${String(i + 1).padStart(2, '0')}.jpg`); return existsSync(f) ? `../arte/${slug}/${path.basename(f)}` : null; });
  const datos = { ...d, reel_fondos: fondos };
  const mp4 = path.join(dir, 'video.mp4'), png = path.join(dir, 'portada.png'), jpg = path.join(dir, 'portada.jpg');
  const { duration } = await renderVideo(b, 'historia.html', datos, mp4, { log });
  // Portada = el primer cuadro (el gancho completo), que es lo que se ve en el perfil
  await renderImage(b, 'historia.html', datos, png);
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', jpg]);
  await writeFile(path.join(dir, 'post.txt'), d.post + '\n');
  return { mp4, portada: jpg, duration, datos };
}

function correo(d, duracion) {
  const e = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const titulo = d.reel.escenas[0].titulo.join(' ').replace(/\*\*|\[\[|\]\]/g, '');
  const cuando = d.tipo === 'efemeride'
    ? `<b>Publícalo hoy temprano (antes de las 10 am)</b>: hoy la gente está buscando "${e(d.fecha_iconica)}" y TikTok empuja lo que habla del tema del día.`
    : 'Publícalo hoy entre 7 y 9 pm, que es cuando más gente está viendo.';
  return {
    subject: `${d.tipo === 'efemeride' ? 'Efeméride' : 'Historia'} · ${titulo} (${d.materia}, ${Math.round(duracion)} s)`,
    html: `<div style="font-family:system-ui,sans-serif;color:#1b1330;max-width:560px;line-height:1.5">
<p>Video listo: <b>${e(titulo)}</b>. Archivo <b>video.mp4</b> con su portada <b>portada.jpg</b> (en TikTok, <i>Editar portada → Subir</i>; en Instagram, <i>Editar portada → Agregar desde la galería</i>).</p>
<p>${cuando} Va sin audio: ponle una canción tranquila en tendencia${/delicad|debate/.test(d.tono || '') ? ' (tema delicado: nada festivo)' : ''}.</p>
<p>Texto para copiar:</p>
<pre style="background:#f5f3fa;border-radius:10px;padding:12px 14px;white-space:pre-wrap;font-family:inherit">${e(d.post)}</pre>
<p style="color:#6b6485;font-size:14px">Responde los primeros comentarios en la primera hora: eso le dice a TikTok que el video genera conversación.</p>
</div>`,
  };
}

async function main() {
  const { values: a } = parseArgs({ options: {
    data: { type: 'string', multiple: true }, salida: { type: 'string', default: 'salida/historias' },
    revisar: { type: 'boolean', default: false }, enviar: { type: 'boolean', default: false },
  } });
  if (!a.data?.length) throw new Error('Falta --data archivo.json');
  for (const file of a.data) {
    const d = JSON.parse(await readFile(file, 'utf8'));
    const errores = validarHistoria(d);
    if (errores.length) throw new Error(`${file}: el video no se generó:\n  - ` + errores.join('\n  - '));
    const slug = slugCarrusel({ ...d, slides: [] }), dir = path.resolve(a.salida, slug);
    await mkdir(dir, { recursive: true });
    const faltan = d.reel.escenas.map((x, i) => (x.fondo_de == null && x.arte?.escena && !existsSync(path.join(ARTE, slug, `reel-${String(i + 1).padStart(2, '0')}.jpg`)) ? i + 1 : null)).filter(Boolean);
    if (faltan.length) console.log(`  aviso: sin fondo de OpenAI en la(s) escena(s) ${faltan.join(', ')} (sale el de respaldo)`);
    await withBrowser(async b => {
      if (a.revisar) {
        const fondos = d.reel.escenas.map((_, i) => { const f = path.join(ARTE, slug, `reel-${String(i + 1).padStart(2, '0')}.jpg`); return existsSync(f) ? `../arte/${slug}/${path.basename(f)}` : null; });
        console.log((await renderFrames(b, 'historia.html', { ...d, reel_fondos: fondos }, path.join(dir, slug))).join('\n'));
        return;
      }
      const r = await renderHistoria(b, d, dir, m => console.log(m));
      console.log(`Video listo: ${r.mp4} (${r.duration.toFixed(1)} s)\nPortada: ${r.portada}`);
      if (a.enviar) { const m = await sendEmail(correo(d, r.duration), [r.mp4, r.portada]); console.log(`  correo enviado (${m.id})`); }
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
