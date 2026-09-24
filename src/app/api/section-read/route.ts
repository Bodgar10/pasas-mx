import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { resolveLearnerFromBody } from '@/lib/learners'
import { trackServer } from '@/lib/analytics/track-server'
import { diaMexico } from '@/lib/gamification'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { section_id, topic_id, subject_id } = body

    if (!section_id || !topic_id || !subject_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const learnerId = await resolveLearnerFromBody(supabase, user.id, body?.slot)
    if (!learnerId) {
      return NextResponse.json({ error: 'Sin alumno activo' }, { status: 409 })
    }

    // Idempotency check
    const { data: existing } = await supabase
      .from('progress')
      .select('id')
      .eq('learner_id', learnerId)
      .eq('event_type', 'section_read')
      .filter('metadata->>section_id', 'eq', section_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ xp_earned: 0, already_read: true })
    }

    /**
     * 🔴 SE LEE ANTES DEL INSERT, Y ESO ES LO IMPORTANTE — s33.
     *
     * Desde la migración 050 la racha la escribe un trigger AFTER INSERT
     * sobre `progress`. Leer `learners` después del insert devolvería el
     * estado YA actualizado y los tres eventos de abajo —primera_sesion,
     * racha_actualizada, racha_rota— se volverían imposibles de calcular:
     * el valor viejo es justo lo que el trigger acaba de pisar.
     *
     * Esta ruta NO escribe ninguna de esas columnas. Lo intentaba y no
     * podía: la 036 revocó el UPDATE por columnas y la 048 añadió tres
     * nuevas sin extender el GRANT, así que el UPDATE entero venía
     * fallando con 42501 desde el 18-ago y nadie miraba el error.
     */
    const { data: estadoPrevio } = await supabase
      .from('learners')
      .select('streak_days, last_active_at, max_streak_days, first_session_at')
      .eq('id', learnerId)
      .single()

    const { error: progressError } = await supabase.from('progress').insert({
      user_id: user.id,
      learner_id: learnerId,
      topic_id,
      event_type: 'section_read',
      xp_earned: 10,
      result: null,
      attempt: 1,
      metadata: { section_id },
    })
    if (progressError) {
      console.error('section-read progress insert failed:', progressError)
      return NextResponse.json({ error: 'No se pudo guardar el avance' }, { status: 500 })
    }

    await supabase.rpc('increment_learner_xp', { lid: learnerId, amount: 10 })
    await supabase.rpc('increment_subject_xp', { lid: learnerId, sid: subject_id, amount: 10 })

    // --- Streak logic (solo LECTURA: escribe el trigger 050) ---
    //
    // Se replica el cálculo del trigger para poder emitir los eventos, no
    // para escribir. Si algún día cambian las reglas de la racha, cambian
    // en `learner_activity_from_progress` y esto se ajusta detrás — nunca
    // al revés.
    //
    // 🔴 Días de MÉXICO, igual que el trigger. El código viejo cortaba en
    // UTC: cualquier sesión después de las 18:00 de México contaba como del
    // día siguiente, así que dos sesiones de la misma noche podían regalar
    // un día de racha.
    const userRecord = estadoPrevio
    const now = new Date()
    const hoyMx = diaMexico(now)
    const ultimoMx = diaMexico(userRecord?.last_active_at)

    let newStreak = 1
    let streakEvent: 'continued' | 'started' | 'none' = 'none'

    if (!ultimoMx || !hoyMx) {
      newStreak = 1
      streakEvent = 'started'
    } else if (ultimoMx === hoyMx) {
      newStreak = Math.max(userRecord?.streak_days ?? 1, 1)
      streakEvent = 'none'
    } else {
      const ayerMx = diaMexico(new Date(now.getTime() - 24 * 60 * 60 * 1000))
      if (ultimoMx === ayerMx) {
        newStreak = (userRecord?.streak_days ?? 0) + 1
        streakEvent = 'continued'
      } else {
        newStreak = 1
        streakEvent = 'started'
      }
    }

    /**
     * Primera sesión del alumno. La escribe el trigger con `coalesce`; aquí
     * solo se mira si ANTES estaba vacía, que es lo que decide si el evento
     * `primera_sesion` sale o no.
     */
    const primeraSesion = !userRecord?.first_session_at

    /** Techo histórico previo. Sirve para `es_record` en el evento. */
    const maximaPrevia = userRecord?.max_streak_days ?? 0
    const nuevaMaxima = Math.max(maximaPrevia, newStreak)
    // --- End streak logic ---

    // --- Eventos de servidor ---
    //
    // Nada de esto altera la logica de arriba: se lee lo que ya estaba en la
    // mano y se emite. Van en su propio try/catch — un fallo de analitica no
    // puede tumbar el registro del avance de un alumno.
    try {
      const { data: consentimiento } = await supabase
        .from('users')
        .select('cookie_consent_analytics, cookie_consent_marketing')
        .eq('id', user.id)
        .maybeSingle()

      const ctx = {
        consent: {
          analytics: consentimiento?.cookie_consent_analytics,
          marketing: consentimiento?.cookie_consent_marketing,
        },
        userId: user.id,
      }

      if (primeraSesion) {
        await trackServer('primera_sesion', { fuente: 'section_read' }, ctx)
      }

      if (streakEvent !== 'none') {
        await trackServer(
          'racha_actualizada',
          {
            dias_actual: newStreak,
            dias_maxima: nuevaMaxima,
            es_record: newStreak > maximaPrevia && newStreak > 1,
            evento: streakEvent,
          },
          ctx
        )
      }

      /**
       * 🔴 `racha_rota` — el unico sitio del codigo donde se sabe.
       *
       * `streakEvent === 'started'` cubre DOS casos que el codigo no
       * distingue: "empieza por primera vez" y "rompio una de 12 dias". La
       * diferencia esta en el valor viejo, que aqui todavia se tiene en la
       * mano y despues se pierde — el UPDATE de arriba ya lo piso.
       *
       * `> 1` a proposito: una racha de 1 dia que se rompe no es una racha
       * perdida, es un alumno que vino una vez.
       */
      const rachaVieja = userRecord?.streak_days ?? 0
      if (streakEvent === 'started' && rachaVieja > 1) {
        await trackServer(
          'racha_rota',
          { dias_perdidos: rachaVieja, dias_maxima: nuevaMaxima },
          ctx
        )
      }
    } catch (err) {
      console.error('[section-read] analitica fallo:', err)
    }

    // Count total sections for this topic
    const { count: totalSections } = await supabase
      .from('sections')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', topic_id)

    // Count how many sections the user has already read for this topic
    // (including the one just inserted)
    const { count: readCount } = await supabase
      .from('progress')
      .select('id', { count: 'exact', head: true })
      .eq('learner_id', learnerId)
      .eq('topic_id', topic_id)
      .eq('event_type', 'section_read')

    const readingPercent =
      totalSections && totalSections > 0
        ? Math.round(((readCount ?? 0) / totalSections) * 100)
        : 0

    // Update topic_progress — never overwrite 'completed' status or its best_score
    const { data: topicProgress } = await supabase
      .from('topic_progress')
      .select('status, best_score')
      .eq('learner_id', learnerId)
      .eq('topic_id', topic_id)
      .maybeSingle()

    if (!topicProgress) {
      await supabase.from('topic_progress').insert({
        user_id: user.id,
        learner_id: learnerId,
        topic_id,
        status: 'in_progress',
        best_score: readingPercent,
        attempts: 0,
        updated_at: new Date().toISOString(),
      })
    } else if (topicProgress.status === 'not_started') {
      await supabase
        .from('topic_progress')
        .update({
          status: 'in_progress',
          best_score: readingPercent,
          updated_at: new Date().toISOString(),
        })
        .eq('learner_id', learnerId)
        .eq('topic_id', topic_id)
    } else if (topicProgress.status === 'in_progress') {
      const newScore = Math.max(topicProgress.best_score ?? 0, readingPercent)
      await supabase
        .from('topic_progress')
        .update({
          best_score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq('learner_id', learnerId)
        .eq('topic_id', topic_id)
    }
    // If status === 'completed' → do nothing, quiz score wins

    return NextResponse.json({
      xp_earned: 10,
      already_read: false,
      reading_percent: readingPercent,
      streak: {
        days: newStreak,
        event: streakEvent,
      },
    })
  } catch (error) {
    console.error('section-read error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
