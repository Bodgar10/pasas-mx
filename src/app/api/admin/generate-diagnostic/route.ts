export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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

  const { subjectId, subjectName, grade, level } = await req.json()

  if (!subjectId || !subjectName || !grade || !level) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch all published topics for this subject+grade
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, name, slug, description, difficulty')
    .eq('subject_id', subjectId)
    .eq('grade', grade)
    .eq('published', true)
    .order('display_order', { ascending: true })

  if (topicsError || !topics || topics.length === 0) {
    return NextResponse.json(
      { error: 'No published topics found for this subject and grade. Publish at least one topic first.' },
      { status: 400 }
    )
  }

  function getEducationContext(level: string, grade: number): string {
    switch (level) {
      case 'middle_school': return `${grade}° de secundaria`
      case 'high_school':   return `${grade}° de preparatoria`
      case 'exam_prepa':    return `preparación para examen de ingreso a preparatoria (COMIPEMS)`
      case 'exam_uni':      return `preparación para examen de ingreso a universidad (UNAM/IPN)`
      default:              return `${grade}° grado`
    }
  }

  const educationContext = getEducationContext(level, grade)

  const client = new Anthropic()

  const topicsList = topics
    .map((t, i) => `${i + 1}. "${t.name}"${t.description ? ` — ${t.description}` : ''}`)
    .join('\n')

  const systemPrompt = `Eres un experto en educación mexicana especializado en evaluación diagnóstica.
Tu tarea es crear UNA pregunta diagnóstica de opción múltiple por cada tema de ${subjectName} para ${educationContext}.
Las preguntas deben ser de dificultad MEDIA — ni muy fáciles ni muy difíciles.
Cada pregunta debe evaluar la comprensión conceptual del tema, no memorización.
Los distractores deben ser plausibles — errores típicos que cometen los estudiantes.
Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional.`

  const userPrompt = `Genera exactamente ${topics.length} preguntas diagnósticas para ${subjectName} — ${educationContext}.

Temas a evaluar (en este orden exacto):
${topicsList}

Para cada tema genera UNA pregunta de dificultad media que evalúe si el alumno comprende el concepto principal.

REGLA CRÍTICA SOBRE correct_answer: La respuesta correcta DEBE variar entre A, B, C y D de forma distribuida a lo largo de todas las preguntas. NUNCA pongas la misma letra como correcta más de 2 veces seguidas. El ejemplo de abajo usa "B" — no copies esa letra para todas las preguntas.

Responde con este JSON exacto:
{
  "questions": [
    {
      "topic_index": 0,
      "question": "pregunta clara y directa sobre el concepto principal del tema",
      "options": [
        { "letter": "A", "text": "distractor plausible — error típico" },
        { "letter": "B", "text": "respuesta correcta aquí" },
        { "letter": "C", "text": "distractor plausible — confusión común" },
        { "letter": "D", "text": "distractor plausible — error de concepto" }
      ],
      "correct_answer": "B",
      "explanation": "Por qué B es correcta y cuál es el error conceptual de las otras opciones. Máximo 60 palabras."
    }
  ]
}

Genera exactamente ${topics.length} objetos en el array "questions", uno por cada tema en el orden dado.
Distribuye las respuestas correctas: aproximadamente 25% A, 25% B, 25% C, 25% D a lo largo de todas las preguntas.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(500 * topics.length + 500, 8000),
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    let clean = rawText.replace(/```json|```/g, '').trim()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (jsonMatch) clean = jsonMatch[0]

    let generated: { questions: Array<{
      topic_index: number
      question: string
      options: { letter: string; text: string }[]
      correct_answer: string
      explanation: string
    }> }

    try {
      generated = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from Claude. Please try again.' }, { status: 500 })
    }

    if (!generated.questions || !Array.isArray(generated.questions)) {
      return NextResponse.json({ error: 'Invalid response structure from Claude.' }, { status: 500 })
    }

    // Delete existing diagnostic questions for this subject+grade
    await supabase
      .from('diagnostic_questions')
      .delete()
      .eq('subject_id', subjectId)
      .eq('grade', grade)
      .eq('education_level', level)

    // Insert new diagnostic questions
    const questionsToInsert = generated.questions.map((q) => {
      const topic = topics[q.topic_index] ?? topics[0]
      return {
        subject_id: subjectId,
        topic_id: topic.id,
        topic_name: topic.name,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        education_level: level,
        grade,
        display_order: q.topic_index,
      }
    })

    const { data: inserted, error: insertError } = await supabase
      .from('diagnostic_questions')
      .insert(questionsToInsert)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save questions: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: inserted?.length ?? 0,
      questions: inserted,
    })

  } catch (error) {
    console.error('Generate diagnostic error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
