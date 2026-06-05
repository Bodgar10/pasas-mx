import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { type } = body

    if (type === 'subject_request') {
      const { subject_name, grade, education_level, description } = body
      if (!subject_name?.trim()) return NextResponse.json({ error: 'Falta el nombre de la materia' }, { status: 400 })
      const { error } = await supabase.from('subject_requests').insert({
        user_id: user.id,
        subject_name: subject_name.trim(),
        grade,
        education_level,
        description: description?.trim() || null,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (type === 'bug_report') {
      const { page_url, description } = body
      if (!description?.trim()) return NextResponse.json({ error: 'Falta la descripción' }, { status: 400 })
      const { error } = await supabase.from('bug_reports').insert({
        user_id: user.id,
        page_url: page_url || null,
        description: description.trim(),
        status: 'new',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
