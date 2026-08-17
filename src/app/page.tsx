import type { Metadata } from 'next'
import LandingClient from './landing-client'
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
  description: `Guías de estudio gamificadas para estudiantes mexicanos. Aprende Matemáticas con Minecraft, Historia con Anime, Química con K-pop. ${PRECIO_DESDE}.`,
  openGraph: {
    title: 'Pasas.mx — Estudia sin estudiar',
    description: `Aprende con lo que ya te gusta. Matemáticas con Minecraft. Historia con Anime. ${PRECIO_DESDE}.`,
    url: 'https://pasas.mx',
    siteName: 'Pasas.mx',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pasas.mx — Estudia sin estudiar',
    description: `Aprende con lo que ya te gusta. Matemáticas con Minecraft. Historia con Anime. ${PRECIO_DESDE}.`,
  },
}

export default function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ utm_source?: string }>
}) {
  return <LandingClient />
}
