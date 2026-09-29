#!/usr/bin/env node
// Uso:
//   node src/run.mjs --data data/ejemplo-reto-12.json --parte manana [--enviar]
//   node src/run.mjs --data data/ejemplo-reto-12.json --parte noche  [--enviar]
//   node src/run.mjs --fecha 2026-10-05 --parte manana --enviar      (cuando Supabase esté conectado)
// Sin --fecha ni --data, toma la fecha de hoy en hora del centro de México.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { validate, loadFromFile, loadFromSupabase } from './data.mjs';
import { withBrowser, renderReel, renderStory } from './render.mjs';
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

async function main() {
  if (!['manana', 'noche'].includes(args.parte)) throw new Error('--parte debe ser "manana" o "noche"');
  const fecha = args.fecha || hoyMexico();
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
      const s1 = path.join(dir, 'story-1-aviso.png');
      const s2 = path.join(dir, 'story-2-ronda-extra.png');
      await renderStory(browser, data, 'aviso', s1);
      await renderStory(browser, data, 'extra', s2);
      log('  stories de la mañana listas');
      return [reel, s1, s2];
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
