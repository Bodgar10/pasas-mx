import type { Metadata } from 'next'
import LandingClient from './landing-client'

export const metadata: Metadata = {
  title: 'Pasas.mx — Estudia sin estudiar',
  description: 'Guías de estudio gamificadas para estudiantes mexicanos. Aprende Matemáticas con Minecraft, Historia con Anime, Química con K-pop. Desde $199/mes.',
  openGraph: {
    title: 'Pasas.mx — Estudia sin estudiar',
    description: 'Aprende con lo que ya te gusta. Matemáticas con Minecraft. Historia con Anime. Desde $199/mes.',
    url: 'https://pasas.mx',
    siteName: 'Pasas.mx',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pasas.mx — Estudia sin estudiar',
    description: 'Aprende con lo que ya te gusta. Matemáticas con Minecraft. Historia con Anime. Desde $199/mes.',
  },
}

export default function LandingPage() {
  return <LandingClient />
}
