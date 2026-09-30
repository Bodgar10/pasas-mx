import { NextResponse } from 'next/server'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { db } from '@/lib/arcade/recordatorio'

export const dynamic = 'force-dynamic'

/** GET /api/arcade/recordatorio/confirmar?t= — segundo paso del doble opt-in. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const destino = (estado: string) => NextResponse.redirect(new URL(`/arcade?recordatorio=${estado}`, url), 303)
  if (!FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO) return destino('invalido')

  const t = url.searchParams.get('t')
  if (!t || t.length > 100) return destino('invalido')

  const s = db()
  const { data } = await s.from('arcade_suscriptores').select('id, estado').eq('token_confirmacion', t).maybeSingle()
  if (!data || data.estado === 'baja') return destino('invalido')
  if (data.estado === 'pendiente') {
    await s
      .from('arcade_suscriptores')
      .update({ estado: 'confirmado', confirmado_at: new Date().toISOString() })
      .eq('id', data.id)
  }
  return destino('confirmado')
}
