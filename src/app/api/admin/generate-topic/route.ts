import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { topicId, topicName, topicSlug: _topicSlug, subjectName, themeId, themeName, grade } =
    await req.json()

  const client = new Anthropic()

  const systemPrompt = `Eres un experto en educación mexicana de nivel secundaria y preparatoria.
Tu tarea es generar contenido educativo de alta calidad para estudiantes mexicanos de ${grade}° grado.
El contenido debe usar la temática "${themeName}" para crear analogías y ejemplos creativos y relevantes.
IMPORTANTE: Usa referencias específicas y reales de "${themeName}" — no genéricas.
Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional.`

  const userPrompt = `Genera el contenido completo para el tema "${topicName}" de la materia "${subjectName}".
Temática: ${themeName}

Responde con este JSON exacto:
{
  "sections": [
    {
      "type": "explanation",
      "title": "título corto",
      "content": "explicación clara del concepto. Usa **negritas** para términos clave. Máximo 120 palabras.",
      "display_order": 1
    },
    {
      "type": "analogy",
      "title": "título de la analogía",
      "content": "analogía creativa usando ${themeName}. Conecta el concepto con algo específico de ${themeName}. Máximo 100 palabras.",
      "display_order": 2
    },
    {
      "type": "example",
      "title": "Ejemplo resuelto",
      "content": "ejemplo paso a paso con **pasos numerados** claros. Máximo 150 palabras.",
      "display_order": 3
    },
    {
      "type": "key_fact",
      "title": "Lo que debes recordar",
      "content": "el dato más importante del tema en 1-2 oraciones. Usa **negritas** en lo crítico.",
      "display_order": 4
    },
    {
      "type": "tip",
      "title": "Tip para el examen",
      "content": "consejo práctico para no fallar en el examen. Máximo 60 palabras.",
      "display_order": 5
    }
  ],
  "quiz_questions": [
    {
      "question": "pregunta clara y específica sobre ${topicName}",
      "options": [
        { "letter": "A", "text": "opción A" },
        { "letter": "B", "text": "opción B" },
        { "letter": "C", "text": "opción C" },
        { "letter": "D", "text": "opción D" }
      ],
      "correct_answer": "A",
      "explanation": "explicación de por qué es correcta y por qué las otras son incorrectas. Máximo 60 palabras.",
      "difficulty": 1,
      "xp_reward": 20
    }
  ]
}

Genera 5 secciones (una de cada tipo) y 3 preguntas de quiz (difficulty: 1 fácil, 2 media, 3 difícil con xp_reward 20/30/50).
Las preguntas deben ser variadas en dificultad.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = rawText.replace(/```json|```/g, '').trim()
    const generated = JSON.parse(clean)

    // Delete existing sections for this topic+theme (regenerate flow)
    await supabase.from('sections').delete().eq('topic_id', topicId).eq('theme_id', themeId)

    // Insert new sections
    const sectionsToInsert = generated.sections.map((s: {
      type: string
      title: string
      content: string
      display_order: number
    }) => ({
      topic_id: topicId,
      theme_id: themeId,
      user_id: null,
      type: s.type,
      title: s.title,
      content: s.content,
      display_order: s.display_order,
      interests_used: [themeName],
    }))

    const { data: insertedSections } = await supabase
      .from('sections')
      .insert(sectionsToInsert)
      .select()

    // Insert quiz questions only if none exist yet
    const { count } = await supabase
      .from('quiz_questions')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', topicId)

    let insertedQuestions: unknown[] = []
    if ((count ?? 0) === 0) {
      const questionsToInsert = generated.quiz_questions.map((q: {
        question: string
        options: { letter: string; text: string }[]
        correct_answer: string
        explanation: string
        difficulty: number
        xp_reward: number
      }) => ({
        topic_id: topicId,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        xp_reward: q.xp_reward,
        source: 'ai',
      }))
      const { data } = await supabase.from('quiz_questions').insert(questionsToInsert).select()
      insertedQuestions = data ?? []
    } else {
      const { data } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('topic_id', topicId)
      insertedQuestions = data ?? []
    }

    return NextResponse.json({
      sections: insertedSections,
      quizQuestions: insertedQuestions,
    })
  } catch (error) {
    console.error('Generate topic error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
