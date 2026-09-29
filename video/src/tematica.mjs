#!/usr/bin/env node
// "Así se explica en PASAS": una lección real con temática (anime, videojuegos,
// K-pop, fútbol) convertida en reel, con su portada de título.
//
//   node src/tematica.mjs --data data/ejemplo-tematica-naruto.json --revisar
//   node src/tematica.mjs --data data/ejemplo-tematica-naruto.json
//
// Si el archivo trae "audio_url" y se puede descargar, el video lleva la voz de
// la lección y los subtítulos usan "texto_audio" (el texto tal cual suena). Si
// no, sale sin voz y los subtítulos usan "texto" (que puede estar ajustado).
import { mkdir, writeFile, readFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames, renderImage } from './render.mjs';
import { FONDOS } from './pasita.mjs';

const TEMATICAS = ['Anime & Manga', 'Videojuegos', 'K-pop & K-dramas', 'Fútbol'];
const INICIO = 3.4; // segundos del gancho antes de que empiece la lección

export function validarTematica(d) {
  const errores = [], avisos = [];
  for (const k of ['materia', 'nivel', 'tema', 'tematica', 'texto', 'subgancho']) if (!d[k]) errores.push(`falta "${k}"`);
  if (!Array.isArray(d.gancho) || !d.gancho.length || d.gancho.length > 3) errores.push('"gancho" lleva de 1 a 3 líneas');
  (d.gancho || []).forEach(l => { if (l.length > 16) errores.push(`"${l}" es muy larga para el gancho (máx. 16)`); });
  if (!Array.isArray(d.portada_titulo) || !d.portada_titulo.length || d.portada_titulo.length > 3) errores.push('"portada_titulo" lleva de 1 a 3 líneas');
  (d.portada_titulo || []).forEach(l => { if (l.length > 14) errores.push(`"${l}" es muy larga para la portada (máx. 14)`); });
  if (d.tematica && !TEMATICAS.includes(d.tematica)) errores.push(`tematica "${d.tematica}" no existe (usa ${TEMATICAS.join(', ')})`);
  if (!(d.audio > 5 && d.audio < 120)) errores.push('"audio" son los segundos de la lección (audio_duration de la sección), entre 5 y 120');
  if (d.fondo && !FONDOS.includes(d.fondo)) errores.push(`fondo "${d.fondo}" no existe (usa ${FONDOS.join(', ')})`);
  if (/lo que acabas de ver/i.test(d.texto || '')) errores.push('el texto dice "Lo que acabas de ver…": en un video suelto no hay nada antes. Reescribe solo esa primera frase.');
  const t = [...(d.gancho || []), d.subgancho || '', d.texto || ''].join(' ');
  if (/\?/.test(t) && !/¿/.test(t)) avisos.push('hay una pregunta sin "¿"');
  return { errores, avisos };
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'video';
}

async function bajarAudio(url, dest) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch { return false; }
}

function ponerAudio(video, audio) {
  // La voz entra cuando empieza la lección; el resto del video queda en silencio.
  const tmp = video.replace(/\.mp4$/, '.tmp.mp4');
  const ms = Math.round(INICIO * 1000);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', audio,
    '-filter_complex', `[1:a]adelay=${ms}|${ms},apad[a]`, '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', tmp], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo poner el audio');
  return tmp;
}

async function main() {
  const { values: a } = parseArgs({ options: {
    data: { type: 'string' }, salida: { type: 'string', default: 'salida/tematica' }, revisar: { type: 'boolean', default: false },
  } });
  if (!a.data) throw new Error('Falta --data archivo.json');
  const d = JSON.parse(await readFile(a.data, 'utf8'));
  d.tematicas = d.tematicas || TEMATICAS;
  const { errores, avisos } = validarTematica(d);
  avisos.forEach(x => console.log(`  aviso: ${x}`));
  if (errores.length) throw new Error('El video no se generó:\n  - ' + errores.join('\n  - '));

  const nombre = slug(d.nombre || d.portada_titulo.join(' '));
  const dir = path.resolve(a.salida);
  await mkdir(dir, { recursive: true });
  const duracion = INICIO + d.audio + 0.4 + 4.2;

  // La voz se intenta antes del render: el video muestra el indicador solo si la hay.
  const mp3 = path.join(dir, `${nombre}.mp3`);
  d.con_audio = !a.revisar && d.audio_url ? await bajarAudio(d.audio_url, mp3) : false;
  // Con voz, los subtítulos dicen exactamente lo que dice la voz
  if (d.con_audio) {
    if (!d.texto_audio) { d.con_audio = false; console.log('  aviso: hay voz pero falta "texto_audio" (el texto tal cual suena); sale sin voz'); }
    else d.texto = d.texto_audio;
  }
  if (d.audio_url && !a.revisar) console.log(d.con_audio ? '  voz de la lección descargada' : '  aviso: no se pudo descargar la voz; el video sale sin audio');

  await withBrowser(async b => {
    const portada = path.join(dir, `${nombre}-portada.png`);
    await renderImage(b, 'portada-tematica.html', { ...d, duracion }, portada);
    console.log(`Portada: ${portada}`);
    if (a.revisar) {
      const files = await renderFrames(b, 'fmt-tematica.html', d, path.join(dir, nombre));
      console.log(`Cuadros para revisar:\n  ${files.join('\n  ')}`);
      return;
    }
    const out = path.join(dir, `${nombre}.mp4`);
    const t0 = Date.now();
    await renderVideo(b, 'fmt-tematica.html', d, out, { log: m => console.log(m) });
    if (d.con_audio) { const tmp = ponerAudio(out, mp3); await rename(tmp, out); await rm(mp3, { force: true }); }
    console.log(`Video listo: ${out} (${duracion.toFixed(1)} s, en ${Math.round((Date.now() - t0) / 1000)} s)`);
    if (d.post) await writeFile(path.join(dir, `${nombre}.txt`), `TEXTO PARA LA PUBLICACIÓN\n${d.post}\n`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
