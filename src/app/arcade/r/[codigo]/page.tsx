import type { Metadata } from 'next'
import { RONDAS_POR_RETO, leerCodigo } from '@/lib/arcade'
import ContenidoArcade from '../../contenido'

/**
 * /arcade/r/[codigo] — el link que se comparte al terminar ("12-11011").
 *
 * Sirve el mismo reto de hoy que /arcade; lo único que cambia es la vista
 * previa (./opengraph-image.tsx), que muestra el puntaje de quien lo mandó.
 * No es indexable y su canonical es /arcade: son variantes de la misma página.
 */
export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>
}): Promise<Metadata> {
  const { codigo } = await params
  const leido = leerCodigo(codigo)
  const n = leido ? leido.resultados.filter(Boolean).length : null
  const titulo =
    n === null
      ? '¿Cuál sobra? · Reto diario de Historia'
      : `Saqué ${n}/${RONDAS_POR_RETO} en el reto de historia de hoy`
  const descripcion = 'Cinco rondas, dos minutos. Tres tienen algo en común y una no. ¿Cuál sobra?'

  return {
    title: `${titulo} | PASAS`,
    description: descripcion,
    alternates: { canonical: '/arcade' },
    robots: { index: false, follow: true },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: `/arcade/r/${codigo}`,
      siteName: 'Pasas.mx',
      locale: 'es_MX',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion },
  }
}

export default function ResultadoCompartido() {
  return <ContenidoArcade />
}
