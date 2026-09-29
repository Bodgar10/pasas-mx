import { NextResponse } from 'next/server'
import { preguntasDeOleada } from '@/lib/horda-publica-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/horda-publica/oleada { topicId, wave } — preguntas de una oleada
 * de la Horda pública, SIN la respuesta correcta.
 *
 * Solo oleadas 1 a 3 y solo temas de materias públicas. Sin sesión y sin
 * escribir nada: la partida pública vive en el navegador.
 */
export async function POST(req: Request) {
  let body: { topicId?: unknown; wave?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { topicId, wave } = body
  if (typeof topicId !== 'string' || typeof wave !== 'number') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const preguntas = await preguntasDeOleada(topicId, wave)
  if (!preguntas || preguntas.length === 0) {
    return NextResponse.json({ error: 'Oleada no disponible' }, { status: 404 })
  }

  return NextResponse.json({ questions: revolver(preguntas) })
}

function revolver<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
