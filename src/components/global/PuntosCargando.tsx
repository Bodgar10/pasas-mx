import s from './PuntosCargando.module.css'

/** Puntos suspensivos animados ("Generando…"). Sin estado ni intervalo. */
export default function PuntosCargando() {
  return (
    <span>
      .<span className={s.p2}>.</span>
      <span className={s.p3}>.</span>
    </span>
  )
}
