import { ImageResponse } from 'next/og'
import { leerRetoDeHoy } from '@/lib/arcade-server'
import { fechaLarga, leerCodigo } from '@/lib/arcade'
import { TarjetaLink, fuentesOG, pngCompleto } from '../../../_og/tarjetas'

/**
 * GET /arcade/r/[codigo]/imagen — vista previa (1200×630) del resultado que
 * alguien compartió: su puntaje y sus cuadros. La declara el og:image de
 * ../page.tsx.
 *
 * 🔴 ES UNA RUTA PROPIA Y NO `opengraph-image.tsx`. Con la convención de
 * Next, la imagen de una ruta con parámetros salía dinámica, sin caché:
 * ~1 s por petición. WhatsApp arma la vista previa desde el teléfono de quien
 * envía y se rinde rápido, así que la tarjeta llegaba sin foto. Aquí el
 * Cache-Control deja la imagen en el CDN después de la primera petición.
 *
 * Las opciones de la ronda 1 solo salen si el código es del reto de hoy; si
 * el link se abre días después, la tarjeta invita a jugar el de hoy.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const leido = leerCodigo(codigo)
  if (!leido) return new Response('Código inválido', { status: 400 })

  const reto = await leerRetoDeHoy()
  const esDeHoy = !!reto && leido.numero === reto.number

  return pngCompleto(
    new ImageResponse(
      (
        <TarjetaLink
          numero={leido.numero}
          fecha={esDeHoy ? fechaLarga(reto.date) : null}
          opciones={esDeHoy ? reto.rounds[0].options : null}
          resultados={leido.resultados}
        />
      ),
      { width: 1200, height: 630, fonts: await fuentesOG() }
    )
  )
}
