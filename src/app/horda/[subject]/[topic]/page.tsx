import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { temaPorSlugs } from '@/lib/horda-publica-server'
import { OLEADAS_GRATIS, urlHordaPublica } from '@/lib/horda-publica'
import { leyendaPromo } from '@/lib/promos'
import { getPromoPorDefecto } from '@/lib/promos-server'
import HordaPublicaClient from './horda-publica-client'

/**
 * /horda/[subject]/[topic] — Modo Horda público: oleadas 1 a 3 sin cuenta.
 *
 * Solo temas de historia (MATERIAS_PUBLICAS). La Horda completa, con récord
 * y XP, sigue en /guia/.../horda para quien tiene cuenta.
 *
 * ISR bajo demanda (generateStaticParams vacío): las preguntas llegan por
 * /api/horda-publica. Se revalida cada 5 min porque el muro pinta el precio
 * de la campaña vigente (s41): si se apaga la promo, que deje de anunciarse
 * pronto. El checkout revalida contra Stripe de todas formas.
 */
export const revalidate = 300

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
  const [tema, promo] = await Promise.all([temaPorSlugs(subject, topic), getPromoPorDefecto()])
  if (!tema) notFound()
  // El muro manda al onboarding del plan Estándar mensual, el mismo de la
  // oferta del reto. Sin campaña que aplique, null: el muro de siempre.
  const leyenda = leyendaPromo(promo, 'estandar_v2', 'mensual')
  const promoMuro = leyenda
    ? { finalTexto: leyenda.finalTexto, despuesTexto: leyenda.despuesTexto, badge: promo?.badge_landing ?? null }
    : null
  return <HordaPublicaClient tema={tema} promoMuro={promoMuro} />
}
