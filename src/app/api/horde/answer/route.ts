import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const WAVES = 6
const PER_WAVE = 5
const XP_PER_WAVE = 30
const XP_COMPLETE = 150

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: {
    topicId?: string
    questionId?: string
    letter?: string
    wave?: number
    attempt?: number
    round?: number
    answeredSoFar?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const { topicId, questionId, letter, wave, attempt } = body
  const round = body.round ?? 1
  const answeredSoFar = body.answeredSoFar ?? 0
  if (!topicId || !questionId || !letter || !wave || !attempt) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: question }, { data: topicRow }] = await Promise.all([
    admin
      .from('horde_questions')
      .select('id, wave, correct_answer, hint, explanation')
      .eq('id', questionId)
      .eq('topic_id', topicId)
      .maybeSingle(),
    admin.from('topics').select('subject_id').eq('id', topicId).maybeSingle(),
  ])

  if (!question || question.wave !== wave) {
    return NextResponse.json({ error: 'Pregunta invalida' }, { status: 404 })
  }

  const isCorrect = question.correct_answer === letter

  // El insert SIEMPRE se espera. Los builders de Supabase son perezosos:
  // sin await la peticion HTTP nunca se dispara y la respuesta no se guarda.
  // Con fire-and-forget solo sobrevivia la 5a respuesta de cada oleada, el
  // servidor contaba 1 acierto de 5 y mandaba a derrota siempre.
  const { error: insertError } = await admin.from('progress').insert({
    user_id: user.id,
    topic_id: topicId,
    question_id: questionId,
    event_type: 'horde_answered',
    result: isCorrect,
    xp_earned: 0,
    attempt,
    metadata: { wave, round, selected_answer: letter },
  })
  if (insertError) {
    return NextResponse.json({ error: 'No se pudo guardar la respuesta' }, { status: 500 })
  }

  const answered = answeredSoFar + 1

  if (answered < PER_WAVE) {
    return NextResponse.json({
      correct: isCorrect,
      explanation: question.explanation,
      hint: isCorrect ? null : question.hint,
      answered,
      waveComplete: false,
    })
  }

  const { data: waveAnswers } = await admin
    .from('progress')
    .select('result, metadata')
    .eq('user_id', user.id)
    .eq('topic_id', topicId)
    .eq('event_type', 'horde_answered')
    .eq('attempt', attempt)

  const thisWave = (waveAnswers ?? []).filter(
    (r) => r.metadata?.wave === wave && (r.metadata?.round ?? 1) === round
  )
  const correctCount = thisWave.filter((r) => r.result === true).length

  const base = {
    correct: isCorrect,
    explanation: question.explanation,
    hint: isCorrect ? null : question.hint,
    answered,
    correctCount,
  }

  const { data: run } = await admin
    .from('horde_runs')
    .select('best_wave, waves_cleared, completed_at')
    .eq('user_id', user.id)
    .eq('topic_id', topicId)
    .maybeSingle()

  const cleared: number[] = run?.waves_cleared ?? []
  let outcome: 'advance' | 'repeat' | 'reset'
  let nextWave = wave
  let xpEarned = 0

  if (correctCount >= 4) {
    outcome = 'advance'
    nextWave = wave + 1
  } else if (correctCount === 3) {
    outcome = 'repeat'
  } else {
    outcome = 'reset'
    nextWave = 1
  }

  if (outcome === 'advance') {
    const firstTime = !cleared.includes(wave)
    const newCleared = firstTime ? [...cleared, wave] : cleared
    const bestWave = Math.max(run?.best_wave ?? 0, wave)
    const finished = wave >= WAVES

    if (firstTime) xpEarned += XP_PER_WAVE
    if (finished && !run?.completed_at) xpEarned += XP_COMPLETE

    await admin
      .from('horde_runs')
      .update({
        best_wave: bestWave,
        waves_cleared: newCleared,
        completed_at: finished ? (run?.completed_at ?? new Date().toISOString()) : run?.completed_at ?? null,
        last_played_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('topic_id', topicId)

    if (xpEarned > 0) {
      await admin.from('progress').insert({
        user_id: user.id,
        topic_id: topicId,
        event_type: finished ? 'horde_completed' : 'horde_wave_cleared',
        result: true,
        xp_earned: xpEarned,
        attempt,
        metadata: { wave },
      })
      await admin.rpc('increment_xp', { uid: user.id, amount: xpEarned })
      if (topicRow?.subject_id) {
        await admin.rpc('increment_subject_xp', {
          uid: user.id,
          sid: topicRow.subject_id,
          amount: xpEarned,
        })
      }
    }

    if (finished) {
      return NextResponse.json({
        ...base,
        waveComplete: true,
        outcome: 'finished',
        xpEarned,
        bestWave,
      })
    }

    const { data: next } = await admin
      .from('horde_questions')
      .select('id, wave, question, options')
      .eq('topic_id', topicId)
      .eq('wave', nextWave)
      .order('id', { ascending: true })

    return NextResponse.json({
      ...base,
      waveComplete: true,
      outcome,
      nextWave,
      nextRound: round + 1,
      xpEarned,
      bestWave,
      questions: shuffle(next ?? []),
    })
  }

  const { data: retry } = await admin
    .from('horde_questions')
    .select('id, wave, question, options')
    .eq('topic_id', topicId)
    .eq('wave', nextWave)
    .order('id', { ascending: true })

  return NextResponse.json({
    ...base,
    waveComplete: true,
    outcome,
    nextWave,
    xpEarned: 0,
    bestWave: run?.best_wave ?? 0,
    questions: shuffle(retry ?? []),
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
