/**
 * URLs de PostHog. GENERADO por scripts/seed-posthog.ts — no editar a mano.
 *
 * Los `short_id` son estables: se crean una vez y no cambian aunque se
 * edite el insight. Por eso se guardan aqui en vez de armar URLs con los
 * filtros codificados en el hash, que es un formato sin documentar y que
 * cambia entre versiones de PostHog.
 *
 * Para regenerar:  npx tsx scripts/seed-posthog.ts
 */

export const POSTHOG_DASHBOARDS = {
  adquisicion: 'https://us.posthog.com/project/419205/dashboard/2007776',
  pago: 'https://us.posthog.com/project/419205/dashboard/2007777',
  uso: 'https://us.posthog.com/project/419205/dashboard/2007778',
  contenido: 'https://us.posthog.com/project/419205/dashboard/2007779',
  retencion: 'https://us.posthog.com/project/419205/dashboard/2007780',
  errores: 'https://us.posthog.com/project/419205/dashboard/2007781',
} as const

export const POSTHOG_INSIGHTS = {
  embudoLanding: 'https://us.posthog.com/project/419205/insights/BBQJe2jt',
  abHero: 'https://us.posthog.com/project/419205/insights/Ol3nLiru',
  seccionesVistas: 'https://us.posthog.com/project/419205/insights/hdNftsJV',
  scrollDepth: 'https://us.posthog.com/project/419205/insights/MIuCcCae',
  demoConversion: 'https://us.posthog.com/project/419205/insights/qqgrOwfP',
  sinDemoConversion: 'https://us.posthog.com/project/419205/insights/hxa6r4oU',
  ctasLanding: 'https://us.posthog.com/project/419205/insights/lBWu87ec',
  embudoPago: 'https://us.posthog.com/project/419205/insights/dfxoPtR8',
  pagoPorCamino: 'https://us.posthog.com/project/419205/insights/CfAO2jkF',
  pagoPorCanal: 'https://us.posthog.com/project/419205/insights/9i5R9JY7',
  pagoPorPromo: 'https://us.posthog.com/project/419205/insights/ANBk1EoZ',
  cancelacionDiaCiclo: 'https://us.posthog.com/project/419205/insights/aoxW3QVV',
  retencionTema: 'https://us.posthog.com/project/419205/insights/dznIJfQb',
  lifecycle: 'https://us.posthog.com/project/419205/insights/n5fjVkj0',
  stickiness: 'https://us.posthog.com/project/419205/insights/vPo2dwbB',
  pistas: 'https://us.posthog.com/project/419205/insights/xLLF1ked',
  hordaOleada: 'https://us.posthog.com/project/419205/insights/ogAGNvWS',
  hordaResultado: 'https://us.posthog.com/project/419205/insights/lxPl5Ymq',
  audio: 'https://us.posthog.com/project/419205/insights/JnCslgSg',
  temasAbiertos: 'https://us.posthog.com/project/419205/insights/yLeufH98',
  interactivosAbandonados: 'https://us.posthog.com/project/419205/insights/9i9RZf0q',
  sortsFallidos: 'https://us.posthog.com/project/419205/insights/he9AMwtx',
  solicitudesTema: 'https://us.posthog.com/project/419205/insights/ESwawHxd',
  retencionCohorte: 'https://us.posthog.com/project/419205/insights/GZI8SwED',
  activacion: 'https://us.posthog.com/project/419205/insights/Mx3cNGuS',
  rachasRotas: 'https://us.posthog.com/project/419205/insights/a78Y9UAN',
  erroresPorTipo: 'https://us.posthog.com/project/419205/insights/fDxvMgRA',
  erroresPorRuta: 'https://us.posthog.com/project/419205/insights/CTAuj44H',
  hordaErrores: 'https://us.posthog.com/project/419205/insights/WqtHfwRb',
} as const

export type DashboardPostHog = keyof typeof POSTHOG_DASHBOARDS
export type InsightPostHog = keyof typeof POSTHOG_INSIGHTS
