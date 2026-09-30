import { NextResponse } from 'next/server'
import { registrarAvance, type EventoAvance } from '@/lib/horda-publica-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/horda-publica/avance { topicId, anonId, evento, oleada?, eleccion?, origen? }
 *
 * Medición de la Horda pública en la base (cuenta a todos, acepten o no
 * cookies). La validación fina la hace `horda_publica_registrar`.
 * Siempre responde 204: el juego no espera ni muestra nada de esto.
 */
export async function POST(req: Request) {
  let b: Record<string, unknown>
  try {
    b = await req.json()
  } catch {
    return new NextResponse(null, { status: 204 })
  }
  const { topicId, anonId, evento, oleada, eleccion, origen, canal, utm_source, utm_campaign } = b
  const texto = (v: unknown) => (typeof v === 'string' ? v : null)

  let e: EventoAvance | null = null
  if (evento === 'inicio') e = { evento }
  else if (evento === 'oleada' && typeof oleada === 'number') e = { evento, oleada }
  else if (evento === 'eleccion' && (eleccion === 'estudiante' || eleccion === 'adulto')) e = { evento, eleccion }

  if (e && typeof topicId === 'string' && typeof anonId === 'string') {
    await registrarAvance(anonId, topicId, e, texto(origen), {
      canal: texto(canal),
      utm_source: texto(utm_source),
      utm_campaign: texto(utm_campaign),
    })
  }
  return new NextResponse(null, { status: 204 })
}
