import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { resolveLearnerFromBody } from '@/lib/learners'
import { trackServer } from '@/lib/analytics/track-server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      question_id,
      topic_id,
      subject_id,
      selected_answer,
      is_correct,
      xp_earned,
      combo,
      attempt,
      is_last_question,
      final_score,
      total_correct: _total_correct,
      total_questions: _total_questions,
    } = body

    if (!question_id || !topic_id || !subject_id || !selected_answer || attempt === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const learnerId = await resolveLearnerFromBody(supabase, user.id, body?.slot)
    if (!learnerId) {
      return NextResponse.json({ error: 'Sin alumno activo' }, { status: 409 })
    }

    const { error: answerError } = await supabase.from('progress').insert({
      user_id: user.id,
      learner_id: learnerId,
      topic_id,
      question_id,
      event_type: 'quiz_answered',
      result: is_correct,
      xp_earned,
      attempt,
      metadata: { selected_answer, combo },
    })
    if (answerError) {
      console.error('quiz-answer progress insert failed:', answerError)
      return NextResponse.json({ error: 'No se pudo guardar la respuesta' }, { status: 500 })
    }

    if (is_correct && xp_earned > 0) {
      await supabase.rpc('increment_learner_xp', { lid: learnerId, amount: xp_earned })
      await supabase.rpc('increment_subject_xp', { lid: learnerId, sid: subject_id, amount: xp_earned })
    }

    if (is_last_question) {
      const { data: current } = await supabase
        .from('topic_progress')
        .select('best_score, attempts')
        .eq('learner_id', learnerId)
        .eq('topic_id', topic_id)
        .maybeSingle()

      const newBestScore = Math.max(current?.best_score ?? 0, final_score ?? 0)

      const { error: upsertError } = await supabase.from('topic_progress').upsert(
        {
          user_id: user.id,
          learner_id: learnerId,
          topic_id,
          status: 'completed',
          best_score: newBestScore,
          attempts: (current?.attempts ?? 0) + 1,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'learner_id,topic_id' }
      )
      if (upsertError) {
        console.error('quiz-answer topic_progress upsert failed:', upsertError)
        return NextResponse.json({ error: 'No se pudo guardar el resultado' }, { status: 500 })
      }

      if (final_score === 100) {
        await supabase.from('progress').insert({
          user_id: user.id,
          learner_id: learnerId,
          topic_id,
          event_type: 'topic_completed',
          xp_earned: 150,
          result: true,
          attempt,
          metadata: { perfect: true, score: 100 },
        })
        await supabase.rpc('increment_learner_xp', { lid: learnerId, amount: 150 })
        await supabase.rpc('increment_subject_xp', { lid: learnerId, sid: subject_id, amount: 150 })
      }

      /**
       * ACTIVACION — el momento en que el producto demostro su valor.
       *
       * Abrio un tema Y completo un quiz. Se marca con guard de NULL para que
       * sea el PRIMER quiz completado y no el ultimo.
       *
       * 🔴 Exige `first_session_at` ya escrito: sin sesion previa no hay
       * "activado en X horas" que medir, y esa resta es justo para lo que
       * existen las dos columnas. Si alguien llegara aqui sin primera sesion
       * —un quiz sin haber leido nada— se escriben las dos a la vez, que es
       * lo honesto: su primera sesion ES esta.
       */
      try {
        const { data: alumno } = await supabase
          .from('learners')
          .select('first_session_at, activated_at')
          .eq('id', learnerId)
          .maybeSingle()

        if (!alumno?.activated_at) {
          const ahora = new Date().toISOString()
          await supabase
            .from('learners')
            .update({
              activated_at: ahora,
              ...(alumno?.first_session_at ? {} : { first_session_at: ahora }),
            })
            .eq('id', learnerId)

          const { data: consentimiento } = await supabase
            .from('users')
            .select('cookie_consent_analytics, cookie_consent_marketing')
            .eq('id', user.id)
            .maybeSingle()

          await trackServer(
            'activado',
            {
              // Horas desde la PRIMERA sesion, no desde el alta: mide cuanto
              // tardo el producto en demostrar valor una vez que empezo.
              horas_desde_primera_sesion: alumno?.first_session_at
                ? Math.round(
                    (Date.now() - new Date(alumno.first_session_at).getTime()) / 3_600_000
                  )
                : 0,
              ruta: 'quiz',
              score: final_score,
            },
            {
              consent: {
                analytics: consentimiento?.cookie_consent_analytics,
                marketing: consentimiento?.cookie_consent_marketing,
              },
              userId: user.id,
            }
          )
        }
      } catch (err) {
        // Nunca tumba el quiz: el progreso ya esta escrito arriba.
        console.error('[quiz-answer] activacion fallo:', err)
      }

      return NextResponse.json({
        ok: true,
        topic_completed: true,
        best_score: newBestScore,
        perfect: final_score === 100,
      })
    }

    return NextResponse.json({ ok: true, topic_completed: false })
  } catch (error) {
    console.error('quiz-answer error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
