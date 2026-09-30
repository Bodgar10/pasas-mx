import { Resend } from 'resend'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { FROM_EMAIL } from '@/lib/email/resend'
import { iniciarCorrida, cerrarCorrida } from '@/lib/cron-runs'
import { correoDiario, db } from '@/lib/arcade/recordatorio'

export const dynamic = 'force-dynamic'

const LOTE = 100
/** Hobby corta a los 10 s: se deja de mandar lotes antes. Lo que falte sale mañana. */
const PRESUPUESTO_MS = 8000

/**
 * GET /api/cron/arcade-recordatorio — 13:30 UTC (7:30 a.m. de México). s34-F5.
 *
 * Manda "¿Cuál sobra? #n ya está listo" a los suscriptores confirmados que no
 * lo recibieron hoy. `ultimo_envio_fecha` se marca POR LOTE enviado con
 * éxito: si la función se corta a la mitad, el reintento no duplica a los
 * que ya lo recibieron.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const s = db()
  const corridaId = await iniciarCorrida(s, 'arcade-recordatorio')

  if (!FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO) {
    await cerrarCorrida(s, corridaId, { rowsProcessed: 0 })
    return Response.json({ ok: true, enviados: 0, motivo: 'flag apagado' })
  }

  const inicio = Date.now()
  let enviados = 0
  try {
    const { data: hoy } = await s.rpc('arcade_hoy')
    const fecha = hoy as string
    const { data: reto } = await s.from('arcade_challenges').select('number').eq('challenge_date', fecha).maybeSingle()
    const numero = (reto?.number as number | undefined) ?? Math.round((Date.parse(fecha) - Date.parse('2026-09-28')) / 86_400_000)

    const { data: pendientes, error } = await s
      .from('arcade_suscriptores')
      .select('id, email, token_baja')
      .eq('estado', 'confirmado')
      .or(`ultimo_envio_fecha.is.null,ultimo_envio_fecha.neq.${fecha}`)
      .limit(2000)
    if (error) throw new Error(error.message)

    const resend = new Resend(process.env.RESEND_API_KEY)
    const filas = pendientes ?? []
    for (let i = 0; i < filas.length; i += LOTE) {
      if (Date.now() - inicio > PRESUPUESTO_MS) break
      const lote = filas.slice(i, i + LOTE)
      const { error: errLote } = await resend.batch.send(
        lote.map((f) => ({ from: FROM_EMAIL, to: f.email as string, ...correoDiario(numero, f.token_baja as string) }))
      )
      if (errLote) {
        console.error('[arcade-recordatorio] lote falló:', errLote)
        continue
      }
      await s
        .from('arcade_suscriptores')
        .update({ ultimo_envio_fecha: fecha })
        .in(
          'id',
          lote.map((f) => f.id as string)
        )
      enviados += lote.length
    }

    await cerrarCorrida(s, corridaId, { rowsProcessed: enviados })
    return Response.json({ ok: true, enviados, pendientes: filas.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await cerrarCorrida(s, corridaId, { rowsProcessed: enviados, error: msg })
    return Response.json({ error: msg }, { status: 500 })
  }
}
