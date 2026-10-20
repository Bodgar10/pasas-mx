import { notFound } from 'next/navigation'
import { getUsuario } from '@/lib/auth'
import { resolveLearner } from '@/lib/learners'
import TopicClient from './topic-client'

/**
 * Tope de filas de `quiz_answered` que se leen para pintar las respuestas
 * previas. Antes se traían TODOS los intentos de la historia del alumno para
 * quedarse solo con el último.
 *
 * 🔴 No se filtra por `topic_progress.attempts`: el número de intento lo pone
 * el cliente (attempts + 1 al montar) y no se mueve si repite el quiz sin
 * recargar, así que el último intento guardado puede quedar POR DEBAJO del
 * contador y ese filtro dejaría la pantalla sin respuestas. Con el orden
 * `attempt desc`, las filas del último intento vienen primero: mientras quepan
 * en el tope, lo que se pinta es idéntico. Un quiz tiene del orden de 10
 * preguntas; 200 deja margen de sobra incluso con repeticiones.
 */
const TOPE_RESPUESTAS_PREVIAS = 200

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string; topic: string }>
  searchParams: Promise<{ a?: string; from?: string; r?: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const sp = await searchParams
  const { supabase, user } = await getUsuario()

  // 🔴 Las tablas de avance se llavean por learner_id desde la migracion
  // 035. Filtrar por user_id matchea a TODOS los alumnos de la cuenta:
  // con dos hermanos en el mismo tema, maybeSingle() LANZA, y el
  // theme_id de user_subjects devolveria la tematica de cualquiera de
  // los dos.
  //
  // El alumno y el tema van en paralelo. El tema sale en UNA consulta con su
  // materia (`subjects!inner`): `topics.slug` es UNIQUE, así que "el tema con
  // este slug cuya materia tiene este slug" es la misma fila que antes salía
  // de tres lecturas (materia, id del tema y tema por id + subject_id).
  const [learner, { data: topicConMateria }] = await Promise.all([
    user ? resolveLearner(supabase, user.id, sp) : Promise.resolve(null),
    supabase
      .from('topics')
      .select('*, subjects!inner(id, name, slug)')
      .eq('slug', topicSlug)
      .eq('subjects.slug', subjectSlug)
      .maybeSingle(),
  ])

  if (!topicConMateria) return notFound()
  const { subjects: subjectRel, ...topic } = topicConMateria
  const subject = subjectRel as unknown as { id: string; name: string; slug: string }

  // Todo lo que solo necesita el tema y el alumno, en un solo batch. Las
  // secciones BASE se piden aquí aunque luego no hagan falta: son el respaldo
  // cuando la temática no tiene secciones, y pedirlas después era un viaje
  // en serie más.
  const [
    { data: userSubject },
    { data: initialProgressData },
    { data: readEvents },
    { data: previousAnswers },
    { data: hordeRun },
    { data: baseSections },
  ] = await Promise.all([
    supabase.from('user_subjects').select('theme_id').eq('learner_id', learner?.id ?? '').eq('subject_id', subject.id).maybeSingle(),
    learner ? supabase.from('topic_progress').select('*').eq('learner_id', learner.id).eq('topic_id', topic.id).maybeSingle() : Promise.resolve({ data: null }),
    learner ? supabase.from('progress').select('metadata').eq('learner_id', learner.id).eq('topic_id', topic.id).eq('event_type', 'section_read') : Promise.resolve({ data: [] }),
    learner ? supabase.from('progress').select('question_id, metadata, attempt').eq('learner_id', learner.id).eq('topic_id', topic.id).eq('event_type', 'quiz_answered').order('attempt', { ascending: false }).limit(TOPE_RESPUESTAS_PREVIAS) : Promise.resolve({ data: [] }),
    learner ? supabase.from('horde_runs').select('best_wave, attempts').eq('learner_id', learner.id).eq('topic_id', topic.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('sections').select('*').eq('topic_id', topic.id).is('theme_id', null).is('user_id', null).order('display_order', { ascending: true }),
  ])

  // Secciones y quiz dependen de la temática del alumno. Sin temática, el
  // quiz se consultaba con theme_id = '' (no es un uuid: error y data null)
  // y acababa en lista vacía; se ahorra la consulta con el mismo resultado.
  const themeId = userSubject?.theme_id as string | null | undefined
  const [{ data: themedSections }, { data: quizQuestions }] = themeId
    ? await Promise.all([
        supabase.from('sections').select('*').eq('topic_id', topic.id).eq('theme_id', themeId).is('user_id', null).order('display_order', { ascending: true }),
        supabase.from('quiz_questions').select('*').eq('topic_id', topic.id).eq('theme_id', themeId).order('created_at', { ascending: true }).order('id', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }]

  let sections = themedSections ?? []
  if (sections.length === 0) {
    sections = baseSections ?? []
  }

  const readSectionIds = (readEvents ?? []).map((e) => e.metadata?.section_id).filter(Boolean) as string[]

  const initialAnswers: Record<string, string> = {}
  if (previousAnswers && previousAnswers.length > 0) {
    const maxAttempt = previousAnswers[0].attempt
    const latestAnswers = previousAnswers.filter((a) => a.attempt === maxAttempt)
    for (const row of latestAnswers) {
      if (row.question_id && row.metadata?.selected_answer) {
        initialAnswers[row.question_id] = row.metadata.selected_answer
      }
    }
  }

  return (
    <TopicClient
      subject={{ id: subject.id, name: subject.name, slug: subject.slug }}
      topic={{ id: topic.id, name: topic.name, slug: topic.slug, difficulty: topic.difficulty, xp_reward: topic.xp_reward }}
      sections={sections}
      quizQuestions={quizQuestions ?? []}
      initialProgress={initialProgressData ?? null}
      readSectionIds={readSectionIds}
      initialAnswers={initialAnswers}
      hordeHasBank={topic.horde_ready === true}
      hordeBestWave={hordeRun?.best_wave ?? 0}
      hordeAttempts={hordeRun?.attempts ?? 0}
      activeSlot={learner?.slot ?? 1}
      desdeArcade={sp.from === 'arcade'}
      retoPerfecto={sp.r === '5'}
    />
  )
}
