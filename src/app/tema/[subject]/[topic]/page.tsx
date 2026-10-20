import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getUsuario } from '@/lib/auth'
import { contenidoMuestra, temaMuestraPorSlugs } from '@/lib/tema-muestra-server'
import {
  TEMATICAS,
  tematicaPorClave,
  urlGuia,
  urlOnboardingDesdeTema,
  urlTemaMuestra,
  type MuestraTema,
} from '@/lib/tema-muestra'
import { esMateriaPublica, urlHordaPublica } from '@/lib/horda-publica'
import { conPromo, copyCTA, leyendaPromo, microcopyPromo } from '@/lib/promos'
import { getPromoPorDefecto } from '@/lib/promos-server'
import { SITIO } from '@/lib/seo'
import TopicClient from '@/app/(protected)/guia/[subject]/[topic]/topic-client'
import ElegirTematica from './elegir-tematica'

/**
 * /tema/[subject]/[topic] — el tema que falló en el reto, SIN CUENTA (s42).
 *
 * Arcade consigue la atención, el error crea la necesidad y el tema demuestra
 * el valor. Esta ruta abre ESE tema completo con la misma pantalla de la guía
 * (TopicClient en modo muestra): explicación con su hobby, audio, minijuegos,
 * quiz y la Horda pública si la materia la tiene. No guarda avance. Al final,
 * el registro con la campaña vigente.
 *
 *  - Con cuenta → la guía de verdad (/guia/...?from=arcade), con su progreso.
 *  - Sin ?tematica= → primero se elige con qué se lo explicamos (un toque).
 *  - Solo temas del reto (arcade_rounds): no es una puerta al temario entero.
 *
 * Dinámica (lee la sesión y el ?tematica=). noindex: es un paso del embudo.
 */
export const metadata: Metadata = {
  title: 'Aprende este tema | PASAS',
  robots: { index: false, follow: false },
}

type Params = Promise<{ subject: string; topic: string }>
type SP = Promise<Record<string, string | string[] | undefined>>

export default async function TemaMuestraPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { subject, topic } = await params
  const sp = await searchParams
  const leer = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null)
  const perfecto = leer('r') === '5'
  const desdeArcade = leer('from') === 'arcade'

  // Quien ya tiene cuenta no necesita la muestra: va a su guía, con su avance.
  //
  // La sesión y el tema van en paralelo (el tema sale de caché casi siempre,
  // ver lib/tema-muestra-server). El redirect se decide PRIMERO, igual que
  // antes: con cuenta se va a la guía aunque el tema no exista aquí.
  const [{ user }, tema] = await Promise.all([getUsuario(), temaMuestraPorSlugs(subject, topic)])
  if (user && !user.is_anonymous) redirect(urlGuia(subject, topic, perfecto))
  if (!tema) notFound()

  const tematica = tematicaPorClave(leer('tematica'))
  if (!tematica) {
    return (
      <ElegirTematica
        topicName={tema.topic.name}
        subjectName={tema.subject.name}
        materia={tema.materia}
        perfecto={perfecto}
        opciones={linksTematicas(tema.subject.slug, tema.topic.slug, perfecto)}
      />
    )
  }

  const [contenido, promo] = await Promise.all([contenidoMuestra(tema.topic.id, tematica.clave), getPromoPorDefecto()])
  if (!contenido || contenido.sections.length === 0) notFound()

  // Misma oferta que el final del reto: mismo plan, mismos helpers, el precio
  // de después siempre al lado (REGLA C). Sin campaña, la prueba de siempre.
  const leyenda = leyendaPromo(promo, 'estandar_v2', 'mensual')
  const cta = copyCTA(promo, 'estandar_v2', 'mensual', {
    label: 'Prueba 7 días gratis',
    sublabel: '7 días gratis · Sin contrato',
  })
  const slug = leyenda ? (promo?.slug ?? null) : null
  const onboarding = urlOnboardingDesdeTema({
    nivel: tema.nivel,
    grado: tema.grado,
    tema: tema.topic.name,
    tematica: contenido.themeName,
  })
  const linkPapa = new URL('/', SITIO)
  if (slug) linkPapa.searchParams.set('promo', slug)
  linkPapa.searchParams.set('utm_source', 'whatsapp')
  linkPapa.searchParams.set('utm_campaign', 'pidele-a-papa')

  const muestra: MuestraTema = {
    materia: tema.materia,
    tematica: tematica.clave,
    tematicaCorta: tematica.corto,
    volverHref: '/arcade',
    cambiarTematicaHref: urlTemaMuestra(tema.subject.slug, tema.topic.slug, { perfecto }),
    hordaHref:
      tema.hordeReady && esMateriaPublica(tema.subject.slug)
        ? `${urlHordaPublica(tema.subject.slug, tema.topic.slug)}?desde=arcade`
        : null,
    oferta: {
      href: slug ? conPromo(onboarding, slug) : onboarding,
      cta: cta.label,
      micro: microcopyPromo(cta.sublabel, ['Cancela cuando quieras']),
      badge: leyenda ? (promo?.badge_landing ?? null) : null,
      listaTexto: leyenda?.listaTexto ?? null,
      finalTexto: leyenda?.finalTexto ?? null,
      despuesTexto: leyenda?.despuesTexto ?? null,
      linkPapa: linkPapa.toString(),
    },
  }

  return (
    <TopicClient
      subject={tema.subject}
      topic={tema.topic}
      sections={contenido.sections}
      quizQuestions={contenido.quiz}
      initialProgress={null}
      readSectionIds={[]}
      initialAnswers={{}}
      hordeHasBank={!!muestra.hordaHref}
      muestra={muestra}
      desdeArcade={desdeArcade}
      retoPerfecto={perfecto}
    />
  )
}

function linksTematicas(subjectSlug: string, topicSlug: string, perfecto: boolean) {
  return TEMATICAS.map((t) => ({
    clave: t.clave,
    nombre: t.corto,
    emoji: t.emoji,
    href: urlTemaMuestra(subjectSlug, topicSlug, { tematica: t.clave, perfecto }),
  }))
}
