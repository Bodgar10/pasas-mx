import { NextResponse } from 'next/server'
import { registrarPartida } from '@/lib/arcade-server'
import { RONDAS_POR_RETO } from '@/lib/arcade'

/**
 * POST /api/arcade/play — partida anónima del reto diario.
 *
 * El cliente manda QUÉ TOCÓ, no si acertó: la base recalcula los aciertos
 * contra `odd_index`. Repetir la llamada no cuenta doble (UNIQUE por día y
 * navegador), así que también sirve para releer las cifras al volver.
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { date, anonId, picks, origen, canal, utm_source, utm_campaign } = (body ?? {}) as {
    date?: unknown
    anonId?: unknown
    picks?: unknown
    origen?: unknown
    canal?: unknown
    utm_source?: unknown
    utm_campaign?: unknown
  }

  const valido =
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    typeof anonId === 'string' &&
    anonId.length >= 8 &&
    anonId.length <= 64 &&
    Array.isArray(picks) &&
    picks.length === RONDAS_POR_RETO &&
    picks.every((p) => Number.isInteger(p) && p >= 0 && p <= 3)

  if (!valido) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // `origen` lo valida la base contra su lista; cualquier otra cosa queda NULL.
  const texto = (v: unknown) => (typeof v === 'string' ? v : null)
  const cifras = await registrarPartida(date, anonId, picks as number[], texto(origen), {
    canal: texto(canal),
    utm_source: texto(utm_source),
    utm_campaign: texto(utm_campaign),
  })
  if (!cifras) {
    // Reto vencido o inexistente. No es un error del jugador que valga la pena mostrar.
    return NextResponse.json({ cifras: null }, { status: 200 })
  }
  return NextResponse.json({ cifras })
}
