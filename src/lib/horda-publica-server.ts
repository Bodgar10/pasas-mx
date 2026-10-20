import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { faltaFirmaNueva, type AtribucionServidor } from '@/lib/arcade-server'
import { NIVEL_ONBOARDING, OLEADAS_GRATIS, esMateriaPublica, gradoOnboarding } from '@/lib/horda-publica'

/**
 * Lecturas de la Horda pública. Service role porque `horde_questions` no
 * tiene política para anon (migración 027): el navegador nunca ve la tabla,
 * y estas funciones jamás devuelven `correct_answer` ni preguntas de la
 * oleada 4 en adelante.
 *
 * Solo LEEN. No escriben en horde_runs, progress ni learners: la partida
 * pública vive en el navegador.
 */
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

export type TemaPublico = {
  topicId: string
  topicName: string
  topicSlug: string
  subjectSlug: string
  subjectName: string
  nivel: string | null
  grado: string | null
}

export type PreguntaPublica = {
  id: string
  wave: number
  question: string
  options: { letter: string; text: string }[]
}

/**
 * Lectura del tema por slugs, sin caché. Tema y materia en UNA consulta:
 * `topics.slug` es UNIQUE, así que "el tema con este slug cuya materia tiene
 * este slug" es la misma fila que antes salía de dos lecturas en serie.
 */
async function leerTemaPorSlugs(subjectSlug: string, topicSlug: string): Promise<TemaPublico | null> {
  const { data: fila } = await admin()
    .from('topics')
    .select('id, name, slug, grade, published, horde_ready, subjects!inner(id, slug, name, education_level, grades)')
    .eq('slug', topicSlug)
    .eq('subjects.slug', subjectSlug)
    .maybeSingle()
  if (!fila || !fila.published || !fila.horde_ready) return null
  const subject = fila.subjects as unknown as {
    slug: string
    name: string
    education_level: string | null
    grades: number[] | null
  }

  return {
    topicId: fila.id,
    topicName: fila.name,
    topicSlug: fila.slug,
    subjectSlug: subject.slug,
    subjectName: subject.name,
    nivel: NIVEL_ONBOARDING[subject.education_level as string] ?? null,
    grado: gradoOnboarding(fila.grade ?? subject.grades?.[0]),
  }
}

/**
 * Caché entre requests (300 s, tag 'topics'): /unete la pide en cada clic
 * del muro y la página en cada regeneración. Mismo TTL que el `revalidate`
 * de /horda/[subject]/[topic].
 */
const temaPorSlugsCacheado = unstable_cache(leerTemaPorSlugs, ['horda-publica-tema-por-slugs'], {
  revalidate: 300,
  tags: ['topics'],
})

/**
 * El tema, solo si es de una materia pública, está publicado y tiene Horda.
 *
 * React `cache()` por encima: generateMetadata y la página lo llaman los dos
 * en el mismo render y así comparten la misma promesa. En un route handler
 * (/unete) no hay render y solo actúa la caché de abajo.
 *
 * `esMateriaPublica` va FUERA de las cachés: es una lista en código, no cuesta
 * nada y así un slug de otra materia ni siquiera crea entrada.
 */
export const temaPorSlugs = cache(async (subjectSlug: string, topicSlug: string): Promise<TemaPublico | null> => {
  if (!esMateriaPublica(subjectSlug)) return null
  return temaPorSlugsCacheado(subjectSlug, topicSlug)
})

/**
 * Valida por id (lo que mandan las APIs): mismo criterio que temaPorSlugs.
 *
 * Se llama en CADA respuesta de la Horda pública (oleada, respuesta, avance):
 * con caché por topicId de 300 s, un jugador que contesta 30 preguntas ya no
 * paga 30 veces la misma lectura de catálogo.
 */
const esTemaPublico = unstable_cache(
  async (topicId: string): Promise<boolean> => {
    const { data } = await admin()
      .from('topics')
      .select('published, horde_ready, subjects!inner(slug)')
      .eq('id', topicId)
      .maybeSingle()
    const slug = (data?.subjects as unknown as { slug: string } | null)?.slug
    return !!data && data.published && data.horde_ready && !!slug && esMateriaPublica(slug)
  },
  ['horda-publica-es-tema-publico'],
  { revalidate: 300, tags: ['topics'] }
)

export async function preguntasDeOleada(topicId: string, wave: number): Promise<PreguntaPublica[] | null> {
  if (!Number.isInteger(wave) || wave < 1 || wave > OLEADAS_GRATIS) return null
  if (!(await esTemaPublico(topicId))) return null
  const { data } = await admin()
    .from('horde_questions')
    .select('id, wave, question, options')
    .eq('topic_id', topicId)
    .eq('wave', wave)
  return (data as PreguntaPublica[] | null) ?? null
}

export async function revisarRespuesta(
  topicId: string,
  questionId: string,
  letter: string
): Promise<{ correct: boolean; explanation: string; hint: string | null } | null> {
  if (!(await esTemaPublico(topicId))) return null
  const { data: q } = await admin()
    .from('horde_questions')
    .select('wave, correct_answer, hint, explanation')
    .eq('id', questionId)
    .eq('topic_id', topicId)
    .maybeSingle()
  // La oleada 4+ no se revisa aquí: sus preguntas nunca salen por la ruta pública.
  if (!q || q.wave > OLEADAS_GRATIS) return null
  const correct = q.correct_answer === letter
  return { correct, explanation: q.explanation, hint: correct ? null : q.hint }
}

/** Todos los temas públicos, para el sitemap. */
export async function temasPublicos(): Promise<{ subjectSlug: string; topicSlug: string }[]> {
  const { data } = await admin()
    .from('topics')
    .select('slug, published, horde_ready, subjects!inner(slug)')
    .eq('published', true)
    .eq('horde_ready', true)
  return (data ?? [])
    .map((t) => ({
      subjectSlug: (t.subjects as unknown as { slug: string }).slug,
      topicSlug: t.slug as string,
    }))
    .filter((t) => esMateriaPublica(t.subjectSlug))
}

export type EventoAvance =
  | { evento: 'inicio' }
  | { evento: 'oleada'; oleada: number }
  | { evento: 'eleccion'; eleccion: 'estudiante' | 'adulto' }

/**
 * Guarda el avance de un navegador en `horda_publica_avance` (migración 052).
 * Es la medición que no depende de cookies: PostHog solo ve a quien las
 * acepta. Sin datos personales; el id es el anónimo de los juegos.
 */
export async function registrarAvance(
  anonId: string,
  topicId: string,
  e: EventoAvance,
  origen: string | null,
  atribucion: AtribucionServidor | null = null
): Promise<boolean> {
  if (!(await esTemaPublico(topicId))) return false
  const base = {
    p_anon_id: anonId,
    p_topic_id: topicId,
    p_evento: e.evento,
    p_oleada: e.evento === 'oleada' ? e.oleada : null,
    p_eleccion: e.evento === 'eleccion' ? e.eleccion : null,
    p_origen: origen,
  }
  // Firma nueva (053) con reintento a la vieja (052); ver faltaFirmaNueva.
  let { data, error } = await admin().rpc('horda_publica_registrar', {
    ...base,
    p_canal: atribucion?.canal ?? null,
    p_utm_source: atribucion?.utm_source ?? null,
    p_utm_campaign: atribucion?.utm_campaign ?? null,
  })
  if (faltaFirmaNueva(error)) {
    ;({ data, error } = await admin().rpc('horda_publica_registrar', base))
  }
  if (error) {
    console.error('[horda-publica] registrar avance falló:', error)
    return false
  }
  return data === true
}
