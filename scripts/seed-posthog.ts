/**
 * seed-posthog.ts — crea insights y dashboards en PostHog, una sola vez.
 *
 * Se corre A MANO:
 *     npx tsx scripts/seed-posthog.ts
 *     npx tsx scripts/seed-posthog.ts --dry-run
 *
 * 🔴 NO va en el build ni en un hook de deploy. Crea objetos en un servicio
 * externo: eso no puede pasar en cada push.
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────
 * Armar URLs de PostHog a mano con los filtros codificados en el hash es
 * fragil: ese formato no esta documentado y cambia entre versiones. Aqui
 * los insights se crean con `saved: true` y se guarda su `short_id`, que
 * es estable. El admin enlaza a /insights/<short_id>.
 *
 * ── FORMA DE LA API, VERIFICADA CONTRA EL PROYECTO REAL (18-ago-2026) ──
 *   · Host: https://us.posthog.com  (la key da 401 en eu.posthog.com)
 *   · Formato MODERNO: `query` con InsightVizNode envolviendo
 *     TrendsQuery/FunnelsQuery/RetentionQuery/LifecycleQuery.
 *     El campo `filters` esta vacio en todos los insights: es legacy.
 *   · El filtro de cuentas de prueba se llama `filterTestAccounts`,
 *     camelCase, DENTRO de `query.source`. NO es `filter_test_accounts`
 *     arriba del todo.
 *   · Breakdown: `breakdownFilter: { breakdown, breakdown_type }`.
 *   · `?search=` funciona en insights y en dashboards.
 *   · Un insight se asocia a un dashboard con el array `dashboards` de
 *     nivel superior.
 *
 * 🔴 `POST /insights/` con body vacio CREA un insight sin nombre — no
 *    valida. Se descubrio usandolo como sonda de permisos y hubo que
 *    borrarlo. NO usar POST para comprobar scopes: para eso estan las
 *    lecturas del preflight.
 *
 * 🔴 BORRADO: `DELETE /insights/:id/` devuelve 405. PostHog usa borrado
 *    suave: `PATCH /insights/:id/ { "deleted": true }`.
 *
 * ── EL FILTRO DE CUENTAS DE PRUEBA ────────────────────────────────────
 * `filterTestAccounts: true` no sirve de nada por si solo: se apoya en
 * los "test account filters" del PROYECTO. Este script los configura
 * contra la propiedad de persona `is_test`, que manda
 * posthog-provider.tsx desde `users.is_test` (migracion 045).
 *
 * 🔴 SI ALGUIEN RECREA EL PROYECTO DE POSTHOG, ESE FILTRO HAY QUE VOLVER
 *    A PONERLO. Sin el, los 26 insights siguen existiendo y todos mienten:
 *    25 de 28 cuentas son de prueba.
 */

import { writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─────────────────────────────────────────────────────────────────────
// Entorno
// ─────────────────────────────────────────────────────────────────────

function cargarEnvLocal() {
  try {
    const texto = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const linea of texto.split('\n')) {
      const m = linea.match(/^([A-Z_0-9]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch {
    // Sin .env.local se usan las variables del entorno. En Vercel es lo normal.
  }
}
cargarEnvLocal()

const HOST = 'https://us.posthog.com'
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const DRY_RUN = process.argv.includes('--dry-run')

/**
 * 🔴 La personal API key NUNCA lleva NEXT_PUBLIC_: da acceso de ESCRITURA
 * a todo el proyecto. Con el prefijo acabaria inlineada en el bundle del
 * navegador y cualquiera podria borrar los dashboards.
 */
if (!API_KEY || !PROJECT_ID) {
  console.error('\n❌ Faltan variables de entorno.\n')
  if (!API_KEY) console.error('   POSTHOG_PERSONAL_API_KEY  (SIN prefijo NEXT_PUBLIC_)')
  if (!PROJECT_ID) console.error('   POSTHOG_PROJECT_ID')
  console.error('\nPonlas en .env.local. No se ha creado nada.\n')
  process.exit(1)
}

const BASE = `${HOST}/api/projects/${PROJECT_ID}`

async function api<T>(ruta: string, init?: RequestInit): Promise<{ ok: boolean; status: number; datos: T }> {
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const datos = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, datos }
}

// ─────────────────────────────────────────────────────────────────────
// Constructores de query. Un solo sitio donde vive la forma del payload.
// ─────────────────────────────────────────────────────────────────────

type Serie = { event: string; nombre?: string; math?: string }

/** `filterTestAccounts: true` en TODOS. Ver la nota del encabezado. */
function trends(series: Serie[], opciones: { breakdown?: string; dias?: string; display?: string } = {}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'TrendsQuery',
      series: series.map((s) => ({
        kind: 'EventsNode',
        event: s.event,
        name: s.event,
        ...(s.nombre ? { custom_name: s.nombre } : {}),
        ...(s.math ? { math: s.math } : {}),
      })),
      interval: 'day',
      dateRange: { date_from: opciones.dias ?? '-30d' },
      filterTestAccounts: true,
      ...(opciones.breakdown
        ? { breakdownFilter: { breakdown: opciones.breakdown, breakdown_type: 'event' } }
        : {}),
      trendsFilter: { display: opciones.display ?? 'ActionsLineGraph' },
    },
  }
}

function funnel(series: Serie[], opciones: { breakdown?: string; dias?: string } = {}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'FunnelsQuery',
      series: series.map((s) => ({
        kind: 'EventsNode',
        event: s.event,
        name: s.event,
        ...(s.nombre ? { custom_name: s.nombre } : {}),
      })),
      interval: 'day',
      dateRange: { date_from: opciones.dias ?? '-30d' },
      filterTestAccounts: true,
      funnelsFilter: { funnelVizType: 'steps', funnelOrderType: 'ordered', funnelWindowInterval: 14, funnelWindowIntervalUnit: 'day' },
      ...(opciones.breakdown
        ? { breakdownFilter: { breakdown: opciones.breakdown, breakdown_type: 'event' } }
        : {}),
    },
  }
}

function retencion(evento: string, dias = '-90d') {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'RetentionQuery',
      dateRange: { date_from: dias },
      filterTestAccounts: true,
      retentionFilter: {
        period: 'Day',
        retentionType: 'retention_first_time',
        totalIntervals: 30,
        targetEntity: { id: evento, name: evento, type: 'events' },
        returningEntity: { id: evento, name: evento, type: 'events' },
      },
    },
  }
}

function lifecycle(evento: string) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'LifecycleQuery',
      series: [{ kind: 'EventsNode', event: evento, name: evento }],
      interval: 'week',
      dateRange: { date_from: '-90d' },
      filterTestAccounts: true,
    },
  }
}

function stickiness(evento: string) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'StickinessQuery',
      series: [{ kind: 'EventsNode', event: evento, name: evento }],
      interval: 'week',
      dateRange: { date_from: '-90d' },
      filterTestAccounts: true,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────
// Definiciones
//
// 🔴 Los nombres de evento salen del codigo, no de un documento: se
// auditaron contra `grep track\(` y `grep trackServer\(` sobre src/.
// ─────────────────────────────────────────────────────────────────────

const PREFIJO = 'Pasas · '

const DASHBOARDS = {
  adquisicion: `${PREFIJO}Adquisición`,
  pago: `${PREFIJO}Embudo de pago`,
  uso: `${PREFIJO}Uso`,
  contenido: `${PREFIJO}Contenido`,
  retencion: `${PREFIJO}Retención`,
  errores: `${PREFIJO}Errores`,
} as const

type ClaveDashboard = keyof typeof DASHBOARDS

type DefInsight = { clave: string; nombre: string; dashboard: ClaveDashboard; query: unknown; descripcion?: string }

