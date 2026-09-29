// Voz propia por pantalla: el equipo genera un audio por pantalla (con una
// herramienta de IA) y aquí se miden, se unen en una sola pista y se ponen al video.
// Cada pantalla dura lo que dura su audio, más una pausa corta.
import { readdir, copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const PAUSA = 0.35;       // silencio después de cada frase
export const PAUSA_FINAL = 1.2;  // la última pantalla se queda un poco más

const EXT = /\.(mp3|wav|m4a|aac|ogg|opus|webm|mp4|mpeg)$/i;

export function duracion(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (!(d > 0)) throw new Error(`No pude leer la duración de ${path.basename(file)}. ¿Es un archivo de audio?`);
  return d;
}

// Toma los audios de una carpeta en orden: por el número al inicio del nombre
// ("01.mp3", "2 - gancho.m4a"); si no tienen número, por orden alfabético.
export async function leerAudios(dir, esperados) {
  const files = (await readdir(dir)).filter(f => EXT.test(f));
  const num = f => { const m = f.match(/^\D*?(\d+)/); return m ? parseInt(m[1], 10) : Infinity; };
  files.sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  if (files.length !== esperados) {
    throw new Error(`Hay ${files.length} audios y el guion tiene ${esperados} pantallas. Tiene que haber uno por pantalla.`);
  }
  return files.map(f => path.join(dir, f));
}

// Duración de cada pantalla = su audio + pausa (la última, con pausa larga).
export function tiemposDe(files) {
  return files.map((f, i) => +(duracion(f) + (i === files.length - 1 ? PAUSA_FINAL : PAUSA)).toFixed(3));
}

// Une los audios en una pista: cada uno arranca justo al empezar su pantalla.
export function armarPista(files, tiempos, out) {
  const args = ['-y', '-loglevel', 'error'];
  files.forEach(f => args.push('-i', f));
  const parts = files.map((_, i) =>
    `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,apad=whole_dur=${tiempos[i]},atrim=0:${tiempos[i]}[a${i}]`);
  const filter = parts.join(';') + ';' + files.map((_, i) => `[a${i}]`).join('') + `concat=n=${files.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  args.push('-filter_complex', filter, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', out);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo unir los audios');
  return out;
}

// Cambia la pista (muda) del video por la voz.
export function ponerPista(video, pista, out) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', pista,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo poner la voz al video');
  return out;
}

// Copia los audios pegados en la conversación a una carpeta de trabajo, en orden.
export async function prepararCarpeta(origen, destino) {
  await mkdir(destino, { recursive: true });
  for (const f of origen) await copyFile(f, path.join(destino, path.basename(f)));
  return destino;
}
