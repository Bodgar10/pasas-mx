import { ImageResponse } from 'next/og'
import { leerRetoDeHoy } from '@/lib/arcade-server'
import { fechaLarga, leerCodigo } from '@/lib/arcade'
import { TarjetaLink, fuentesOG } from '../../_og/tarjetas'

/**
 * Vista previa del resultado que alguien compartió: su puntaje y sus cuadros.
 * Las opciones de la ronda 1 solo salen si el código es del reto de hoy; si
 * el link se abre días después, la tarjeta queda solo con el resultado.
 */
export const revalidate = 60
export const alt = 'Resultado del reto diario de historia de PASAS'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const leido = leerCodigo(codigo)
  const reto = await leerRetoDeHoy()
  const esDeHoy = !!reto && !!leido && leido.numero === reto.number

  return new ImageResponse(
    (
      <TarjetaLink
        numero={leido?.numero ?? reto?.number ?? 1}
        fecha={esDeHoy ? fechaLarga(reto.date) : null}
        opciones={esDeHoy ? reto.rounds[0].options : null}
        resultados={leido?.resultados ?? null}
      />
    ),
    { ...size, fonts: await fuentesOG() }
  )
}