const INSIGHTS: DefInsight[] = [
  // ── ADQUISICIÓN ──────────────────────────────────────────────────
  {
    clave: 'embudoLanding', dashboard: 'adquisicion',
    nombre: `${PREFIJO}Embudo landing → registro`,
    query: funnel([
      { event: 'hero_variant_seen' }, { event: 'landing_cta_clicked' },
      { event: 'signup_start' }, { event: 'signup_completado' },
    ]),
  },
  {
    clave: 'abHero', dashboard: 'adquisicion',
    nombre: `${PREFIJO}A/B del hero`,
    descripcion: 'Mismo embudo, partido por la variante D/E/PAPA.',
    query: funnel([
      { event: 'hero_variant_seen' }, { event: 'landing_cta_clicked' },
      { event: 'signup_start' }, { event: 'signup_completado' },
    ], { breakdown: 'variant' }),
  },
  {
    clave: 'seccionesVistas', dashboard: 'adquisicion',
    nombre: `${PREFIJO}Secciones de la landing vistas`,
    query: trends([{ event: 'landing_section_seen' }], { breakdown: 'section', display: 'ActionsBarValue' }),
  },
  {
    clave: 'scrollDepth', dashboard: 'adquisicion',
    nombre: `${PREFIJO}Scroll depth de la landing`,
    query: trends([{ event: 'landing_scroll_depth' }], { breakdown: 'percent', display: 'ActionsBarValue' }),
  },
  {
    clave: 'demoConversion', dashboard: 'adquisicion',
    nombre: `${PREFIJO}Demo jugable → registro`,
    descripcion: 'Quien toca el demo. Comparar contra el embudo sin demo.',
    query: funnel([{ event: 'demo_iniciado' }, { event: 'landing_cta_clicked' }, { event: 'signup_start' }]),
  },
  {
    clave: 'sinDemoConversion', dashboard: 'adquisicion',
    nombre: `${PREFIJO}Landing → registro (sin demo)`,
    descripcion: 'Contraparte del anterior: la diferencia mide lo que aporta el demo.',
    query: funnel([{ event: 'landing_cta_clicked' }, { event: 'signup_start' }]),
  },
  {
    clave: 'ctasLanding', dashboard: 'adquisicion',
    nombre: `${PREFIJO}CTAs de la landing`,
    query: trends([{ event: 'landing_cta_clicked' }], { breakdown: 'location', display: 'ActionsBarValue' }),
  },

  // ── EMBUDO DE PAGO ───────────────────────────────────────────────
  {
    clave: 'embudoPago', dashboard: 'pago',
    nombre: `${PREFIJO}Embudo de pago`,
    query: funnel([
      { event: 'signup_completado' }, { event: 'onboarding_completo' },
      { event: 'planes_vistos' }, { event: 'checkout_iniciado' }, { event: 'pago_exitoso' },
    ]),
  },
  {
    clave: 'pagoPorCamino', dashboard: 'pago',
    nombre: `${PREFIJO}Embudo de pago por camino`,
    descripcion: 'planes | bienvenida | registro_directo — las tres puertas de cobro.',
    query: funnel([
      { event: 'signup_completado' }, { event: 'onboarding_completo' },
      { event: 'planes_vistos' }, { event: 'checkout_iniciado' }, { event: 'pago_exitoso' },
    ], { breakdown: 'camino' }),
  },
  {
    clave: 'pagoPorCanal', dashboard: 'pago',
    nombre: `${PREFIJO}Conversión por canal`,
    query: funnel([
      { event: 'signup_start' }, { event: 'signup_completado' },
      { event: 'checkout_iniciado' }, { event: 'pago_exitoso' },
    ], { breakdown: 'utm_source' }),
  },
  {
    clave: 'pagoPorPromo', dashboard: 'pago',
    nombre: `${PREFIJO}Conversión por promoción`,
    query: funnel([
      { event: 'checkout_iniciado' }, { event: 'pago_exitoso' },
    ], { breakdown: 'promo_slug' }),
  },
  {
    clave: 'cancelacionDiaCiclo', dashboard: 'pago',
    nombre: `${PREFIJO}Cancelación por día del ciclo`,
    descripcion: 'Cerca de 0 = arrepentimiento. Cerca del final = decisión. Dos problemas distintos.',
    query: trends([{ event: 'cancelacion_completada' }], { breakdown: 'dia_del_ciclo', dias: '-90d', display: 'ActionsBarValue' }),
  },

  // ── USO ──────────────────────────────────────────────────────────
  { clave: 'retencionTema', dashboard: 'uso', nombre: `${PREFIJO}Retención D1/D7/D30`, query: retencion('tema_abierto') },
  { clave: 'lifecycle', dashboard: 'uso', nombre: `${PREFIJO}Lifecycle de alumnos`, query: lifecycle('tema_abierto') },
  { clave: 'stickiness', dashboard: 'uso', nombre: `${PREFIJO}Stickiness semanal`, query: stickiness('tema_abierto') },
  {
    clave: 'pistas', dashboard: 'uso',
    nombre: `${PREFIJO}Pistas pedidas`,
    descripcion: 'Solo el botón: las pistas reveladas al fallar NO cuentan como pedidas.',
    query: trends([{ event: 'pista_pedida' }], { breakdown: 'n_pista', display: 'ActionsBarValue' }),
  },
  {
    clave: 'hordaOleada', dashboard: 'uso',
    nombre: `${PREFIJO}Horda por oleada`,
    query: trends([{ event: 'horda_oleada' }], { breakdown: 'oleada', display: 'ActionsBarValue' }),
  },
  {
    clave: 'hordaResultado', dashboard: 'uso',
    nombre: `${PREFIJO}Horda por resultado`,
    descripcion: 'avanza | repite | reinicia. No hay derrota: reiniciar no termina la partida.',
    query: trends([{ event: 'horda_oleada' }], { breakdown: 'resultado', display: 'ActionsBarValue' }),
  },
  {
    clave: 'audio', dashboard: 'uso',
    nombre: `${PREFIJO}Audio escuchado`,
    query: trends([{ event: 'audio_progreso' }], { breakdown: 'pct', display: 'ActionsBarValue' }),
  },

  // ── CONTENIDO ────────────────────────────────────────────────────
  {
    clave: 'temasAbiertos', dashboard: 'contenido',
    nombre: `${PREFIJO}Temas más abiertos`,
    query: trends([{ event: 'tema_abierto' }], { breakdown: 'topic', display: 'ActionsBarValue' }),
  },
  {
    clave: 'interactivosAbandonados', dashboard: 'contenido',
    nombre: `${PREFIJO}Interactivos abandonados`,
    query: trends([{ event: 'interactivo_abandonado' }], { breakdown: 'tipo', display: 'ActionsBarValue' }),
  },
  {
    clave: 'sortsFallidos', dashboard: 'contenido',
    nombre: `${PREFIJO}Sorts fallidos`,
    descripcion: 'El sort solo completa si se acierta: quien falla no gana XP y la sección no se marca leída.',
    query: trends([{ event: 'sort_fallido' }], { breakdown: 'topic', display: 'ActionsBarValue' }),
  },
  {
    clave: 'solicitudesTema', dashboard: 'contenido',
    nombre: `${PREFIJO}Solicitudes de tema`,
    query: trends([{ event: 'solicitar_tema_click' }], { breakdown: 'materia', display: 'ActionsBarValue' }),
  },

  // ── RETENCIÓN ────────────────────────────────────────────────────
  { clave: 'retencionCohorte', dashboard: 'retencion', nombre: `${PREFIJO}Retención por cohorte de alta`, query: retencion('signup_completado') },
  {
    clave: 'activacion', dashboard: 'retencion',
    nombre: `${PREFIJO}Activación`,
    descripcion: 'primera_sesion → activado. Ambos de servidor.',
    query: funnel([{ event: 'primera_sesion' }, { event: 'activado' }]),
  },
  {
    clave: 'rachasRotas', dashboard: 'retencion',
    nombre: `${PREFIJO}Rachas rotas`,
    query: trends([{ event: 'racha_rota' }], { breakdown: 'dias_perdidos', dias: '-90d', display: 'ActionsBarValue' }),
  },

  // ── ERRORES ──────────────────────────────────────────────────────
  {
    clave: 'erroresPorTipo', dashboard: 'errores',
    nombre: `${PREFIJO}Errores por tipo`,
    query: trends([{ event: 'error_occurred' }], { breakdown: 'error_type', dias: '-14d', display: 'ActionsBarValue' }),
  },
  {
    clave: 'erroresPorRuta', dashboard: 'errores',
    nombre: `${PREFIJO}Errores por ruta`,
    query: trends([{ event: 'error_occurred' }], { breakdown: 'ruta', dias: '-14d', display: 'ActionsBarValue' }),
  },
  {
    clave: 'hordaErrores', dashboard: 'errores',
    nombre: `${PREFIJO}Errores de Horda`,
    descripcion: 'Fallo de producto, no desenlace de juego.',
    query: trends([{ event: 'horda_error' }], { dias: '-14d' }),
  },
]

