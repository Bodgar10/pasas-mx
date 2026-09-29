import { notFound } from 'next/navigation'
import Link from 'next/link'
import Franja from '../_componentes/Franja'
import { SECCIONES, type SlugSeccion } from '../_componentes/secciones'
import { POSTHOG_DASHBOARDS } from '@/lib/analytics/posthog-links'
import { COLORES } from '@/components/admin/Tarjetas'
import Dinero from '../_secciones/Dinero'
import Suscripciones from '../_secciones/Suscripciones'
import Adquisicion from '../_secciones/Adquisicion'
import Aprendizaje from '../_secciones/Aprendizaje'
import Contenido from '../_secciones/Contenido'
import Salud from '../_secciones/Salud'
import Juegos from '../_secciones/Juegos'

/**
 * Una ruta por pestaña, no estado de cliente.
 *
 * Así cada pestaña carga SOLO sus queries —Dinero toca una tabla, Salud
 * ninguna de las siete de antes— y cada una se puede enlazar directo,
 * incluido el estado del toggle.
 */

/**
 * Qué dashboard de PostHog abre el botón de cada pestaña.
 *
 * Juegos va con URL propia: posthog-links.ts lo GENERA scripts/seed-posthog.ts
 * y no se edita a mano. El dashboard del Arcade se creó aparte (2150420).
 */
const DASHBOARD: Record<SlugSeccion, string> = {
  dinero: POSTHOG_DASHBOARDS.pago,
  suscripciones: POSTHOG_DASHBOARDS.retencion,
  adquisicion: POSTHOG_DASHBOARDS.adquisicion,
  aprendizaje: POSTHOG_DASHBOARDS.uso,
  contenido: POSTHOG_DASHBOARDS.contenido,
  juegos: 'https://us.posthog.com/project/419205/dashboard/2150420',
  salud: POSTHOG_DASHBOARDS.errores,
}

const VALIDAS = new Set(SECCIONES.map((s) => s.slug))

export default async function SeccionPage(props: {
  // `params` y `searchParams` son Promise desde Next 16.
  params: Promise<{ seccion: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { seccion } = await props.params
  const sp = await props.searchParams
  if (!VALIDAS.has(seccion as SlugSeccion)) notFound()

  const slug = seccion as SlugSeccion
  const incluirPrueba = sp.prueba === '1'
  const meta = SECCIONES.find((s) => s.slug === slug)!

  return (
    <>
      <Franja incluirPrueba={incluirPrueba} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: COLORES.texto }}>
          {meta.emoji} {meta.label}
        </div>
        <Link
          href={DASHBOARD[slug]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: COLORES.fondo, border: `1px solid ${COLORES.borde}`, color: COLORES.suave, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}
        >
          Ver en PostHog ↗
        </Link>
      </div>

      {slug === 'dinero' && <Dinero incluirPrueba={incluirPrueba} />}
      {slug === 'suscripciones' && <Suscripciones incluirPrueba={incluirPrueba} />}
      {slug === 'adquisicion' && <Adquisicion incluirPrueba={incluirPrueba} />}
      {slug === 'aprendizaje' && <Aprendizaje incluirPrueba={incluirPrueba} />}
      {slug === 'contenido' && <Contenido incluirPrueba={incluirPrueba} />}
      {slug === 'juegos' && <Juegos />}
      {slug === 'salud' && <Salud />}
    </>
  )
}
