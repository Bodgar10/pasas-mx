import { ImageResponse } from 'next/og'
import { leerRetoDeHoy } from '@/lib/arcade-server'
import { fechaLarga } from '@/lib/arcade'
import { TarjetaLink, fuentesOG } from './_og/tarjetas'

/**
 * Vista previa de pasas.mx/arcade: el reto del día con las opciones de la
 * ronda 1. Es también la que aparece cuando el link sale en los reels.
 * Se regenera cada minuto, igual que la página.
 */
export const revalidate = 60
export const alt = '¿Cuál sobra? Reto diario de PASAS'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const reto = await leerRetoDeHoy()
  return new ImageResponse(
    (
      <TarjetaLink
        numero={reto?.number ?? 1}
        materia={reto?.materia ?? null}
        fecha={reto ? fechaLarga(reto.date) : null}
        opciones={reto?.rounds[0]?.options ?? null}
        resultados={null}
      />
    ),
    { ...size, fonts: await fuentesOG() }
  )
}
