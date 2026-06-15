export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { topicId, themeId, themeName, sections, quiz_questions } = await req.json()

  if (!topicId || !themeId || !sections || !Array.isArray(sections)) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  await supabase.from('topics').update({ published: false }).eq('id', topicId)

  await supabase.from('sections').delete().eq('topic_id', topicId).eq('theme_id', themeId)

  const sectionsToInsert = sections.map((s: {
    type: string
    title?: string
    content: string
    display_order: number
    data?: Record<string, unknown> | null
  }) => ({
    topic_id: topicId,
    theme_id: themeId,
    user_id: null,
    type: s.type,
    title: s.title ?? null,
    content: s.content,
    display_order: s.display_order,
    data: s.data ?? null,
    interests_used: [themeName],
  }))

  const { data: insertedSections, error: sectionsError } = await supabase
    .from('sections')
    .insert(sectionsToInsert)
    .select()

  if (sectionsError) {
    console.error('Sections insert error:', sectionsError)
    return NextResponse.json({ error: sectionsError.message }, { status: 500 })
  }

  await supabase.from('quiz_questions').delete().eq('topic_id', topicId).eq('theme_id', themeId)

  let insertedQuestions = null
  if (quiz_questions && Array.isArray(quiz_questions) && quiz_questions.length > 0) {
    const questionsToInsert = quiz_questions.map((q: {
      question: string
      options: { letter: string; text: string }[]
      correct_answer: string
      explanation: string
      difficulty: number
      xp_reward: number
    }) => ({
      topic_id: topicId,
      theme_id: themeId,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      xp_reward: q.xp_reward,
      source: 'ai',
    }))

    const { data, error: quizError } = await supabase
      .from('quiz_questions')
      .insert(questionsToInsert)
      .select()

    if (quizError) {
      console.error('Quiz insert error:', quizError)
    } else {
      insertedQuestions = data
    }
  }

  return NextResponse.json({
    sections: insertedSections,
    quizQuestions: insertedQuestions,
  })
}
