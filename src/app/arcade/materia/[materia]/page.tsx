import type { Metadata } from 'next'
import ContenidoArcade from '../../contenido'

/**
 * /arcade/materia/[materia] — el reto más reciente de una materia. s39.
 *
 * No se enlaza directo: next.config.ts reescribe aquí /arcade?materia=historia
 * (la URL que llevan los anuncios por materia), así el link sigue siendo
 * /arcade y conserva sus UTM. Quien llega de un anuncio de Historia juega
 * Historia aunque hoy toque otra materia; al terminar se le invita al de hoy.
 *
 * Misma vista previa y canonical que /arcade, y no indexable: es la misma
 * página con otro reto.
 */
export const revalidate = 60

/** Lo que puede venir en ?materia= → la clave de la base. Lo demás cae al reto de hoy. */
const ALIAS: Record<string, string> = {
  historia: 'historia',
  biologia: 'biologia',
  geografia: 'geografia',
  ciencias: 'ciencias',
  ciencia: 'ciencias',
  quimica: 'ciencias',
  fisica: 'ciencias',
  espanol: 'espanol',
  papas: 'papas',
  papa: 'papas',
}

function normalizar(crudo: string): string | null {
  let t = crudo
  try {
    t = decodeURIComponent(crudo)
  } catch {}
  const clave = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return ALIAS[clave] ?? null
}

export const metadata: Metadata = {
  title: '¿Cuál sobra? · Reto diario | PASAS',
  description:
    'Cinco rondas, dos minutos. Tres cosas tienen algo en común y una no. Cada día una materia: historia, biología, geografía, química y física, español y un reto para papás.',
  alternates: { canonical: '/arcade' },
  robots: { index: false, follow: true },
}

export default async function RetoDeMateria({ params }: { params: Promise<{ materia: string }> }) {
  const { materia } = await params
  return <ContenidoArcade materia={normalizar(materia)} />
}
