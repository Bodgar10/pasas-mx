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

    // Update topic_progress without overwriting 'completed' status
    const { data: topicProgress } = await supabase
      .from('topic_progress')
      .select('status')
      .eq('user_id', user.id)
      .eq('topic_id', topic_id)
      .maybeSingle()

    if (!topicProgress) {
      await supabase.from('topic_progress').insert({
        user_id: user.id,
        topic_id,
        status: 'in_progress',
        best_score: 0,
        attempts: 0,
        updated_at: new Date().toISOString(),
      })
    } else if (topicProgress.status === 'not_started') {
      await supabase
        .from('topic_progress')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('topic_id', topic_id)
    }

    return NextResponse.json({ xp_earned: 10, already_read: false })
  } catch (error) {
    console.error('section-read error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