// ─────────────────────────────────────────────────────────────────────
// Preflight: se comprueba TODO antes de crear NADA.
// ─────────────────────────────────────────────────────────────────────

type Lista<T> = { count: number; results: T[] }

async function preflight() {
  console.log(`\n🔎 Preflight contra ${HOST} (proyecto ${PROJECT_ID})\n`)
  const fallos: string[] = []

  for (const [etiqueta, ruta] of [
    ['insight:read', '/insights/?limit=1'],
    ['dashboard:read', '/dashboards/?limit=1'],
    ['project:read', '/'],
  ] as const) {
    const r = await api<{ detail?: string }>(ruta)
    if (r.ok) console.log(`   ✅ ${etiqueta}`)
    else {
      console.log(`   ❌ ${etiqueta} — HTTP ${r.status} ${r.datos?.detail ?? ''}`)
      fallos.push(etiqueta)
    }
  }

  if (fallos.length) {
    console.error(`\n❌ Faltan scopes en la personal API key: ${fallos.join(', ')}`)
    console.error('   PostHog → Settings → Personal API keys → Edit → añade los scopes.')
    console.error('   NO se ha creado nada.\n')
    process.exit(1)
  }
  console.log('')
}

// ─────────────────────────────────────────────────────────────────────
// Idempotencia
// ─────────────────────────────────────────────────────────────────────

