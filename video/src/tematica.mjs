#!/usr/bin/env node
// "Así se explica en PASAS": una lección real con temática (anime, videojuegos,
// K-pop, fútbol) convertida en reel, con su portada de título.
//
//   node src/tematica.mjs --data data/ejemplo-tematica-naruto.json --revisar
//   node src/tematica.mjs --data data/ejemplo-tematica-naruto.json
//   node src/tematica.mjs --data … --guion              → guion numerado, una línea por pantalla
//   node src/tematica.mjs --data … --audios carpeta/    → video con la voz propia (un audio por pantalla)
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
import { archivoPortadaIA, slugVideo } from './portada-ia.mjs';
import { leerAudios, tiemposDe, armarPista, ponerPista } from './voz.mjs';

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

// Oraciones de la lección: una por pantalla. Mismo corte que la plantilla.
export function oraciones(texto) {
  return texto.trim().split(/(?<=[a-záéíóúñü0-9)*]{2}\.)\s+/i);
}
const limpio = s => s.replace(/\*\*/g, '');

// Guion para grabar: lo que se dice en cada pantalla, en orden.
export function guion(d) {
  const lineas = oraciones(d.texto);
  return [
    { pantalla: 'Gancho', texto: d.voz_gancho || `${d.gancho.join(' ')} ${d.subgancho}` },
    ...lineas.map((l, i) => ({ pantalla: `Lección ${i + 1} de ${lineas.length}`, texto: limpio(l) })),
    { pantalla: 'Cierre', texto: d.voz_cierre || 'Tú eliges con qué aprender. La misma lección, explicada con lo que te gusta.' },
  ];
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
    guion: { type: 'boolean', default: false }, audios: { type: 'string' },
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

  // Guion para que el equipo grabe un audio por pantalla
  const g = guion(d);
  if (a.guion) {
    const txt = g.map((x, i) => `${String(i + 1).padStart(2, '0')} · ${x.pantalla}\n${x.texto}`).join('\n\n');
    const f = path.join(dir, `${nombre}-guion.txt`);
    await writeFile(f, txt + '\n');
    console.log(txt + `\n\nGuion: ${f}`);
    return;
  }

  // Voz propia: cada pantalla dura lo que su audio; los subtítulos son el guion
  let voz = null;
  if (a.audios) {
    const files = await leerAudios(path.resolve(a.audios), g.length);
    d.tiempos = tiemposDe(files);
    d.audio_url = null;
    voz = { files, pista: path.join(dir, `${nombre}-voz.m4a`) };
    console.log(`  ${files.length} audios · ${d.tiempos.reduce((x, y) => x + y, 0).toFixed(1)} s en total`);
  }
  d.lineas = oraciones(d.texto);
  const duracion = d.tiempos ? d.tiempos.reduce((x, y) => x + y, 0) : INICIO + d.audio + 0.4 + 4.2;

  // La voz se intenta antes del render: el video muestra el indicador solo si la hay.
  const mp3 = path.join(dir, `${nombre}.mp3`);
  d.con_audio = !a.revisar && !voz && d.audio_url ? await bajarAudio(d.audio_url, mp3) : false;
  // Con voz, los subtítulos dicen exactamente lo que dice la voz
  if (d.con_audio) {
    d.lineas = null;
    if (!d.texto_audio) { d.con_audio = false; console.log('  aviso: hay voz pero falta "texto_audio" (el texto tal cual suena); sale sin voz'); }
    else d.texto = d.texto_audio;
    d.lineas = oraciones(d.texto);
  }
  if (d.audio_url && !a.revisar) console.log(d.con_audio ? '  voz de la lección descargada' : '  aviso: no se pudo descargar la voz; el video sale sin audio');

  await withBrowser(async b => {
    const portada = path.join(dir, `${nombre}-portada.png`);
    await renderImage(b, 'portada-tematica.html', { ...d, duracion }, portada);
    console.log(`Portada: ${portada}`);
    if (d.portada_ia) {
      if (existsSync(archivoPortadaIA(d))) {
        const f = path.join(dir, `${nombre}-portada-ia.png`);
        await renderImage(b, 'portada-ia.html', { ...d, duracion, portada_ia_img: `../arte/portadas/${slugVideo(d)}.jpg` }, f);
        console.log(`Portada con ChatGPT: ${f}`);
      } else console.log(`  aviso: falta la portada con ChatGPT (arte/portadas/${slugVideo(d)}.jpg): corre el workflow "Portada con OpenAI" y haz git pull`);
    }
    if (a.revisar) {
      const files = await renderFrames(b, 'fmt-tematica.html', d, path.join(dir, nombre));
      console.log(`Cuadros para revisar:\n  ${files.join('\n  ')}`);
      return;
    }
    const out = path.join(dir, `${nombre}.mp4`);
    const t0 = Date.now();
    await renderVideo(b, 'fmt-tematica.html', d, out, { log: m => console.log(m) });
    if (voz) {
      armarPista(voz.files, d.tiempos, voz.pista);
      const tmp = out.replace(/\.mp4$/, '.tmp.mp4');
      ponerPista(out, voz.pista, tmp); await rename(tmp, out); await rm(voz.pista, { force: true });
      console.log('  voz propia unida al video');
    } else if (d.con_audio) { const tmp = ponerAudio(out, mp3); await rename(tmp, out); await rm(mp3, { force: true }); }
    console.log(`Video listo: ${out} (${duracion.toFixed(1)} s, en ${Math.round((Date.now() - t0) / 1000)} s)`);
    if (d.post) await writeFile(path.join(dir, `${nombre}.txt`), `TEXTO PARA LA PUBLICACIÓN\n${d.post}\n`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
