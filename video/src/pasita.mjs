#!/usr/bin/env node
// Video con la Pasita a partir de una lista de pantallas (un "carrusel animado").
//
//   node src/pasita.mjs --data data/ejemplo-pasita-nervios.json
//   node src/pasita.mjs --data mi-video.json --salida salida/pasita --revisar
//
// --revisar genera solo un cuadro por pantalla (PNG) para aprobar el texto
// antes del video completo, que tarda unos 3 minutos.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { withBrowser, renderVideo, renderFrames, renderImage } from './render.mjs';

export const TIPOS = ['gancho', 'grande', 'numero', 'texto', 'cierre'];
export const POSES = ['pensativa', 'celebrando', 'aprobando', 'confiada', 'lapiz', 'flexionando'];
export const COLORES = ['cian', 'rosa', 'amarillo', 'morado'];

// Límites medidos a 1080×1920: más texto no cabe o no se alcanza a leer.
const MAX = { linea: 18, grande: 14, cierre: 14, titulo: 30, texto: 170 };

export function validarPasita(d) {
  const errores = [], avisos = [];
  const p = d.pantallas;
  if (!Array.isArray(p) || p.length < 3 || p.length > 10) errores.push('"pantallas" debe tener entre 3 y 10 pantallas');
  (p || []).forEach((s, i) => {
    const n = `pantalla ${i + 1}`;
    if (!TIPOS.includes(s.tipo)) errores.push(`${n}: tipo "${s.tipo}" no existe (usa ${TIPOS.join(', ')})`);
    if (!POSES.includes(s.pose)) errores.push(`${n}: pose "${s.pose}" no existe (usa ${POSES.join(', ')})`);
    if (s.color && !COLORES.includes(s.color)) errores.push(`${n}: color "${s.color}" no existe (usa ${COLORES.join(', ')})`);
    if (s.tipo === 'gancho') {
      if (!Array.isArray(s.lineas) || !s.lineas.length || s.lineas.length > 4) errores.push(`${n}: el gancho lleva de 1 a 4 "lineas"`);
      (s.lineas || []).forEach(l => { if (l.length > MAX.linea) errores.push(`${n}: "${l}" es muy larga para una línea del gancho (máx. ${MAX.linea})`); });
    } else {
      if (!s.titulo) errores.push(`${n}: falta "titulo"`);
      const max = s.tipo === 'grande' ? MAX.grande : s.tipo === 'cierre' ? MAX.cierre : MAX.titulo;
      if (s.titulo && s.titulo.length > max) errores.push(`${n}: el título "${s.titulo}" pasa de ${max} caracteres`);
      if (s.texto && s.texto.length > MAX.texto) errores.push(`${n}: el texto pasa de ${MAX.texto} caracteres; pártelo en dos pantallas`);
    }
    const todo = [...(s.lineas || []), s.titulo || '', s.texto || ''].join(' ');
    if (/\?/.test(todo) && !/¿/.test(todo)) avisos.push(`${n}: hay una pregunta sin "¿"`);
  });
  if (d.portada_cta && d.portada_cta.length > 26) errores.push(`portada_cta pasa de 26 caracteres: "${d.portada_cta}"`);
  for (const k of ['portada_pose', 'portada_pose_b']) if (d[k] && !POSES.includes(d[k])) errores.push(`${k} "${d[k]}" no existe`);
  if (p?.length && p[0].tipo !== 'gancho') avisos.push('la primera pantalla no es un gancho: los primeros 2 segundos deciden si alguien se queda');
  if (p?.length && p[p.length - 1].tipo !== 'cierre') avisos.push('la última pantalla no es un cierre');
  return { errores, avisos };
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'video';
}

async function main() {
  const { values: a } = parseArgs({ options: {
    data: { type: 'string' }, salida: { type: 'string', default: 'salida/pasita' }, revisar: { type: 'boolean', default: false },
  } });
  if (!a.data) throw new Error('Falta --data archivo.json');
  const d = JSON.parse(await readFile(a.data, 'utf8'));
  const { errores, avisos } = validarPasita(d);
  avisos.forEach(x => console.log(`  aviso: ${x}`));
  if (errores.length) throw new Error('El video no se generó:\n  - ' + errores.join('\n  - '));

  const nombre = slug(d.nombre || d.pantallas[0].lineas?.join(' ') || d.pantallas[0].titulo);
  const dir = path.resolve(a.salida);
  await mkdir(dir, { recursive: true });

  await withBrowser(async b => {
    // Dos propuestas de portada: A (título arriba, Pasita abajo) y B (Pasita arriba, título en panel)
    for (const [v, tpl] of [['a', 'portada.html'], ['b', 'portada-b.html']]) {
      const f = path.join(dir, `${nombre}-portada-${v}.png`);
      await renderImage(b, tpl, d, f);
      console.log(`Portada ${v.toUpperCase()}: ${f}`);
    }
    if (a.revisar) {
      const files = await renderFrames(b, 'pasita.html', d, path.join(dir, nombre));
      console.log(`Cuadros para revisar:\n  ${files.join('\n  ')}`);
      return;
    }
    const out = path.join(dir, `${nombre}.mp4`);
    const t0 = Date.now();
    const { duration } = await renderVideo(b, 'pasita.html', d, out, { log: m => console.log(m) });
    console.log(`Video listo: ${out} (${duration.toFixed(1)} s, en ${Math.round((Date.now() - t0) / 1000)} s)`);
    const notas = [
      d.post ? `TEXTO PARA LA PUBLICACIÓN\n${d.post}` : '',
      d.portada_prompt ? `PROMPT PARA UNA PORTADA ILUSTRADA (ChatGPT, opcional)\n${d.portada_prompt}` : '',
    ].filter(Boolean).join('\n\n');
    if (notas) {
      await writeFile(path.join(dir, `${nombre}.txt`), notas + '\n');
      console.log(`Notas: ${path.join(dir, `${nombre}.txt`)}`);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
}