/**
 * Busca por nombre EXACTO. `?search=` hace coincidencia parcial, asi que
 * el resultado se filtra despues por igualdad estricta.
 *
 * 🔴 Si hay dos con el mismo nombre, se DETIENE. Elegir uno al azar
 * dejaria el `posthog-links.ts` apuntando a un insight que quiza no es el
 * que se edito, y nadie lo notaria hasta ver un dashboard con datos raros.
 */
async function buscarExacto<T extends { name?: string | null }>(
  recurso: 'insights' | 'dashboards',
  nombre: string
): Promise<T[]> {
  const r = await api<Lista<T>>(`/${recurso}/?search=${encodeURIComponent(nombre)}&limit=100`)
  if (!r.ok) throw new Error(`Fallo buscando en ${recurso}: HTTP ${r.status}`)
  return (r.datos.results ?? []).filter((x) => x.name === nombre)
}

type Dashboard = { id: number; name?: string | null }
type Insight = { id: number; short_id: string; name?: string | null }

async function asegurarDashboard(nombre: string, creados: string[]): Promise<Dashboard> {
  const existentes = await buscarExacto<Dashboard>('dashboards', nombre)
  if (existentes.length > 1) {
    throw new Error(`DUPLICADO: ${existentes.length} dashboards se llaman ${JSON.stringify(nombre)} (ids ${existentes.map((d) => d.id).join(', ')}). Resuélvelo a mano.`)
  }
  if (existentes.length === 1) {
    console.log(`   = ${nombre}  (id ${existentes[0].id})`)
    return existentes[0]
  }
  if (DRY_RUN) {
    console.log(`   + ${nombre}  (dry-run, no creado)`)
    return { id: -1, name: nombre }
  }
  const r = await api<Dashboard>('/dashboards/', { method: 'POST', body: JSON.stringify({ name: nombre, pinned: true }) })
  if (!r.ok) throw new Error(`No se pudo crear el dashboard ${nombre}: HTTP ${r.status} ${JSON.stringify(r.datos)}`)
  console.log(`   + ${nombre}  (id ${r.datos.id})  NUEVO`)
  creados.push(nombre)
  return r.datos
}

async function asegurarInsight(def: DefInsight, dashboardId: number, creados: string[]): Promise<Insight> {
  const existentes = await buscarExacto<Insight>('insights', def.nombre)
  if (existentes.length > 1) {
    throw new Error(`DUPLICADO: ${existentes.length} insights se llaman ${JSON.stringify(def.nombre)} (short_ids ${existentes.map((i) => i.short_id).join(', ')}). Resuélvelo a mano.`)
  }
  if (existentes.length === 1) {
    console.log(`   = ${def.nombre}  (${existentes[0].short_id})`)
    return existentes[0]
  }
  if (DRY_RUN) {
    console.log(`   + ${def.nombre}  (dry-run, no creado)`)
    return { id: -1, short_id: 'DRY_RUN', name: def.nombre }
  }
  const r = await api<Insight>('/insights/', {
    method: 'POST',
    body: JSON.stringify({
      name: def.nombre,
      description: def.descripcion ?? '',
      query: def.query,
      saved: true,
      dashboards: dashboardId > 0 ? [dashboardId] : [],
    }),
  })
  if (!r.ok) throw new Error(`No se pudo crear el insight ${def.nombre}: HTTP ${r.status} ${JSON.stringify(r.datos)}`)
  console.log(`   + ${def.nombre}  (${r.datos.short_id})  NUEVO`)
  creados.push(def.nombre)
  return r.datos
}

