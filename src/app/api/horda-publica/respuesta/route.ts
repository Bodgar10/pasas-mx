import { NextResponse } from 'next/server'
import { revisarRespuesta } from '@/lib/horda-publica-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/horda-publica/respuesta { topicId, questionId, letter } — revisa
 * UNA respuesta y devuelve si fue correcta, la pista y la explicación.
 *
 * Nunca manda todas las respuestas juntas. Las cuentas de la oleada (4 de 5
 * avanza, 3 repite, 2 o menos reinicia) las lleva el navegador: no hay XP ni
 * premio, así que no hace falta llevarlas aquí.
 */
export async function POST(req: Request) {
  let body: { topicId?: unknown; questionId?: unknown; letter?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { topicId, questionId, letter } = body
  if (
    typeof topicId !== 'string' ||
    typeof questionId !== 'string' ||
    typeof letter !== 'string' ||
    !['A', 'B', 'C', 'D'].includes(letter)
  ) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const r = await revisarRespuesta(topicId, questionId, letter)
  if (!r) return NextResponse.json({ error: 'Pregunta no disponible' }, { status: 404 })
  return NextResponse.json(r)
}
