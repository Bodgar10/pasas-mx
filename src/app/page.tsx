import type { Metadata } from 'next'
import LandingClient from './landing-client'
import { leerLandingStats, type LandingStats } from '@/lib/landing-stats'
import { detectAudience } from '@/lib/audience-detection'
import { PLAN_DISPLAY } from '@/lib/payments/config'

/**
 * 🔴 El precio de los metadata sale de PLAN_DISPLAY, nunca escrito a mano.
 * Estuvo tres meses diciendo "Desde $199/mes" mientras se cobraban $249:
 * Google, WhatsApp y Facebook anunciaban $199 cada vez que alguien compartía
 * el link.
 *
 * 🔴 Y NO lleva precio de promoción. Los metadata son estáticos, se generan en
 * build y se quedan cacheados en Google y en la vista previa de WhatsApp
 * durante semanas: sobrevivirían al apagado de la campaña y seguirían
 * prometiendo "$1" cuando ya no existe. La promo se anuncia dentro de la
 * página, que sí se resuelve en cada visita.
 */
const PRECIO_DESDE = `Desde $${PLAN_DISPLAY.estandar_v2.prices.mensual.amount}/mes`

export const metadata: Metadata = {
  title: 'Pasas.mx — Estudia sin estudiar',
  description: `Guías de estudio gamificadas para estudiantes mexicanos. Aprende Matemáticas con videojuegos, Historia con anime, Química con K-pop. ${PRECIO_DESDE}.`,
  // Relativo, no 'https://pasas.mx': lo resuelve el metadataBase del layout
  // raíz, que es el único sitio donde vive el dominio. Un dominio escrito a
  // mano aquí es un dominio que algún día no coincide con el de allá.
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Pasas.mx — Estudia sin estudiar',
    description: `Aprende con lo que ya te gusta. Matemáticas con videojuegos. Historia con anime. ${PRECIO_DESDE}.`,
    url: '/',
    siteName: 'Pasas.mx',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pasas.mx — Estudia sin estudiar',
    description: `Aprende con lo que ya te gusta. Matemáticas con videojuegos. Historia con anime. ${PRECIO_DESDE}.`,
  },
}

/**
 * 🔴 ISR, NO RENDER POR VISITA. La landing es la página más visitada del sitio
 * y hasta ahora era estática pura. Volverla dinámica habría hecho que TODO
 * visitante pagara el render —~250ms de RPC— solo para que nueve cifras
 * estuvieran frescas. Con `revalidate` sigue siendo HTML estático servido
 * desde CDN, y Next la regenera en segundo plano como mucho una vez por hora.
 *
 * 3600 y no menos porque estas cifras solo se mueven al generar contenido, que
 * es cosa de días, no de minutos. El mismo TTL que el unstable_cache de
 * leerLandingStats: las dos capas caducan juntas y no hay una sirviendo algo
 * más viejo que la otra.
 */
export const revalidate = 3600

/**
 * Valores de reserva si la lectura falla.
 *
 * 🔴 Son los ÚLTIMOS MEDIDOS (17 ago 2026), no ceros ni inventos: una landing
 * que dice "0 ejercicios" vende peor que una con cifras de la semana pasada.
 * Solo se usan si `landing_stats()` no responde durante una regeneración; el
 * error queda en los logs de leerLandingStats.
 */
const STATS_RESERVA: LandingStats = {
  materias: 65,
  temas: 579,
  horda_temas: 579,
  horda_preguntas: 17370,
  papel_lapiz: 2040,
  audios: 6234,
  memoramas: 1436,
  simuladores: 1073,
  secuencias: 2051,
  clasificaciones: 2328,
}

export default async function LandingPage() {
  const stats = (await leerLandingStats()) ?? STATS_RESERVA
  return <LandingClient stats={stats} />
}
