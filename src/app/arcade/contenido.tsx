import Link from 'next/link'
import { leerRetoDeHoy, leerRetoDeMateria } from '@/lib/arcade-server'
import { SITIO } from '@/lib/seo'
import type { OrigenArcade } from '@/lib/arcade'
import ArcadeClient, { type RetoDeHoy } from './arcade-client'
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
}: { origenRuta?: OrigenArcade | null; materia?: string | null } = {}) {
  const [hoy, deMateria] = await Promise.all([leerRetoDeHoy(), materia ? leerRetoDeMateria(materia) : null])
  const usarMateria = !!deMateria?.rounds?.length && deMateria.date !== hoy?.date
  const reto = usarMateria ? deMateria : hoy
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

  return <ArcadeClient reto={reto} dominio={SITIO} origenRuta={origenRuta} retoDeHoy={retoDeHoy} />
}
