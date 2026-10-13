import type { Metadata } from 'next'
import ContenidoArcade from '../../../contenido'
import { normalizarMateria } from '@/lib/arcade/alias-materia'

/**
 * /arcade/vom/materia/[materia] — "Verdadero o mentira" del reto más reciente
 * de una materia (s47). Llega aquí /arcade?juego=vom&materia=historia
 * (next.config.ts): el anuncio de Verdadero o mentira de Historia.
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: '¿Verdadero o mentira? · Reto diario | PASAS',
  description: 'Cinco frases, dos minutos. ¿Verdad o mentira? Cada día una materia: historia, biología, geografía, química y física y español.',
  alternates: { canonical: '/arcade' },
  robots: { index: false, follow: true },
}

export default async function RetoVomDeMateria({ params }: { params: Promise<{ materia: string }> }) {
  const { materia } = await params
  return <ContenidoArcade juego="vom" materia={normalizarMateria(materia)} />
}
