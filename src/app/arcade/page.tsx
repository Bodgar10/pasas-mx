import type { Metadata } from 'next'
import ContenidoArcade from './contenido'

/**
 * PASAS Arcade — reto diario público, sin login.
 *
 * 🔴 ISR de 60 s y no estático: el reto cambia a medianoche de la Ciudad de
 * México. En el peor caso alguien ve el de ayer un minuto; la cuenta
 * regresiva del cliente recarga sola al llegar a cero.
 *
 * La imagen de vista previa sale de ./opengraph-image.tsx, que Next agrega
 * sola a og:image y twitter:image.
 */
export const revalidate = 60

const TITULO = '¿Cuál sobra? · Reto diario | PASAS'
const DESCRIPCION =
  'Cinco rondas, dos minutos. Tres cosas tienen algo en común y una no. Cada día una materia: historia, biología, geografía, química y física, español y un reto para papás.'

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: '/arcade' },
  openGraph: {
    title: '¿Cuál sobra? · Reto diario',
    description: DESCRIPCION,
    url: '/arcade',
    siteName: 'Pasas.mx',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '¿Cuál sobra? · Reto diario',
    description: DESCRIPCION,
  },
}

/**
 * s48 — pasas.mx/arcade (sin ?materia=) es "Verdadero o mentira": el juego de
 * los reels y las stories diarios. Si al día le faltan frases, sale
 * "¿Cuál sobra?". El anuncio actual (/arcade?materia=historia) sigue en
 * "¿Cuál sobra?" para la prueba A/B; el de vom lleva &juego=vom.
 */
export default function ArcadePage() {
  return <ContenidoArcade juego="vom" />
}
