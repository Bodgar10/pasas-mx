// De dónde salen los datos del reto y cómo se validan antes de generar nada.
// Si algo no cuadra, se detiene con un error claro: nunca se genera un video roto.
import { readFile } from 'node:fs/promises';

// Mismo umbral que la página (/arcade, MIN_JUGADORES_CIFRAS): con menos
// jugadores un porcentaje no dice nada y no se presume.
export const MIN_JUGADORES = 10;

function fail(msg) { throw new Error(`Datos del reto inválidos: ${msg}`); }

function checkRound(r, name, { needsAnswer = true } = {}) {
  if (!r) fail(`falta "${name}"`);
  if (!Array.isArray(r.opciones) || r.opciones.length !== 4) fail(`"${name}.opciones" debe tener exactamente 4 opciones`);
  if (r.opciones.some(o => typeof o !== 'string' || !o.trim())) fail(`"${name}.opciones" tiene una opción vacía`);
  if (needsAnswer && ![0, 1, 2, 3].includes(r.sobra)) fail(`"${name}.sobra" debe ser 0, 1, 2 o 3`);
}

// s48 — Ronda de "Verdadero o mentira": una frase y si es verdad o mentira.
function checkFrase(r, name, { needsMotivo = false } = {}) {
  if (!r) fail(`falta "${name}"`);
  if (typeof r.frase !== 'string' || r.frase.trim().length < 10) fail(`"${name}.frase" debe ser una frase de al menos 10 letras`);
  if (typeof r.verdad !== 'boolean') fail(`"${name}.verdad" debe ser true o false`);
  if (needsMotivo && !r.motivo) fail(`"${name}.motivo" es obligatorio (por qué es verdad o mentira)`);
}

export function validate(data, parte) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha || '')) fail('"fecha" debe ser AAAA-MM-DD');
  if (!Number.isInteger(data.numero) || data.numero < 1) fail('"numero" debe ser un entero desde 1');
  if (data.juego === 'vom') {
    if (parte === 'manana') {
      checkFrase(data.hoy, 'hoy');
      checkFrase(data.extra, 'extra', { needsMotivo: true });
      if (data.ayer) checkFrase(data.ayer, 'ayer', { needsMotivo: true });
      if (data.extra.frase === data.hoy.frase) fail('la frase extra de la story no puede ser la misma del reto');
    }
    if (parte === 'noche' && !data.sinResultados) {
      const r = data.resultados;
      if (!r || typeof r.porcentaje !== 'number' || !r.tema) fail('"resultados" necesita "porcentaje" y "tema"');
    }
    return data;
  }
  if (parte === 'manana') {
    checkRound(data.hoy, 'hoy');
    checkRound(data.extra, 'extra');
    // "ayer" puede faltar (reto #1, o un día sin reto): el reel empieza en el título.
    if (data.ayer) {
      checkRound(data.ayer, 'ayer');
      if (!data.ayer.motivo) fail('"ayer.motivo" es obligatorio (una línea: por qué sobraba)');
    }
    if (data.extra.opciones.join('|') === data.hoy.opciones.join('|')) {
      fail('la ronda extra de la story no puede ser la misma ronda del reto');
    }
  }
  if (parte === 'noche' && !data.sinResultados) {
    const r = data.resultados;
    if (!r || typeof r.porcentaje !== 'number' || !r.tema) fail('"resultados" necesita "porcentaje" y "tema"');
  }
  return data;
}

