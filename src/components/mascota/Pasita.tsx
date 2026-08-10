'use client'

import { useEffect, useState } from 'react'
import { ANCLAS, LIENZO, MARGEN, PARPADEO, POSES, VIEWBOX, type PoseId } from '@/lib/mascota'

/**
 * La Pasita. FUENTE ÚNICA del renderizado del personaje.
 *
 * 🔴 Nadie más apila piezas. Si una pantalla necesita a la Pasita, usa este
 * componente; si necesita una pose que no existe, se agrega a POSES en
 * mascota.ts, no se compone a mano en el JSX de esa pantalla.
 *
 * Cómo funciona: cada pieza es un <img> posicionado en absoluto dentro de un
 * lienzo con coordenadas del SVG del cuerpo (114x181). El navegador escala
 * todo junto, así que se ve nítido a 48 px y a 400 px con los mismos archivos.
 *
 * Por qué <img> y no SVG incrustado: son hasta 12 piezas por pose y el
 * navegador las cachea entre poses —el cuerpo y los pies se repiten en casi
 * todas—. Incrustarlas metería miles de nodos en el DOM sin ganar nada,
 * porque estas piezas no necesitan heredar currentColor como el logo.
 */

type Animacion = 'ninguna' | 'flotar' | 'saltar' | 'temblar'

interface Props {
  pose?: PoseId
  /** Ancho en píxeles. La altura sale de la proporción del lienzo. */
  size?: number
  /** Animación del momento. Las del personaje (parpadeo) son automáticas. */
  animacion?: Animacion
  /**
   * El parpadeo se apaga solo en tamaños chicos: a 48 px los ojos son cuatro
   * píxeles y el cambio se ve como un parpadeo de la pantalla, no del
   * personaje. También se apaga si el sistema pide movimiento reducido.
   */
  parpadea?: boolean
  className?: string
  /**
   * Texto para lectores de pantalla. Por defecto vacío: la Pasita es
   * decorativa en casi todos los sitios y anunciarla estorba. Solo se pone
   * cuando el personaje ES la información (una pantalla de error, por ejemplo).
   */
  alt?: string
}

const BASE = '/mascota/'

export default function Pasita({
  pose = 'compacta',
  size = 120,
  animacion = 'ninguna',
  parpadea,
  className,
  alt = '',
}: Props) {
  const receta = POSES[pose]
  const [ojosCerrados, setOjosCerrados] = useState(false)

  // Por defecto parpadea solo si es lo bastante grande para que se note.
  const debeParpadear = parpadea ?? size >= 80

  useEffect(() => {
    if (!debeParpadear) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let vivo = true
    let t: ReturnType<typeof setTimeout>

    // Intervalo irregular a propósito: un parpadeo cada N segundos exactos se
    // lee como un reloj, no como algo vivo.
    const programar = () => {
      t = setTimeout(() => {
        if (!vivo) return
        setOjosCerrados(true)
        t = setTimeout(() => {
          if (!vivo) return
          setOjosCerrados(false)
          programar()
        }, 130)
      }, 2500 + Math.random() * 3500)
    }
    programar()

    return () => { vivo = false; clearTimeout(t) }
  }, [debeParpadear, pose])

  const alto = Math.round((size * VIEWBOX.h) / VIEWBOX.w)

  /** Coloca una pieza en coordenadas del lienzo del cuerpo. */
  const pieza = (src: string, x: number, y: number, key: string) => (
    <img
      key={key}
      src={BASE + src}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: 'absolute',
        // El origen del rig es la esquina del cuerpo, pero el lienzo empieza
        // en -MARGEN para que quepan los brazos que sobresalen.
        left: `${((x + MARGEN.x) / VIEWBOX.w) * 100}%`,
        top: `${((y + MARGEN.y) / VIEWBOX.h) * 100}%`,
        width: 'auto',
        height: 'auto',
        // Las piezas conservan su tamaño natural en unidades del rig; el
        // factor de escala lo aplica el contenedor.
        transform: `scale(${size / VIEWBOX.w})`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )

  // Sustitución de ojos durante el parpadeo. Solo afecta a las piezas de ojo:
  // las cejas y la boca se quedan como están, que es lo que hace una cara real.
  const ancladas = receta.ancladas.map((src) => {
    if (!ojosCerrados) return src
    if (src.startsWith('Ojos/ojo-der')) return PARPADEO.der
    if (src.startsWith('Ojos/ojo-izq')) return PARPADEO.izq
    return src
  })

  return (
    <div
      className={className}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-animacion={animacion}
      style={{
        position: 'relative',
        width: size,
        height: alto,
        flexShrink: 0,
        display: 'inline-block',
      }}
    >
      {/* Orden de pintado: aura → sombra → brazos traseros → cuerpo → cara.
          Las piezas 'propias' van ANTES del cuerpo para que los brazos queden
          detrás; los que deben verse delante ya vienen dibujados con su propio
          contorno y funcionan igual. */}
      {receta.aura && pieza(receta.aura, -44, -37, 'aura')}
      {receta.propias
        .filter((p) => !p.delante)
        .map((p) => pieza(p.src, p.x, p.y, p.src))}
      {pieza(receta.cuerpo, 0, 0, 'cuerpo')}
      {receta.propias
        .filter((p) => p.delante)
        .map((p) => pieza(p.src, p.x, p.y, p.src))}
      {ancladas.map((src, i) => {
        const a = ANCLAS[src]
        if (!a) return null
        const dx = receta.ajusteCara?.x ?? 0
        const dy = receta.ajusteCara?.y ?? 0
        const esCara = !src.startsWith('pies/') && !src.startsWith('Sombra/')
        return pieza(src, a.x + (esCara ? dx : 0), a.y + (esCara ? dy : 0), `${src}-${i}`)
      })}

      <style>{`
        [data-animacion='flotar']  { animation: pasita-flotar 3s ease-in-out infinite; }
        [data-animacion='saltar']  { animation: pasita-saltar 0.6s ease-out; }
        [data-animacion='temblar'] { animation: pasita-temblar 0.4s ease-in-out; }

        @keyframes pasita-flotar {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes pasita-saltar {
          0%   { transform: translateY(0) scale(1, 1); }
          30%  { transform: translateY(-18px) scale(0.95, 1.05); }
          60%  { transform: translateY(0) scale(1.05, 0.95); }
          100% { transform: translateY(0) scale(1, 1); }
        }
        @keyframes pasita-temblar {
          0%, 100%      { transform: translateX(0); }
          20%, 60%      { transform: translateX(-4px); }
          40%, 80%      { transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-animacion] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
