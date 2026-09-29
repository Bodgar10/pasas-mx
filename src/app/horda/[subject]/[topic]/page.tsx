import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { temaPorSlugs } from '@/lib/horda-publica-server'
import { OLEADAS_GRATIS, urlHordaPublica } from '@/lib/horda-publica'
import HordaPublicaClient from './horda-publica-client'

/**
 * /horda/[subject]/[topic] — Modo Horda público: oleadas 1 a 3 sin cuenta.
 *
 * Solo temas de historia (MATERIAS_PUBLICAS). La Horda completa, con récord
 * y XP, sigue en /guia/.../horda para quien tiene cuenta.
 *
 * ISR bajo demanda (generateStaticParams vacío): la página solo cambia si
 * cambia el tema, y las preguntas llegan por /api/horda-publica.
 */
export const revalidate = 3600

export async function generateStaticParams() {
  return []
}

type Params = Promise<{ subject: string; topic: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, topic } = await params
  const tema = await temaPorSlugs(subject, topic)
  if (!tema) return { title: 'Modo Horda | PASAS', robots: { index: false } }

  const titulo = `${tema.topicName}: examen de práctica en Modo Horda`
  const descripcion = `${OLEADAS_GRATIS} oleadas gratis de preguntas sobre ${tema.topicName} (${tema.subjectName}), cada una más difícil. Sin registrarte.`
  return {
    title: `${titulo} | PASAS`,
    description: descripcion,
    alternates: { canonical: urlHordaPublica(tema.subjectSlug, tema.topicSlug) },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: urlHordaPublica(tema.subjectSlug, tema.topicSlug),
      siteName: 'Pasas.mx',
      locale: 'es_MX',
      type: 'website',
    },
  }
}

export default async function HordaPublicaPage({ params }: { params: Params }) {
  const { subject, topic } = await params
  const tema = await temaPorSlugs(subject, topic)
  if (!tema) notFound()
  return <HordaPublicaClient tema={tema} />
}
