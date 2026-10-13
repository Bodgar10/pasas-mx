import Link from 'next/link'
import { leerRetoDeHoy, leerRetoDeMateria, leerRetoVom } from '@/lib/arcade-server'
import { copyCTA, getPromoPorDefecto, leyendaPromo, microcopyPromo } from '@/lib/promos'
import { SITIO } from '@/lib/seo'
import type { JuegoArcade, OrigenArcade } from '@/lib/arcade'
import ArcadeClient, { type OfertaPapa, type RetoDeHoy } from './arcade-client'
import s from './arcade.module.css'

/**
 * El juego, compartido por /arcade, /arcade/r/[codigo] (el link con el
 * resultado de alguien) y /arcade/materia/[materia] (a donde reescribe
 * /arcade?materia=historia, ver next.config.ts).
 *
 * Con `materia`, se sirve el reto más reciente de esa materia. Si no es el de
 * hoy, el cliente recibe también cuál es el de hoy para invitar a jugarlo al
 * terminar. Si la materia no existe o no tiene reto reciente, sale el de hoy.
 */
export default async function ContenidoArcade({
  origenRuta = null,
  materia = null,
  juego = 'sobra',
}: { origenRuta?: OrigenArcade | null; materia?: string | null; juego?: JuegoArcade } = {}) {
  const [hoy, deMateria, promo] = await Promise.all([
    leerRetoDeHoy(),
    materia ? leerRetoDeMateria(materia) : null,
    getPromoPorDefecto(),
  ])
  const usarMateria = !!deMateria?.rounds?.length && deMateria.date !== hoy?.date
  const retoSobra = usarMateria ? deMateria : hoy
  // s47 — "Verdadero o mentira" del MISMO día y los mismos temas. Si a algún
  // tema le faltan frases, se juega "¿Cuál sobra?" (el jugador no nota nada).
  const retoVom = juego === 'vom' && retoSobra?.date ? await leerRetoVom(retoSobra.date) : null
  const juegoReal: JuegoArcade = retoVom ? 'vom' : 'sobra'
  const reto = retoVom ?? retoSobra
  const retoDeHoy: RetoDeHoy | null =
    usarMateria && hoy?.rounds?.length ? { number: hoy.number, materia: hoy.materia ?? null } : null

  if (!reto || !reto.rounds || reto.rounds.length === 0) {
    return (
      <main className={s.root}>
        <div className={`${s.wrap} ${s.empty}`}>
          <h2>El reto de hoy se está preparando</h2>
          <p className={s.lead}>Vuelve en unos minutos.</p>
          <Link className={s.link} href="/">
            Ir a PASAS
          </Link>
        </div>
      </main>
    )
  }

  // s41 — Oferta para el papá al terminar el reto. Usa la campaña de la casa
  // (hoy PASAS1) con los MISMOS helpers que la landing: mismo botón, misma
  // micro y el precio de después siempre al lado (REGLA C, PROFECO). Sin
  // campaña vigente, la prueba de 7 días de siempre.
  const PLAN = 'estandar_v2'
  const CICLO = 'mensual'
  const leyenda = leyendaPromo(promo, PLAN, CICLO)
  const cta = copyCTA(promo, PLAN, CICLO, {
    label: 'Prueba 7 días gratis',
    sublabel: '7 días gratis · Sin contrato',
  })
  const ofertaPapa: OfertaPapa = {
    slug: leyenda ? (promo?.slug ?? null) : null,
    badge: leyenda ? (promo?.badge_landing ?? null) : null,
    listaTexto: leyenda?.listaTexto ?? null,
    finalTexto: leyenda?.finalTexto ?? null,
    despuesTexto: leyenda?.despuesTexto ?? null,
    cta: cta.label,
    micro: microcopyPromo(cta.sublabel, ['Cancela cuando quieras']),
  }

  return (
    <ArcadeClient
      reto={reto}
      dominio={SITIO}
      origenRuta={origenRuta}
      retoDeHoy={retoDeHoy}
      ofertaPapa={ofertaPapa}
      juego={juegoReal}
    />
  )
}
