import Link from 'next/link'
import { leerRetoDeHoy } from '@/lib/arcade-server'
import { SITIO } from '@/lib/seo'
import type { OrigenArcade } from '@/lib/arcade'
import ArcadeClient from './arcade-client'
import s from './arcade.module.css'

/**
 * El juego, compartido por /arcade y por /arcade/r/[codigo] (el link con el
 * resultado de alguien). Las dos rutas sirven el reto de hoy; solo cambia la
 * vista previa del link.
 */
export default async function ContenidoArcade({ origenRuta = null }: { origenRuta?: OrigenArcade | null } = {}) {
  const reto = await leerRetoDeHoy()

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

  return <ArcadeClient reto={reto} dominio={SITIO} origenRuta={origenRuta} />
}