export async function loadFromFile(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

// ─── Supabase ────────────────────────────────────────────────────────
// Lee con service role por la API REST: las tablas del Arcade no tienen
// políticas para anon (migración 051). Solo lectura, con una excepción: si
// hoy todavía no tiene reto, llama a arcade_reto(), que lo arma igual que
// cuando alguien abre /arcade.

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable ${name}`);
  return v;
}

async function api(path, { method = 'GET', body } = {}) {
  const url = `${env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${path}`;
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  // Llaves nuevas (sb_secret_…) no son JWT: van solo en "apikey".
  // Las antiguas (service_role, eyJ…) van también como Bearer.
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} en ${path.split('?')[0]}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export function addDays(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// La explicación termina con la oración sobre la opción que sobra
// ("La expropiación petrolera la hizo Cárdenas en 1938."). Esa va al reel.
// El corte exige dos letras antes del punto para no partir "Francisco I. Madero".
export function motivoCorto(explicacion) {
  const partes = explicacion.trim().split(/(?<=[a-záéíóúñü0-9)]{2}\.)\s+/i);
  return partes[partes.length - 1];
}

// Nombres por materia del reto (migración 056). Espejo corto de
// src/lib/arcade/materias.ts: si cambia un nombre allá, cámbialo aquí.
const MATERIAS = {
  historia: { materia: 'Historia', corta: 'Historia', titulo: 'Reto de Historia' },
  biologia: { materia: 'Biología', corta: 'Biología', titulo: 'Reto de Biología' },
  geografia: { materia: 'Geografía', corta: 'Geografía', titulo: 'Reto de Geografía' },
  ciencias: { materia: 'Química y Física', corta: 'Química y Física', titulo: 'Reto de Química y Física' },
  espanol: { materia: 'Español', corta: 'Español', titulo: 'Reto de Español' },
  papas: { materia: 'Reto para papás', corta: 'Papás', titulo: 'Reto para papás' },
};

async function reto(fecha) {
  const rows = await api(`arcade_challenges?challenge_date=eq.${fecha}&select=challenge_date,number,round_ids,materia`);
  return rows[0] || null;
}

// Espejo de arcade_materia_de_slug (migración 056): la materia de una ronda sale
// del slug de su asignatura. Si cambia allá, cámbialo aquí.
export function materiaDeSlug(slug = '') {
  if (slug.startsWith('historia-')) return 'historia';
  if (slug.startsWith('biologia-') || ['temas-selectos-biologia', 'ecologia-medio-ambiente'].includes(slug)) return 'biologia';
  if (slug === 'geografia' || slug.startsWith('geografia-')) return 'geografia';
  if (slug.startsWith('quimica-') || slug.startsWith('fisica-') || ['temas-selectos-quimica', 'temas-selectos-fisica'].includes(slug)) return 'ciencias';
  if (slug.startsWith('espanol-') || slug.startsWith('lengua-comunicacion-') || slug.startsWith('literatura-')) return 'espanol';
  return null;
}

async function rondas(ids) {
  if (!ids.length) return new Map();
  const rows = await api(`arcade_rounds?id=in.(${ids.join(',')})&select=id,options,odd_index,explanation,kind,status,topic:topics(name,subject:subjects(slug))`);
  return new Map(rows.map(r => [r.id, { ...r, materia: materiaDeSlug(r.topic?.subject?.slug) }]));
}

// Materia de cada ronda aprobada (id → materia), en páginas de 1000 (tope de la API).
async function materiasDelBanco() {
  const out = new Map();
  for (let desde = 0; ; desde += 1000) {
    const rows = await api(`arcade_rounds?status=eq.aprobada&select=id,topic:topics(subject:subjects(slug))&order=id&limit=1000&offset=${desde}`);
    rows.forEach(r => out.set(r.id, materiaDeSlug(r.topic?.subject?.slug)));
    if (rows.length < 1000) return out;
  }
}

async function cifras(fecha) {
  return api('rpc/arcade_cifras', { method: 'POST', body: { p_date: fecha } });
}

function azar(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Ronda para el sticker de quiz. El sticker revela la respuesta, así que sale
// de retos que YA pasaron (su respuesta ya se vio en el juego), nunca de uno
// de hoy o futuro. Al principio no hay pasados: entonces una aprobada que no
// esté en ningún reto del calendario.
// Va con la materia del día (el martes, una de biología); el sábado, cualquiera.
async function rondaExtra(fecha, excluir, materia, log) {
  const todos = await api('arcade_challenges?select=challenge_date,round_ids');
  const pasados = todos.filter(c => c.challenge_date < fecha && c.challenge_date >= addDays(fecha, -180));
  const enCalendario = new Set(todos.flatMap(c => c.round_ids));
  const banco = await materiasDelBanco();
  const deLaMateria = id => materia === 'papas' || banco.get(id) === materia;
  const usadas = pasados.flatMap(c => c.round_ids).filter(id => !excluir.has(id));
  const sinProgramar = [...banco.keys()].filter(id => !enCalendario.has(id) && !excluir.has(id));
  const opciones = [
    [usadas.filter(deLaMateria), null],
    [sinProgramar.filter(deLaMateria), 'aún no hay retos pasados de esta materia; la ronda extra sale del banco sin programar'],
    [usadas, 'no hay rondas de esta materia para la ronda extra; sale de otra materia'],
    [sinProgramar, 'no hay rondas de esta materia para la ronda extra; sale de otra materia, del banco sin programar'],
  ];
  const [ids, aviso] = opciones.find(([x]) => x.length) || [[], null];
  if (!ids.length) throw new Error('No hay ninguna ronda disponible para la story de ronda extra');
  if (aviso) log(`  aviso: ${aviso}`);
  const r = (await rondas([azar(ids)])).values().next().value;
  return { opciones: r.options, sobra: r.odd_index, motivo: r.explanation };
}

// ─── s48 · "Verdadero o mentira" ─────────────────────────────────────
// Desde el 13 oct el reto que se promociona es "Verdadero o mentira": el que
// sale en pasas.mx/arcade. Mismos temas que "¿Cuál sobra?" ese día
// (migración 062). Si al día le faltan frases, el reel y las stories salen de
// "¿Cuál sobra?", igual que la página.

async function vomReto(fecha) {
  const r = await api('rpc/arcade_vom_reto', { method: 'POST', body: { p_date: fecha } });
  return r && Array.isArray(r.rounds) && r.rounds.length === 5 ? r : null;
}

// El reto de vom de una fecha SIN armarlo (para "ayer": si no hubo, no se inventa).
async function vomExistente(fecha) {
  const rows = await api(`arcade_vom_challenges?challenge_date=eq.${fecha}&select=round_ids`);
  if (!rows[0]) return null;
  const ids = rows[0].round_ids;
  const fr = await api(`arcade_vom_rounds?id=in.(${ids.join(',')})&select=id,statement,is_true,explanation`);
  const m = new Map(fr.map(f => [f.id, f]));
  return ids.map(id => m.get(id));
}

// Frase para el sticker de quiz: revela la respuesta, así que sale de un reto
// de vom YA pasado; si todavía no hay, una aprobada que no esté en ningún reto.
// De la materia del día cuando se puede.
async function fraseExtra(fecha, excluir, materia, log) {
  const pasados = (await api(`arcade_vom_challenges?challenge_date=lt.${fecha}&challenge_date=gte.${addDays(fecha, -180)}&select=round_ids`)).flatMap(c => c.round_ids);
  const usadasEnRetos = new Set((await api('arcade_vom_challenges?select=round_ids')).flatMap(c => c.round_ids));
  const banco = [];
  for (let desde = 0; ; desde += 1000) {
    const rows = await api(`arcade_vom_rounds?status=eq.aprobada&select=id,statement,is_true,explanation,topic:topics(subject:subjects(slug))&order=id&limit=1000&offset=${desde}`);
    banco.push(...rows);
    if (rows.length < 1000) break;
  }
  const deMateria = f => materia === 'papas' || materiaDeSlug(f.topic?.subject?.slug) === materia;
  const libres = banco.filter(f => !excluir.has(f.id));
  const yaVistas = libres.filter(f => pasados.includes(f.id));
  const sinUsar = libres.filter(f => !usadasEnRetos.has(f.id));
  const opciones = [
    [yaVistas.filter(deMateria), null],
    [sinUsar.filter(deMateria), 'aún no hay retos pasados de esta materia; la frase extra sale del banco sin usar'],
    [yaVistas, 'no hay frases de esta materia para la story; sale de otra materia'],
    [sinUsar, 'no hay frases de esta materia para la story; sale de otra materia, del banco sin usar'],
  ];
  const [lista, aviso] = opciones.find(([x]) => x.length) || [[], null];
  if (!lista.length) return null;
  if (aviso) log(`  aviso: ${aviso}`);
  const f = azar(lista);
  return { frase: f.statement, verdad: f.is_true, motivo: f.explanation };
}

async function loadVom(fecha, parte, base, log) {
  // En la noche no se arma nada: los resultados son del juego que se jugó.
  if (parte === 'noche') {
    const hubo = await api(`arcade_vom_challenges?challenge_date=eq.${fecha}&select=challenge_date`);
    if (!hubo.length) return null;
  }
  const v = await vomReto(fecha);
  if (!v) return null;
  const rondasDia = v.rounds;
  if (parte === 'noche') {
    const cf = await api('rpc/arcade_vom_cifras', { method: 'POST', body: { p_date: fecha } });
    const jugadores = cf?.players ?? 0;
    if (jugadores < MIN_JUGADORES) return { ...base, juego: 'vom', sinResultados: true, jugadores };
    let peor = -1;
    cf.per_round.forEach((p, i) => { if (p !== null && (peor < 0 || p < cf.per_round[peor])) peor = i; });
    return { ...base, juego: 'vom', resultados: { porcentaje: Number(cf.per_round[peor]), tema: rondasDia[peor].topic, jugadores } };
  }
  const r1 = rondasDia[0];
  const extra = await fraseExtra(fecha, new Set(rondasDia.map(r => r.id)), base.materia_key, log);
  if (!extra) return null;
  const data = {
    ...base,
    juego: 'vom',
    hoy: { frase: r1.statement, verdad: r1.odd === 0, tema: r1.topic, materia_key: r1.materia },
    ayer: null,
    extra,
  };
  const prev = await vomExistente(addDays(fecha, -1));
  const prevC = prev && (await reto(addDays(fecha, -1)));
  if (prev && prev[0] && prevC) {
    const cf = await api('rpc/arcade_vom_cifras', { method: 'POST', body: { p_date: prevC.challenge_date } });
    const pct = cf && cf.players >= MIN_JUGADORES ? cf.per_round[0] : null;
    data.ayer = {
      numero: prevC.number,
      frase: prev[0].statement,
      verdad: prev[0].is_true,
      motivo: prev[0].explanation,
      porcentaje: pct === null ? null : Number(pct),
    };
  }
  return data;
}

export async function loadFromSupabase(fecha, parte, { hoyMexico, log = () => {} } = {}) {
  let c = await reto(fecha);
  if (!c && fecha === hoyMexico) {
    await api('rpc/arcade_reto', { method: 'POST', body: {} });
    c = await reto(fecha);
  }
  if (!c) throw new Error(`No hay reto programado para ${fecha}. Llena el calendario con arcade_llenar_calendario().`);

  const m = MATERIAS[c.materia] || MATERIAS.historia;
  const base = { fecha: c.challenge_date, numero: c.number, materia_key: MATERIAS[c.materia] ? c.materia : 'historia', materia: m.materia, materia_corta: m.corta, reto_titulo: m.titulo };

  const vom = await loadVom(fecha, parte, base, log);
  if (vom) {
    log('  juego: Verdadero o mentira');
    return vom;
  }
  log('  juego: ¿Cuál sobra? (al día le faltan frases de Verdadero o mentira)');
  const mapa = await rondas(c.round_ids);
  const delDia = c.round_ids.map(id => mapa.get(id));
  if (delDia.some(r => !r)) throw new Error(`El reto #${c.number} apunta a una ronda que ya no existe`);

  if (parte === 'noche') {
    const cf = await cifras(fecha);
    const jugadores = cf?.players ?? 0;
    if (jugadores < MIN_JUGADORES) return { ...base, sinResultados: true, jugadores };
    let peor = -1;
    cf.per_round.forEach((p, i) => { if (p !== null && (peor < 0 || p < cf.per_round[peor])) peor = i; });
    return {
      ...base,
      resultados: { porcentaje: Number(cf.per_round[peor]), tema: delDia[peor].topic.name, jugadores },
    };
  }

  const r1 = delDia[0];
  const data = {
    ...base,
    hoy: { opciones: r1.options, sobra: r1.odd_index, tema: r1.topic.name, materia_key: r1.materia },
    ayer: null,
  };

  const prev = await reto(addDays(fecha, -1));
  if (prev) {
    const p1 = (await rondas([prev.round_ids[0]])).get(prev.round_ids[0]);
    const cf = await cifras(prev.challenge_date);
    const pct = cf && cf.players >= MIN_JUGADORES ? cf.per_round[0] : null;
    data.ayer = {
      numero: prev.number,
      opciones: p1.options,
      sobra: p1.odd_index,
      motivo: motivoCorto(p1.explanation),
      porcentaje: pct === null ? null : Number(pct),
    };
  }

  data.extra = await rondaExtra(fecha, new Set(c.round_ids), base.materia_key, log);
  return data;
}
