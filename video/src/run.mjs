#!/usr/bin/env node
// Uso:
//   node src/run.mjs --data data/ejemplo-reto-12.json --parte manana [--enviar]
//   node src/run.mjs --data data/ejemplo-reto-12.json --parte noche  [--enviar]
//   node src/run.mjs --fecha 2026-10-05 --parte manana --enviar      (cuando Supabase esté conectado)
// Sin --fecha ni --data, toma la fecha de hoy en hora del centro de México.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { validate, loadFromFile, loadFromSupabase, addDays } from './data.mjs';
import { withBrowser, renderReel, renderStory, renderImage } from './render.mjs';
import { buildEmail, sendEmail } from './email.mjs';

const { values: args } = parseArgs({
  options: {
    data: { type: 'string' },
    fecha: { type: 'string' },
    parte: { type: 'string', default: 'manana' },
    salida: { type: 'string', default: 'salida' },
    enviar: { type: 'boolean', default: false },
  },
});

// Fecha de hoy en la Ciudad de México (UTC-6 todo el año desde 2022). GitHub y Vercel corren en UTC.
function hoyMexico() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

const log = (...m) => console.log(...m);

/**
 * La fecha del reto para cada parte.
 *
 * 🔴 La NOCHE habla del reto que se jugó ESE día. GitHub puede correr el
 * horario con horas de retraso: el 29-sep la noche arrancó a las 2:53 am y
 * leyó el reto #2 (0 jugadores, recién empezado) en vez del #1 (10). Si la
 * noche corre antes del mediodía, el reto es el de ayer.
 */
function fechaDeLaParte(parte) {
  const hoy = hoyMexico();
  if (parte !== 'noche') return hoy;
  const hora = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23' }).format(new Date())
  );
  return hora < 12 ? addDays(hoy, -1) : hoy;
}

async function main() {
  if (!['manana', 'noche'].includes(args.parte)) throw new Error('--parte debe ser "manana" o "noche"');
  const fecha = args.fecha || fechaDeLaParte(args.parte);
  const raw = args.data
    ? await loadFromFile(args.data)
    : await loadFromSupabase(fecha, args.parte, { hoyMexico: hoyMexico(), log });
  const data = validate(raw, args.parte);

  const dir = path.resolve(args.salida, data.fecha);
  await mkdir(dir, { recursive: true });
  log(`Reto #${data.numero} · ${data.fecha} · parte ${args.parte} → ${dir}`);

  // Pocos jugadores: no hay story de resultados, pero sí un aviso por correo.
  if (args.parte === 'noche' && data.sinResultados) {
    log(`  hoy jugaron ${data.jugadores}; con menos de 20 no hay story de resultados`);
    if (args.enviar) {
      const r = await sendEmail(buildEmail(data, 'noche'), []);
      log(`  correo enviado (${r.id})`);
    }
    return;
  }

  const files = await withBrowser(async browser => {
    if (args.parte === 'manana') {
      const reel = path.join(dir, 'reel.mp4');
      const t0 = Date.now();
      const { duration } = await renderReel(browser, data, reel, { log });
      log(`  reel listo: ${duration}s de video en ${Math.round((Date.now() - t0) / 1000)}s`);
      const portada = path.join(dir, 'reel-portada.png');
      await renderImage(browser, 'portada-reto.html', { ...data, duracion: duration }, portada);
      log('  portada del reel lista');
      const s1 = path.join(dir, 'story-1-aviso.png');
      const s2 = path.join(dir, 'story-2-ronda-extra.png');
      await renderStory(browser, data, 'aviso', s1);
      await renderStory(browser, data, 'extra', s2);
      const s2t = path.join(dir, 'story-2-ronda-extra-tiktok.png');
      await renderStory(browser, data, 'extra-tiktok', s2t);
      log('  stories de la mañana listas');
      return [reel, portada, s1, s2, s2t];
    }
    const s3 = path.join(dir, 'story-3-resultados.png');
    await renderStory(browser, data, 'resultados', s3);
    log('  story de resultados lista');
    return [s3];
  });

  if (args.enviar) {
    const r = await sendEmail(buildEmail(data, args.parte), files);
    log(`  correo enviado (${r.id})`);
  } else {
    log('  sin --enviar: no se mandó correo');
  }
}

main().catch(err => {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
});
