export const maxDuration = 60

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

  const { topicId, topicName, topicSlug: _topicSlug, subjectName, themeId, themeName, grade, level } =
    await req.json()

  function getEducationContext(level: string, grade: number): string {
    switch (level) {
      case 'middle_school': return `${grade}° de secundaria`
      case 'high_school':   return `${grade}° de preparatoria`
      case 'exam_prepa':    return `preparación para examen de ingreso a preparatoria (COMIPEMS)`
      case 'exam_uni':      return `preparación para examen de ingreso a universidad (UNAM/IPN)`
      default:              return `${grade}° grado`
    }
  }

  const educationContext = getEducationContext(level ?? 'middle_school', grade)
  const isExam = level === 'exam_prepa' || level === 'exam_uni'

  const client = new Anthropic()

  const systemPrompt = `Eres un experto en educación mexicana y storytelling pedagógico.
Tu tarea es generar contenido educativo inmersivo para estudiantes mexicanos de ${educationContext}.
REGLA MÁS IMPORTANTE: La temática "${themeName}" no es un adorno — es el MUNDO donde ocurre todo el contenido.
El alumno debe sentir que está aprendiendo matemáticas DENTRO de ${themeName}, no que alguien le menciona ${themeName} de pasada.
Cada sección debe usar personajes, situaciones, mecánicas o referencias MUY ESPECÍFICAS de "${themeName}".
Nada genérico. Si la temática es Minecraft, usa creepers, redstone, chunks, biomas — no solo "un juego".
Si es K-pop, usa fandoms, lightsticks, music shows, comebacks — no solo "una canción".
Si es Fútbol, usa posiciones, tiros libres, VAR, estadios específicos — no solo "un partido".
Si es Anime, usa poderes, arcos argumentales, personajes conocidos — no solo "un personaje".
Adapta vocabulario y complejidad a ${educationContext}.
${isExam ? 'Enfócate en conceptos frecuentes en exámenes de admisión, con distractores plausibles en el quiz.' : ''}
Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional.`

  const userPrompt = `Genera contenido educativo inmersivo para:
- Tema: "${topicName}"
- Materia: "${subjectName}"
- Nivel: ${educationContext}
- Temática: "${themeName}"

INSTRUCCIÓN CRÍTICA: Cada sección debe desarrollar una situación REAL y ESPECÍFICA de "${themeName}".
No menciones "${themeName}" solo una vez — construye toda la narrativa dentro de ese mundo.

Genera este JSON exacto con las secciones EN ESTE ORDEN (primero la analogía, luego la explicación):

{
  "sections": [
    {
      "type": "analogy",
      "title": "título que mencione algo específico de ${themeName}",
      "content": "Empieza con una situación concreta y detallada de ${themeName}. Describe el escenario, los personajes o elementos involucrados. Plantea el problema que surge naturalmente en ese contexto. Usa detalles específicos de ${themeName} — nombres, mecánicas, situaciones reales del universo de ${themeName}. Mínimo 100 palabras. El concepto matemático/académico debe emerger naturalmente de la situación, no al revés.",
      "display_order": 1
    },
    {
      "type": "explanation",
      "title": "título que conecte la situación anterior con el concepto formal",
      "content": "Arranca con 'Lo que acabas de ver en [situación de ${themeName}] es exactamente [concepto].' Luego explica el concepto formal usando **negritas** para términos clave. Conecta cada parte del concepto con elementos de la situación anterior. Máximo 100 palabras.",
      "display_order": 2
    },
    {
      "type": "example",
      "title": "Ejemplo resuelto — situación diferente de ${themeName}",
      "content": "Plantea un problema NUEVO dentro de ${themeName}, diferente al de la analogía. Resuélvelo paso a paso con **pasos numerados**. Los datos del problema deben venir del universo de ${themeName}. Muestra la operación completa. Máximo 120 palabras.",
      "display_order": 3
    },
    {
      "type": "key_fact",
      "title": "Lo que debes recordar",
      "content": "La definición formal del concepto en 1-2 oraciones con **negritas** en lo más crítico. Incluye la fórmula o regla principal si aplica.",
      "display_order": 4
    },
    {
      "type": "tip",
      "title": "${isExam ? 'Tip para el examen de admisión' : 'Tip para no fallar en el examen'}",
      "content": "${isExam ? 'Consejo estratégico específico para resolver este tipo de pregunta rápido en COMIPEMS/UNAM. Menciona el tipo de trampa más común en las opciones.' : 'Truco práctico para recordar el concepto o evitar el error más común.'} Máximo 50 palabras.",
      "display_order": 5
    }
  ],
  "quiz_questions": [
    {
      "question": "pregunta de dificultad básica — puede tener contexto de ${themeName}",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "A",
      "explanation": "por qué es correcta y cuál es el error típico de las otras opciones. Máximo 50 palabras.",
      "difficulty": 1,
      "xp_reward": 20
    },
    {
      "question": "pregunta de dificultad media — requiere aplicar el concepto",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "B",
      "explanation": "por qué es correcta. Máximo 50 palabras.",
      "difficulty": 2,
      "xp_reward": 30
    },
    {
      "question": "pregunta difícil — requiere razonamiento, no memorización",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "C",
      "explanation": "por qué es correcta y por qué los distractores son plausibles. Máximo 50 palabras.",
      "difficulty": 3,
      "xp_reward": 50
    },
    {
      "question": "pregunta de dificultad media — aplica el concepto en contexto diferente de ${themeName}",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "D",
      "explanation": "por qué es correcta y cuál es el error típico. Máximo 50 palabras.",
      "difficulty": 2,
      "xp_reward": 30
    },
    {
      "question": "pregunta difícil — combina conceptos o requiere varios pasos de razonamiento",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "A",
      "explanation": "por qué es correcta y por qué los distractores son plausibles. Máximo 50 palabras.",
      "difficulty": 3,
      "xp_reward": 50
    }
  ]
}

Genera 5 secciones (una de cada tipo) y 5 preguntas de quiz (difficulty 1, 2, 2, 3, 3 — xp_reward 20, 30, 30, 50, 50). Todas las preguntas deben tener contexto de ${themeName}.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = rawText.replace(/```json|```/g, '').trim()
    const generated = JSON.parse(clean)

    await supabase
      .from('topics')
      .update({ published: false })
      .eq('id', topicId)

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

    const { data: insertedSections, error: sectionsError } = await supabase
      .from('sections')
      .insert(sectionsToInsert)
      .select()

    console.error('Sections insert error:', sectionsError)
    console.log('Sections insert result:', insertedSections)

    // If RLS blocks the insert, return the generated data directly
    // so the frontend can still show it (even if not persisted yet)
    const sectionsToReturn = insertedSections ?? sectionsToInsert.map((s: Record<string, unknown>, i: number) => ({
      ...s,
      id: `temp-${i}`,
    }))

    // Always delete and regenerate quiz questions for this topic+theme
    await supabase
      .from('quiz_questions')
      .delete()
      .eq('topic_id', topicId)
      .eq('theme_id', themeId)

    const questionsToInsert = generated.quiz_questions.map((q: {
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

    const { data: insertedQuestions, error: quizError } = await supabase
      .from('quiz_questions')
      .insert(questionsToInsert)
      .select()

    console.error('Quiz insert error:', quizError)
    console.log('Quiz insert result:', insertedQuestions)

    return NextResponse.json({
      sections: sectionsToReturn,
      quizQuestions: insertedQuestions,
    })
  } catch (error) {
    console.error('Generate topic error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
