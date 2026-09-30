import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { LEGAL_VERSION } from '@/lib/legal'
import { correoValido, db, enviarConfirmacion, token } from '@/lib/arcade/recordatorio'

export const dynamic = 'force-dynamic'

const LIMITE_24H = 3
const REENVIO_MS = 10 * 60 * 1000

/**
 * POST /api/arcade/recordatorio { email, mayor, trampa, anonId, canal }
 *
 * Alta al recordatorio del reto (doble opt-in). s34-F5.
 *
 * 🔴 NUNCA revela si un correo ya estaba suscrito: toda salida válida
 * responde lo mismo, `{ ok: true }`. Solo cambian los errores de formato
 * (correo inválido, casilla sin marcar) y el límite de solicitudes.
 */
export async function POST(req: Request) {
  if (!FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO) return NextResponse.json({ error: 'No disponible' }, { status: 404 })

  let b: Record<string, unknown>
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Campo trampa: un humano no lo ve. Si viene lleno, se finge éxito.
  if (typeof b.trampa === 'string' && b.trampa.trim() !== '') return NextResponse.json({ ok: true })

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!correoValido(email)) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 })
  if (b.mayor !== true) return NextResponse.json({ error: 'Marca la casilla de mayor de edad.' }, { status: 400 })

  const anonId = typeof b.anonId === 'string' && b.anonId.length >= 8 && b.anonId.length <= 64 ? b.anonId : null
  const canal = typeof b.canal === 'string' ? b.canal.slice(0, 20) : null
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null

  const s = db()
  const desde = new Date(Date.now() - 86_400_000).toISOString()

  // Límite: 3 altas cada 24 h por navegador y por IP.
  const [porAnon, porIp] = await Promise.all([
    anonId
      ? s.from('arcade_suscriptores').select('id', { count: 'exact', head: true }).eq('anon_id', anonId).gte('created_at', desde)
      : Promise.resolve({ count: 0 }),
    ip
      ? s.from('arcade_suscriptores').select('id', { count: 'exact', head: true }).eq('consentimiento_ip', ip).gte('created_at', desde)
      : Promise.resolve({ count: 0 }),
  ])
  if ((porAnon.count ?? 0) >= LIMITE_24H || (porIp.count ?? 0) >= LIMITE_24H) {
    return NextResponse.json({ error: 'Demasiados intentos. Prueba mañana.' }, { status: 429 })
  }

  const { data: existente } = await s
    .from('arcade_suscriptores')
    .select('id, estado, created_at, token_confirmacion')
    .eq('email', email)
    .maybeSingle()

  if (!existente) {
    const tConfirmar = token()
    const { error } = await s.from('arcade_suscriptores').insert({
      email,
      token_confirmacion: tConfirmar,
      token_baja: token(),
      mayor_de_edad: true,
      aviso_version: LEGAL_VERSION,
      consentimiento_ip: ip,
      anon_id: anonId,
      canal,
    })
    if (!error) await enviarConfirmacion(email, tConfirmar)
    else console.error('[recordatorio] alta falló:', error)
    return NextResponse.json({ ok: true })
  }

  if (existente.estado === 'pendiente') {
    // Reenvío de la confirmación, como mucho cada 10 minutos.
    if (Date.now() - new Date(existente.created_at as string).getTime() > REENVIO_MS) {
      await enviarConfirmacion(email, existente.token_confirmacion as string)
    }
    return NextResponse.json({ ok: true })
  }

  if (existente.estado === 'baja') {
    // Volver a suscribirse es un consentimiento nuevo: tokens, versión e IP nuevos.
    const tConfirmar = token()
    const { error } = await s
      .from('arcade_suscriptores')
      .update({
        estado: 'pendiente',
        token_confirmacion: tConfirmar,
        token_baja: token(),
        aviso_version: LEGAL_VERSION,
        consentimiento_ip: ip,
        anon_id: anonId,
        created_at: new Date().toISOString(),
        confirmado_at: null,
        baja_at: null,
      })
      .eq('id', existente.id)
    if (!error) await enviarConfirmacion(email, tConfirmar)
    return NextResponse.json({ ok: true })
  }

  // Ya confirmado: misma respuesta, sin hacer nada.
  return NextResponse.json({ ok: true })
}
