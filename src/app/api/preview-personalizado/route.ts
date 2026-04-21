import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres un tutor educativo para estudiantes mexicanos de secundaria, preparatoria y exámenes de admisión.
Tu tarea es generar una vista previa de guía de estudio personalizada en español mexicano.

Dado el nivel educativo del estudiante, su tema de interés (hobby), la materia que le falla, y su diagnóstico, genera:
1. Un título atractivo y motivador que conecte la materia con el hobby del estudiante
2. Una breve explicación (2-3 oraciones) de cómo se abordaría el aprendizaje
3. Exactamente 3 bullets concretos de lo que el estudiante aprendería

Responde SOLO con JSON válido en este formato exacto:
{
  "title": "...",
  "explanation": "...",
  "bullets": ["...", "...", "..."]
}

Usa lenguaje cercano, motivador y adaptado a adolescentes mexicanos. Conecta siempre la materia con el hobby del estudiante.`

export async function POST(request: Request) {
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY)
  try {
    const body = await request.json() as {
      subject: string
      theme: string
      diagnostico: string
      level: string
    }

    const { subject, theme, diagnostico, level } = body

    if (!subject || !theme || !diagnostico || !level) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const userMessage = `Nivel educativo: ${level}
Hobby/interés: ${theme}
Materia: ${subject}
Diagnóstico del estudiante: ${diagnostico}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    const rawText = textBlock.text
    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(cleanText) as {
      title: string
      explanation: string
      bullets: string[]
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Anthropic error:', error)
    const message = error instanceof Error ? error.message : 'Error al generar la vista previa'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
