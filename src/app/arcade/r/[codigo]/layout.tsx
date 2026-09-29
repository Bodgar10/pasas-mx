/**
 * 🔴 `generateStaticParams` VACÍO A PROPÓSITO: convierte /arcade/r/[codigo]
 * (página e imagen de vista previa) en ISR bajo demanda. Sin él, Next las
 * trataba como dinámicas y generaba la imagen en cada petición (~1 s, sin
 * caché). WhatsApp arma la vista previa desde el teléfono de quien envía y
 * se rinde rápido: con la imagen lenta, la tarjeta salía sin foto.
 *
 * Así, la primera petición de cada código la genera y las demás salen del
 * CDN. Solo hay 32 combinaciones de cuadros por reto.
 */
export const revalidate = 60

export async function generateStaticParams() {
  return []
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
