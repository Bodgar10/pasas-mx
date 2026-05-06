import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

    // Idempotency check
    const { data: existing } = await supabase
      .from('progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', 'section_read')
      .filter('metadata->>section_id', 'eq', section_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ xp_earned: 0, already_read: true })
    }

    await supabase.from('progress').insert({
      user_id: user.id,
      topic_id,
      event_type: 'section_read',
      xp_earned: 10,
      result: null,
      attempt: 1,
      metadata: { section_id },
    })

    await supabase.rpc('increment_xp', { uid: user.id, amount: 10 })
    await supabase.rpc('increment_subject_xp', { uid: user.id, sid: subject_id, amount: 10 })

    // --- Streak logic ---
    const { data: userRecord } = await supabase
      .from('users')
      .select('streak_days, last_active_at')
      .eq('id', user.id)
      .single()

    const now = new Date()
    const todayUTC = now.toISOString().split('T')[0]

    let newStreak = 1
    let streakEvent: 'continued' | 'started' | 'none' = 'none'

    if (userRecord?.last_active_at) {
      const lastActive = new Date(userRecord.last_active_at)
      const lastActiveUTC = lastActive.toISOString().split('T')[0]

      if (lastActiveUTC === todayUTC) {
        newStreak = userRecord.streak_days ?? 1
        streakEvent = 'none'
      } else {
        const yesterday = new Date(now)
        yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        const yesterdayUTC = yesterday.toISOString().split('T')[0]

        if (lastActiveUTC === yesterdayUTC) {
          newStreak = (userRecord.streak_days ?? 0) + 1
          streakEvent = 'continued'
        } else {
          newStreak = 1
          streakEvent = 'started'
        }
      }
    } else {
      newStreak = 1
      streakEvent = 'started'
    }

    if (streakEvent !== 'none') {
      await supabase
        .from('users')
        .update({
          streak_days: newStreak,
          last_active_at: now.toISOString(),
        })
        .eq('id', user.id)
    } else {
      await supabase
        .from('users')
        .update({ last_active_at: now.toISOString() })
        .eq('id', user.id)
    }
    // --- End streak logic ---

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
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
      .eq('topic_id', topic_id)
      .maybeSingle()

    if (!topicProgress) {
      await supabase.from('topic_progress').insert({
        user_id: user.id,
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
        .eq('user_id', user.id)
        .eq('topic_id', topic_id)
    } else if (topicProgress.status === 'in_progress') {
      const newScore = Math.max(topicProgress.best_score ?? 0, readingPercent)
      await supabase
        .from('topic_progress')
        .update({
          best_score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
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
