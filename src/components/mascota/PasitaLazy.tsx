'use client'

import { useEffect, useRef, useState } from 'react'
import Pasita from './Pasita'
import { VIEWBOX, type PoseId } from '@/lib/mascota'

/**
 * La Pasita, pero sin descargar sus piezas hasta que hace falta.
 *
 * Cada pose son entre 8 y 12 archivos SVG. En la landing va a aparecer en
 * varias secciones, y descargarlos todos al cargar la página competiría con
 * lo que el visitante sí está mirando. Aquí solo se piden cuando la sección
 * se acerca a la pantalla.
 *
 * 🔴 NO usar en el hero ni en nada visible al entrar: ahí la Pasita debe
 * estar desde el primer fotograma y este componente la retrasaría. Para eso
 * está <Pasita> directamente.
 *
 * El hueco se reserva desde el principio con las mismas medidas que tendrá el
 * personaje. Sin eso, aparecer empujaría el contenido de abajo y el visitante
 * perdería el punto donde iba leyendo.
 *
 * Las piezas se comparten entre poses —el cuerpo y los pies salen en casi
 * todas—, así que la segunda aparición y las siguientes salen de la caché del
 * navegador y son gratis.
 */

interface Props {
  pose: PoseId
  size: number
  /**
   * Cuánto antes de ser visible empieza a cargar. 300px ≈ un scroll rápido de
   * distancia: llega armada, no apareciendo.
   */
  margen?: string
  className?: string
  animacion?: 'ninguna' | 'flotar' | 'saltar' | 'temblar'
}

export default function PasitaLazy({
  pose,
  size,
  margen = '300px',
  className,
  animacion = 'ninguna',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [cargar, setCargar] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Sin IntersectionObserver —navegadores viejos— se carga y ya. Peor para
    // el rendimiento, pero se ve, que es lo que importa.
    if (typeof IntersectionObserver === 'undefined') {
      setCargar(true)
      return
    }

    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setCargar(true)
          obs.disconnect()   // una vez cargada no hay vuelta atrás
        }
      },
      { rootMargin: margen }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [margen])

  const alto = Math.round((size * VIEWBOX.h) / VIEWBOX.w)

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: size,
        height: alto,
        flexShrink: 0,
        display: 'inline-block',
      }}
    >
      {cargar && <Pasita pose={pose} size={size} animacion={animacion} />}
    </div>
  )
}