/**
 * Test account filters del PROYECTO.
 *
 * Sin esto, `filterTestAccounts: true` de los 26 insights no excluye a
 * NADIE. Filtra por la propiedad de persona `is_test`, que manda
 * posthog-provider.tsx desde `users.is_test`.
 */
async function configurarFiltroDePrueba() {
  const filtro = [{ key: 'is_test', value: ['true'], operator: 'is_not', type: 'person' }]
  if (DRY_RUN) {
    console.log('   (dry-run) test_account_filters →', JSON.stringify(filtro))
    return
  }
  const r = await api<{ test_account_filters?: unknown; detail?: string }>('/', {
    method: 'PATCH',
    body: JSON.stringify({ test_account_filters: filtro }),
  })
  if (!r.ok) throw new Error(`No se pudo configurar test_account_filters: HTTP ${r.status} ${r.datos?.detail ?? ''}`)
  console.log('   ✅ test_account_filters → excluye personas con is_test = true')
}

// ─────────────────────────────────────────────────────────────────────
// Salida: src/lib/analytics/posthog-links.ts
// ─────────────────────────────────────────────────────────────────────

function escribirLinks(dashboards: Record<string, number>, insights: Record<string, string>) {
  const lineasD = Object.entries(dashboards)
    .map(([k, id]) => `  ${k}: '${HOST}/project/${PROJECT_ID}/dashboard/${id}',`)
    .join('\n')
  const lineasI = Object.entries(insights)
    .map(([k, sid]) => `  ${k}: '${HOST}/project/${PROJECT_ID}/insights/${sid}',`)
    .join('\n')

  const contenido = `/**
 * URLs de PostHog. GENERADO por scripts/seed-posthog.ts — no editar a mano.
 *
 * Los \`short_id\` son estables: se crean una vez y no cambian aunque se
 * edite el insight. Por eso se guardan aqui en vez de armar URLs con los
 * filtros codificados en el hash, que es un formato sin documentar y que
 * cambia entre versiones de PostHog.
 *
 * Para regenerar:  npx tsx scripts/seed-posthog.ts
 */

export const POSTHOG_DASHBOARDS = {
${lineasD}
} as const

export const POSTHOG_INSIGHTS = {
${lineasI}
} as const

export type DashboardPostHog = keyof typeof POSTHOG_DASHBOARDS
export type InsightPostHog = keyof typeof POSTHOG_INSIGHTS
`
  const ruta = resolve(process.cwd(), 'src/lib/analytics/posthog-links.ts')
  writeFileSync(ruta, contenido)
  console.log(`\n📝 Escrito src/lib/analytics/posthog-links.ts (${Object.keys(insights).length} insights, ${Object.keys(dashboards).length} dashboards)`)
}

// ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('\n🧪 DRY RUN — no se crea ni se modifica nada\n')
  await preflight()

  const creados: string[] = []
  const idsDashboard: Record<string, number> = {}
  const shortIds: Record<string, string> = {}

  console.log('📊 Dashboards')
  for (const [clave, nombre] of Object.entries(DASHBOARDS)) {
    idsDashboard[clave] = (await asegurarDashboard(nombre, creados)).id
  }

  console.log('\n📈 Insights')
  for (const def of INSIGHTS) {
    const insight = await asegurarInsight(def, idsDashboard[def.dashboard], creados)
    shortIds[def.clave] = insight.short_id
  }

  console.log('\n🧪 Filtro de cuentas de prueba')
  await configurarFiltroDePrueba()

  if (!DRY_RUN) escribirLinks(idsDashboard, shortIds)

  console.log(`\n✅ Listo. ${creados.length} objetos nuevos, ${Object.keys(DASHBOARDS).length + INSIGHTS.length - creados.length} ya existían.\n`)
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
