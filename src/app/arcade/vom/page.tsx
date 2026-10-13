import type { Metadata } from 'next'
import ContenidoArcade from '../contenido'

/**
 * /arcade/vom — "Verdadero o mentira" (s47). No se enlaza directo:
 * next.config.ts reescribe aquí /arcade?juego=vom, así el link que comparten
 * los anuncios y los reels sigue siendo /arcade y conserva sus UTM.
 * Si el juego no se puede armar hoy (faltan frases), sale "¿Cuál sobra?".
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: '¿Verdadero o mentira? · Reto diario | PASAS',
  description: 'Cinco frases, dos minutos. ¿Verdad o mentira? Cada día una materia: historia, biología, geografía, química y física y español.',
  alternates: { canonical: '/arcade' },
  robots: { index: false, follow: true },
}

export default function RetoVom() {
  return <ContenidoArcade juego="vom" />
}
