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
El alumno debe sentir que está aprendiendo DENTRO de "${themeName}", no que alguien lo menciona de pasada.

ANTES DE ESCRIBIR CUALQUIER SECCIÓN, identifica mentalmente:
1. Los 5 personajes, figuras o elementos MÁS FAMOSOS y reconocibles de "${themeName}" a nivel mundial en 2024-2025
2. Las 3 situaciones o contextos MÁS ICÓNICOS de "${themeName}" que cualquier fan reconocería al instante
3. Los términos, mecánicas o conceptos MÁS USADOS por la comunidad real de "${themeName}"

Usa SIEMPRE lo más famoso, no lo más oscuro. Un alumno promedio de 13-18 años en México debe reconocer inmediatamente cada referencia.
Si el alumno lee la analogía y NO reconoce el personaje o situación, fallaste.
Nada genérico. Nada inventado. Solo referencias reales y populares de "${themeName}".

Adapta vocabulario y complejidad a ${educationContext}.
${isExam ? 'Enfócate en conceptos frecuentes en exámenes de admisión, con distractores plausibles en el quiz.' : ''}
Para los bloques interactivos (sort, scrubber, steps): la respuesta correcta y los números deben ser exactos — no inventes datos ni fórmulas. Mantén la temática "${themeName}" también en ellos.
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

Genera 5 secciones (analogy, explanation, example, key_fact, tip) y 5 preguntas de quiz.

Además de las 5 secciones anteriores, agrega al MISMO array "sections" entre 1 y 3 BLOQUES INTERACTIVOS que refuercen el mismo concepto, dentro del mundo de ${themeName}. Estos bloques NO llevan texto largo: llevan un objeto "data" con su configuración. Elige el tipo según el contenido:

- "steps": procesos paso a paso o acumulación de una cantidad. Usa "visual":"bar" cuando hay un número que sube/baja (vida, dinero, puntos) y cada paso lleva "delta" numérico; usa "visual":"chain" para pasos narrativos sin número (cada paso solo "text").
- "sort": clasificar cosas en 2 categorías (2 es lo ideal; máx 4). De 4 a 6 items; cada item lleva "b" = índice de la cubeta correcta (0,1,...), siempre dentro del rango de "buckets". Etiquetas de cubeta CORTAS: máx ~20 caracteres de texto principal. Si el alumno necesita una pista para decidir, va entre paréntesis al final. OK: "Ácido (tornasol rojo, pH < 7)". MAL: "Es ácido porque el tornasol se pone rojo". Nunca una oración completa como nombre de cubeta.
- "scrubber": un eje o continuo (recta numérica, línea del tiempo, escala). "min" < "max", "start" dentro del rango, de 2 a 5 "points" con su valor "v" y etiqueta "l".

Si el tema no encaja con naturalidad en ninguna mecánica, NO fuerces bloques interactivos.

Cada bloque interactivo sigue EXACTAMENTE este formato (continúa el display_order después de 5):

{
  "type": "scrubber",
  "title": "Pruébalo",
  "content": "frase corta de respaldo (accesibilidad)",
  "display_order": 6,
  "data": {
    "intro": "1-2 frases con la temática",
    "unit": "qué se mide",
    "min": -64, "max": 120, "start": 64,
    "points": [ { "v": 64, "l": "etiqueta" } ],
    "question": "frase opcional"
  }
}
{
  "type": "sort",
  "title": "Clasifica",
  "content": "frase corta de respaldo",
  "display_order": 7,
  "data": {
    "prompt": "instrucción en una frase",
    "buckets": ["Etiqueta corta (pista breve)", "Otra etiqueta (pista breve)"],
    "items": [ { "t": "texto", "b": 0 } ]
  }
}
{
  "type": "steps",
  "title": "Resuélvelo conmigo",
  "content": "frase corta de respaldo",
  "display_order": 8,
  "data": {
    "intro": "1-2 frases con la temática",
    "visual": "bar",
    "start": 75,
    "steps": [ { "text": "qué pasa", "delta": -40 } ]
  }
}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Clean markdown fences if present
    let clean = rawText.replace(/```json|```/g, '').trim()

    // Try to extract JSON object if there's extra text around it
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      clean = jsonMatch[0]
    }

    let generated
    try {
      generated = JSON.parse(clean)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw text from Claude:', rawText.substring(0, 500))
      return NextResponse.json({ error: 'Generation failed — invalid JSON from Claude. Please try again.' }, { status: 500 })
    }

    // Validate structure
    if (!generated.sections || !Array.isArray(generated.sections)) {
      console.error('Invalid structure — missing sections:', JSON.stringify(generated).substring(0, 200))
      return NextResponse.json({ error: 'Generation failed — missing sections. Please try again.' }, { status: 500 })
    }

    if (!generated.quiz_questions || !Array.isArray(generated.quiz_questions)) {
      console.error('Invalid structure — missing quiz_questions')
      generated.quiz_questions = []
    }

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
      data?: Record<string, unknown> | null
    }) => ({
      topic_id: topicId,
      theme_id: themeId,
      user_id: null,
      type: s.type,
      title: s.title,
      content: s.content,
      display_order: s.display_order,
      data: s.data ?? null,
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
