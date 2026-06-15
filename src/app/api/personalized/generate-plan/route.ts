export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(url, key)
}

export async function POST(req: NextRequest) {
  const { userId, subjectId, themeId, weakTopicIds, topicId } = await req.json()

  if (!userId || !subjectId || !themeId || !weakTopicIds?.length || !topicId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const [{ data: topics }, { data: subject }, { data: theme }, { data: userProfile }] = await Promise.all([
    supabase.from('topics').select('id, name, slug, description, difficulty, grade').in('id', weakTopicIds),
    supabase.from('subjects').select('id, name, slug').eq('id', subjectId).single(),
    supabase.from('themes').select('id, name').eq('id', themeId).single(),
    supabase.from('users').select('education_level, grade').eq('id', userId).single(),
  ])

  if (!topics || !subject || !theme || !userProfile) {
    return NextResponse.json({ error: 'Failed to fetch required data' }, { status: 500 })
  }

  function getEducationContext(level: string, grade: number): string {
    switch (level) {
      case 'middle_school': return `${grade}° de secundaria`
      case 'high_school': return `${grade}° de preparatoria`
      case 'exam_prepa': return `preparación para examen de ingreso a preparatoria (COMIPEMS)`
      case 'exam_uni': return `preparación para examen de ingreso a universidad (UNAM/IPN)`
      default: return `${grade}° grado`
    }
  }

  const educationContext = getEducationContext(userProfile.education_level, userProfile.grade)
  const client = new Anthropic()
  const topicToGenerate = topics.find(t => t.id === weakTopicIds[0])
  if (!topicToGenerate) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 400 })
  }

  const topic = topicToGenerate
  const results = []

  try {
      const systemPrompt = `Eres un experto en educación mexicana y storytelling pedagógico.
Tu tarea es generar contenido educativo inmersivo y EXTENSO para un alumno específico de ${educationContext} que necesita refuerzo en este tema.
REGLA MÁS IMPORTANTE: La temática "${theme.name}" no es un adorno — es el MUNDO donde ocurre todo el contenido.
El alumno debe sentir que está aprendiendo ${subject.name} DENTRO de "${theme.name}", no que alguien lo menciona de pasada.

ANTES DE ESCRIBIR CUALQUIER SECCIÓN, identifica mentalmente:
1. Los 5 personajes, figuras o elementos MÁS FAMOSOS y reconocibles de "${theme.name}" a nivel mundial en 2024-2025
2. Las 3 situaciones o contextos MÁS ICÓNICOS de "${theme.name}" que cualquier fan reconocería al instante
3. Los términos, mecánicas o conceptos MÁS USADOS por la comunidad real de "${theme.name}"

Usa SIEMPRE lo más famoso, no lo más oscuro. Un alumno promedio de 13-18 años en México debe reconocer inmediatamente cada referencia.
Si el alumno lee la analogía y NO reconoce el personaje o situación, fallaste.
Nada genérico. Nada inventado. Solo referencias reales y populares de "${theme.name}".

Este es un plan PERSONALIZADO — el contenido debe ser más extenso, profundo y variado que el estándar.
Este alumno FALLÓ en este tema en el diagnóstico — necesita explicación especialmente clara y ejemplos concretos.
Adapta vocabulario y complejidad a ${educationContext}.
Para los bloques interactivos (sort, scrubber, steps): la respuesta correcta y los números deben ser exactos — no inventes datos ni fórmulas. Mantén la temática "${theme.name}" también en ellos.
Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional.`

      const userPrompt = `Genera contenido educativo PERSONALIZADO para:
- Tema: "${topic.name}"
- Materia: "${subject.name}"
- Nivel: ${educationContext}
- Temática: "${theme.name}"
- Este alumno FALLÓ en este tema en el diagnóstico — necesita explicación clara y ejemplos concretos

Genera este JSON con 5 secciones y 5 preguntas de quiz:

{
  "sections": [
    {
      "type": "analogy",
      "title": "título con referencia específica de ${theme.name}",
      "content": "Situación concreta de ${theme.name}. El concepto emerge naturalmente de la situación. Máximo 100 palabras.",
      "display_order": 1
    },
    {
      "type": "explanation",
      "title": "título que conecte la situación con el concepto formal",
      "content": "Explica el concepto formal con **negritas** en lo más crítico. Incluye fórmula o regla principal si aplica. Máximo 100 palabras.",
      "display_order": 2
    },
    {
      "type": "example",
      "title": "Ejemplo resuelto — situación de ${theme.name}",
      "content": "Problema dentro de ${theme.name}. Resuelto paso a paso con **pasos numerados**. Máximo 120 palabras.",
      "display_order": 3
    },
    {
      "type": "key_fact",
      "title": "Lo que debes recordar",
      "content": "Definición formal en 1-2 oraciones con **negritas** en lo más crítico. Máximo 50 palabras.",
      "display_order": 4
    },
    {
      "type": "tip",
      "title": "Tip para no fallar en el examen",
      "content": "Truco práctico para recordar el concepto o evitar el error más común. Máximo 50 palabras.",
      "display_order": 5
    }
  ],
  "quiz_questions": [
    {
      "question": "pregunta básica sobre el concepto",
      "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}],
      "correct_answer": "B",
      "explanation": "explicación clara. Máximo 50 palabras.",
      "difficulty": 1,
      "xp_reward": 20
    },
    {
      "question": "pregunta básica diferente",
      "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}],
      "correct_answer": "C",
      "explanation": "explicación. Máximo 50 palabras.",
      "difficulty": 1,
      "xp_reward": 20
    },
    {
      "question": "pregunta media — aplica el concepto en contexto de ${theme.name}",
      "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}],
      "correct_answer": "A",
      "explanation": "explicación. Máximo 50 palabras.",
      "difficulty": 2,
      "xp_reward": 30
    },
    {
      "question": "pregunta media — variación del concepto",
      "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}],
      "correct_answer": "D",
      "explanation": "explicación. Máximo 50 palabras.",
      "difficulty": 2,
      "xp_reward": 30
    },
    {
      "question": "pregunta difícil — razonamiento o caso complejo de ${theme.name}",
      "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}],
      "correct_answer": "C",
      "explanation": "explicación con distractores plausibles. Máximo 50 palabras.",
      "difficulty": 3,
      "xp_reward": 50
    }
  ]
}

ADEMÁS de las 5 secciones de texto, agrega al MISMO array "sections" entre 1 y 3 BLOQUES INTERACTIVOS sobre el mismo concepto, dentro del mundo de "${theme.name}". Como este alumno falló el tema, los bloques deben reforzar lo básico. No llevan texto largo: llevan un objeto "data". Continúa el display_order después de 5. Elige el tipo según el contenido y NO repitas el mismo tipo:
- "steps": proceso paso a paso o acumulación de una cantidad. "visual":"bar" si hay un número que sube/baja (cada paso lleva "delta" numérico) más "start" inicial; "visual":"chain" para pasos narrativos (cada paso solo "text").
- "sort": clasificar en 2 categorías (máx 3). 4 a 6 items; cada item lleva "b" = índice de la cubeta correcta (0,1,...).
- "scrubber": un eje/continuo (recta numérica, línea del tiempo, escala). "min" < "max", "start" en rango, 2 a 5 "points" con valor "v" y etiqueta "l".

No inventes datos ni números; si hay matemáticas, deben ser exactos. Formato EXACTO de cada bloque interactivo:
{ "type": "scrubber", "title": "Pruébalo", "content": "frase corta de respaldo", "display_order": 6, "data": { "intro": "1-2 frases con la temática", "unit": "qué se mide", "min": -64, "max": 120, "start": 64, "points": [ { "v": 64, "l": "etiqueta" } ], "question": "opcional" } }
{ "type": "sort", "title": "Clasifica", "content": "frase corta de respaldo", "display_order": 7, "data": { "prompt": "instrucción en una frase", "buckets": ["A","B"], "items": [ { "t": "texto", "b": 0 } ] } }
{ "type": "steps", "title": "Resuélvelo conmigo", "content": "frase corta de respaldo", "display_order": 8, "data": { "intro": "1-2 frases con la temática", "visual": "bar", "start": 75, "steps": [ { "text": "qué pasa", "delta": -40 } ] } }`

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
      let clean = rawText.replace(/```json|```/g, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (jsonMatch) clean = jsonMatch[0]

      const generated = JSON.parse(clean)

      await supabase.from('sections').delete()
        .eq('topic_id', topic.id)
        .eq('theme_id', themeId)
        .eq('user_id', userId)

      const sectionsToInsert = generated.sections.map((s: {
        type: string; title: string; content: string; display_order: number; data?: Record<string, unknown> | null
      }) => ({
        topic_id: topic.id,
        theme_id: themeId,
        user_id: userId,
        type: s.type,
        title: s.title,
        content: s.content,
        display_order: s.display_order,
        data: s.data ?? null,
        interests_used: [theme.name],
      }))

      await supabase.from('quiz_questions').delete()
        .eq('topic_id', topic.id)
        .eq('theme_id', themeId)

      const questionsToInsert = generated.quiz_questions.map((q: {
        question: string; options: {letter: string; text: string}[];
        correct_answer: string; explanation: string; difficulty: number; xp_reward: number
      }) => ({
        topic_id: topic.id,
        theme_id: themeId,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        xp_reward: q.xp_reward,
        source: 'ai',
      }))

      const [{ error: sectionsError }, { error: quizError }] = await Promise.all([
        supabase.from('sections').insert(sectionsToInsert),
        supabase.from('quiz_questions').insert(questionsToInsert),
      ])

      results.push({
        topicId: topic.id,
        topicName: topic.name,
        sectionsError: sectionsError?.message ?? null,
        quizError: quizError?.message ?? null,
        success: !sectionsError && !quizError,
      })

      console.log(`[generate-plan] Topic "${topic.name}" — sections: ${sectionsError?.message ?? 'OK'} | quiz: ${quizError?.message ?? 'OK'}`)

  } catch (error) {
    const errorMessage = String(error)
    console.error(`[generate-plan] Error generating topic "${topic.name}":`, error)
    return NextResponse.json({
      topicId: topic.id,
      topicName: topic.name,
      success: false,
      error: errorMessage,
      error_type: errorMessage.includes('timeout') || errorMessage.includes('AbortError') ? 'timeout' : 'generation_error',
    }, { status: 500 })
  }

  return NextResponse.json({ success: true, topicId: topic.id, topicName: topic.name })
}
