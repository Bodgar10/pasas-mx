import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres un tutor para estudiantes mexicanos.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.
La respuesta debe ser un objeto JSON con exactamente estas claves:
{
  "title": "máximo 8 palabras",
  "explanation": "máximo 40 palabras",
  "bullets": ["máximo 6 palabras", "máximo 6 palabras", "máximo 6 palabras"]
}
NO uses comillas dentro de los valores de texto. NO uses caracteres especiales.`

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

    const callAnthropic = async (retries = 1) => {
      try {
        return await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userMessage }],
        })
      } catch (error: any) {
        if (retries > 0 && error.message?.includes('overloaded')) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          return callAnthropic(retries - 1)
        }
        throw error
      }
    }

    const response = await callAnthropic()

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
