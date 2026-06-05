import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { subject_id, subject_name, grade, education_level, topic_name, description } = await req.json()

    if (!subject_id || !topic_name?.trim()) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { error } = await supabase.from('topic_requests').insert({
      user_id: user.id,
      subject_id,
      subject_name,
      grade,
      education_level,
      topic_name: topic_name.trim(),
      description: description?.trim() || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
