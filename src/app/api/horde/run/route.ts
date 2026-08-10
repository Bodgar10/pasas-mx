import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { getActiveLearnerId } from '@/lib/learners'

export const dynamic = 'force-dynamic'

const WAVES = 6

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { topicId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const topicId = body.topicId
  if (!topicId) {
    return NextResponse.json({ error: 'Falta topicId' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const learnerId = await getActiveLearnerId(supabase, user.id)
  if (!learnerId) {
    return NextResponse.json({ error: 'Sin alumno activo' }, { status: 409 })
  }

  const { data: topic } = await admin
    .from('topics')
    .select('id, horde_ready')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic || !topic.horde_ready) {
    return NextResponse.json({ error: 'Este tema no tiene horda' }, { status: 404 })
  }

  const { data: existing } = await admin
    .from('horde_runs')
    .select('best_wave, attempts, waves_cleared, completed_at')
    .eq('learner_id', learnerId)
    .eq('topic_id', topicId)
    .maybeSingle()

  const attempts = (existing?.attempts ?? 0) + 1

  const { error: upsertError } = await admin.from('horde_runs').upsert(
    {
      user_id: user.id,
      learner_id: learnerId,
      topic_id: topicId,
      best_wave: existing?.best_wave ?? 0,
      attempts,
      waves_cleared: existing?.waves_cleared ?? [],
      completed_at: existing?.completed_at ?? null,
      last_played_at: new Date().toISOString(),
    },
    { onConflict: 'learner_id,topic_id' }
  )

  if (upsertError) {
    console.error('horde run upsert failed:', upsertError)
    return NextResponse.json({ error: 'No se pudo iniciar la horda' }, { status: 500 })
  }

  const { data: questions } = await admin
    .from('horde_questions')
    .select('id, wave, question, options')
    .eq('topic_id', topicId)
    .eq('wave', 1)
    .order('id', { ascending: true })

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'Sin preguntas' }, { status: 404 })
  }

  return NextResponse.json({
    attempt: attempts,
    wave: 1,
    totalWaves: WAVES,
    bestWave: existing?.best_wave ?? 0,
    questions: shuffle(questions),
  })
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
