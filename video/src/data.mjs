// De dónde salen los datos del reto y cómo se validan antes de generar nada.
// Si algo no cuadra, se detiene con un error claro: nunca se genera un video roto.
import { readFile } from 'node:fs/promises';

// Mismo umbral que la página (/arcade, MIN_JUGADORES_CIFRAS): con menos
// jugadores un porcentaje no dice nada y no se presume.
export const MIN_JUGADORES = 20;

function fail(msg) { throw new Error(`Datos del reto inválidos: ${msg}`); }

function checkRound(r, name, { needsAnswer = true } = {}) {
  if (!r) fail(`falta "${name}"`);
  if (!Array.isArray(r.opciones) || r.opciones.length !== 4) fail(`"${name}.opciones" debe tener exactamente 4 opciones`);
  if (r.opciones.some(o => typeof o !== 'string' || !o.trim())) fail(`"${name}.opciones" tiene una opción vacía`);
  if (needsAnswer && ![0, 1, 2, 3].includes(r.sobra)) fail(`"${name}.sobra" debe ser 0, 1, 2 o 3`);
}

export function validate(data, parte) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha || '')) fail('"fecha" debe ser AAAA-MM-DD');
  if (!Number.isInteger(data.numero) || data.numero < 1) fail('"numero" debe ser un entero desde 1');
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

async function reto(fecha) {
  const rows = await api(`arcade_challenges?challenge_date=eq.${fecha}&select=challenge_date,number,round_ids`);
  return rows[0] || null;
}

async function rondas(ids) {
  if (!ids.length) return new Map();
  const rows = await api(`arcade_rounds?id=in.(${ids.join(',')})&select=id,options,odd_index,explanation,kind,status,topic:topics(name)`);
  return new Map(rows.map(r => [r.id, r]));
}

async function cifras(fecha) {
  return api('rpc/arcade_cifras', { method: 'POST', body: { p_date: fecha } });
}

function azar(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Ronda para el sticker de quiz. El sticker revela la respuesta, así que sale
// de retos que YA pasaron (su respuesta ya se vio en el juego), nunca de uno
// de hoy o futuro. Al principio no hay pasados: entonces una aprobada que no
// esté en ningún reto del calendario.
async function rondaExtra(fecha, excluir, log) {
  const todos = await api('arcade_challenges?select=challenge_date,round_ids');
  const pasados = todos.filter(c => c.challenge_date < fecha && c.challenge_date >= addDays(fecha, -180));
  const enCalendario = new Set(todos.flatMap(c => c.round_ids));
  let ids = pasados.flatMap(c => c.round_ids).filter(id => !excluir.has(id));
  if (!ids.length) {
    const aprobadas = await api('arcade_rounds?status=eq.aprobada&select=id');
    ids = aprobadas.map(r => r.id).filter(id => !enCalendario.has(id) && !excluir.has(id));
    if (ids.length) log('  aviso: aún no hay retos pasados; la ronda extra sale del banco sin programar');
  }
  if (!ids.length) throw new Error('No hay ninguna ronda disponible para la story de ronda extra');
  const r = (await rondas([azar(ids)])).values().next().value;
  return { opciones: r.options, sobra: r.odd_index, motivo: r.explanation };
}

export async function loadFromSupabase(fecha, parte, { hoyMexico, log = () => {} } = {}) {
  let c = await reto(fecha);
  if (!c && fecha === hoyMexico) {
    await api('rpc/arcade_reto', { method: 'POST', body: {} });
    c = await reto(fecha);
  }
  if (!c) throw new Error(`No hay reto programado para ${fecha}. Llena el calendario con arcade_llenar_calendario().`);

  const base = { fecha: c.challenge_date, numero: c.number, materia: 'Historia', materia_corta: 'Historia' };
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
    hoy: { opciones: r1.options, sobra: r1.odd_index, tema: r1.topic.name },
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

  data.extra = await rondaExtra(fecha, new Set(c.round_ids), log);
  return data;
}
