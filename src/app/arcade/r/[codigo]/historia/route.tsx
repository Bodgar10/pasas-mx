import { ImageResponse } from 'next/og'
import { leerRetoDeHoy } from '@/lib/arcade-server'
import { leerCodigo, rondaDelPuente } from '@/lib/arcade'
import { SITIO } from '@/lib/seo'
import { TarjetaHistoria, fuentesOG, pngCompleto } from '../../../_og/tarjetas'

/**
 * GET /arcade/r/[codigo]/historia — PNG 1080×1920 para historias de
 * Instagram y estados de WhatsApp. Lo pide el botón "Compartir imagen" del
 * cliente y lo pasa al menú nativo del teléfono.
 *
 * El tema fallado sale del reto de hoy; si el código es de otro día, la
 * tarjeta queda sin tema.
 */
export const revalidate = 60

export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const leido = leerCodigo(codigo)
  if (!leido) return new Response('Código inválido', { status: 400 })

  const reto = await leerRetoDeHoy()
  const esDeHoy = !!reto && reto.number === leido.numero
  const perfecto = !leido.resultados.includes(false)
  const temaFallado = esDeHoy && !perfecto ? rondaDelPuente(reto, leido.resultados).topic : null

  return pngCompleto(
    new ImageResponse(
      (
        <TarjetaHistoria
          numero={leido.numero}
          materia={esDeHoy ? reto.materia : null}
          resultados={leido.resultados}
          temaFallado={temaFallado}
          dominio={SITIO.replace(/^https?:\/\//, '')}
        />
      ),
      { width: 1080, height: 1920, fonts: await fuentesOG() }
    )
  )
}
