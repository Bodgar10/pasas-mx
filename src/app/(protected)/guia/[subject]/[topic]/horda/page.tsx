import { notFound } from 'next/navigation'
import { getUsuario } from '@/lib/auth'
import { resolveLearner } from '@/lib/learners'
import HordaClient from './horda-client'

// Sin `force-dynamic`: lee la sesión (cookies) y con eso ya se renderiza en
// cada request. El flag no añadía nada.

export default async function HordaPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string; topic: string }>
  searchParams: Promise<{ a?: string }>
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params
  const sp = await searchParams
  const { supabase, user } = await getUsuario()
  if (!user) return notFound()

  // horde_runs se llavea por learner_id desde la migracion 035. Con
  // user_id, dos hermanos en el mismo tema hacen que maybeSingle LANCE.
  //
  // Alumno y tema en paralelo; el tema con su materia en UNA consulta
  // (`subjects!inner`, `topics.slug` es UNIQUE).
  const [learner, { data: topicConMateria }] = await Promise.all([
    resolveLearner(supabase, user.id, sp),
    supabase
      .from('topics')
      .select('id, name, slug, horde_ready, subjects!inner(slug)')
      .eq('slug', topicSlug)
      .eq('subjects.slug', subjectSlug)
      .maybeSingle(),
  ])

  if (!topicConMateria || !topicConMateria.horde_ready) return notFound()
  const { subjects: subjectRel, ...topic } = topicConMateria
  const subject = subjectRel as unknown as { slug: string }

  const { data: run } = learner
    ? await supabase
        .from('horde_runs')
        .select('best_wave, attempts')
        .eq('learner_id', learner.id)
        .eq('topic_id', topic.id)
        .maybeSingle()
    : { data: null }

  return (
    <HordaClient
      topicId={topic.id}
      topicName={topic.name}
      subjectSlug={subject.slug}
      topicSlug={topic.slug}
      bestWave={run?.best_wave ?? 0}
      attempts={run?.attempts ?? 0}
      activeSlot={learner?.slot ?? 1}
    />
  )
}
