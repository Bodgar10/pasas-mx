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

/**
 * Ancho natural de cada pieza, en las mismas unidades que el cuerpo (114x181).
 * Sale del viewBox de cada SVG.
 *
 * Existe porque el navegador no conoce el tamaño de un SVG hasta cargarlo, y
 * esperar a la carga para posicionar produciría un salto visible. Con el ancho
 * declarado, la pasita aparece armada desde el primer fotograma.
 *
 * ⚠️ Si Samuel entrega una pieza nueva, hay que añadirla aquí. Sin su ancho la
 * pieza se dibuja a tamaño intrínseco y queda descuadrada. Para obtener los
 * valores: grep -o 'viewBox="[^"]*"' en la carpeta public/mascota.
 */
const ANCHOS: Record<string, number> = {
  'Cuerpo/cuerpo-01.svg': 114, 'Cuerpo/cuerpo-02.svg': 114,

  'Ojos/ojo-der01.svg': 31, 'Ojos/ojo-izq01.svg': 31,
  'Ojos/ojo-der02.svg': 28, 'Ojos/ojo-izq02.svg': 28,
  'Ojos/ojo-der03.svg': 26, 'Ojos/ojo-izq03.svg': 27,
  'Ojos/ojo-der04.svg': 31, 'Ojos/ojo-izq04.svg': 31,

  'Cejas/ceja-der01.svg': 26, 'Cejas/ceja-izq01.svg': 26,
  'Cejas/ceja-der02.svg': 26, 'Cejas/ceja-izq02.svg': 26,
  'Cejas/ceja-der03.svg': 24, 'Cejas/ceja-izq03.svg': 24,

  'Boca/boca-01.svg': 30, 'Boca/boca-02.svg': 30,
  'Boca/boca-03.svg': 28, 'Boca/boca-04.svg': 32,

  'Brazos/brazo-der01.svg': 38, 'Brazos/brazo-izq01.svg': 37,
  'Brazos/brazo-der02.svg': 55, 'Brazos/brazo-izq02.svg': 55,
  'Brazos/brazo-der03.svg': 65, 'Brazos/brazo-izq03.svg': 64,
  'Brazos/brazo-der04.svg': 52, 'Brazos/brazo-izq04.svg': 52,
  'Brazos/brazo-izq05.svg': 43, 'Brazos/brazo-der06.svg': 47,
  'Brazos/brazo-izq06.svg': 58, 'Brazos/brazo-izq07.svg': 52,

  'pies/pie-der01.svg': 50, 'pies/pie-izq01.svg': 50,
  'Sombra/sombra-01.svg': 100, 'Sombra/sombra-02.svg': 108,

  'Aura/Aura-morado.svg': 202, 'Aura/Aura-fuego.svg': 202,

  // Flamas sueltas. No se usan todavía: el aura ya viene como pieza única.
  // Están aquí para cuando se quiera animarlas por separado en la racha.
  'Aura/flama-1.svg': 9,  'Aura/flama-2.svg': 11, 'Aura/flama-3.svg': 8,
  'Aura/flama-4.svg': 8,  'Aura/flama-5.svg': 7,  'Aura/flama-6.svg': 11,
  'Aura/flama-7.svg': 10,
  'Aura/flama-morada-1.svg': 9,  'Aura/flama-morada-2.svg': 11,
  'Aura/flama-morada-3.svg': 8,  'Aura/flama-morada-4.svg': 8,
  'Aura/flama-morada-5.svg': 7,  'Aura/flama-morada-6.svg': 11,
  'Aura/flama-morada-7.svg': 10,
}

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

  /**
   * Coloca una pieza en coordenadas del lienzo del cuerpo.
   *
   * 🔴 TODO en porcentaje del contenedor: posición Y tamaño. No usar
   * transform: scale() — se aplica después de posicionar y sobre el tamaño
   * intrínseco del archivo, así que posición y tamaño dejan de ir
   * sincronizados: a 250 px se ve bien y a 80 px las piezas se separan.
   *
   * Al dar el ancho en %, el navegador escala el SVG solo y respeta su
   * proporción. Por eso la altura va en 'auto'.
   */
  const pieza = (src: string, x: number, y: number, key: string) => {
    const ancho = ANCHOS[src]
    return (
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
          // 🔴 Los DOS ejes en % del ANCHO. Nunca % de la altura: si algo de
          // fuera estira el contenedor (un minHeight, un flex que crece), los
          // porcentajes verticales se estiran también y las piezas se
          // desparraman. El ancho es lo único que este componente controla.
          left: `${((x + MARGEN.x) / VIEWBOX.w) * 100}%`,
          top: `${((y + MARGEN.y) / VIEWBOX.w) * 100}%`,
          width: ancho ? `${(ancho / VIEWBOX.w) * 100}%` : undefined,
          height: 'auto',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    )
  }

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
        // Medidas fijas y no negociables: las piezas se posicionan respecto a
        // esta caja, así que si un flex o un grid de fuera la estiran, el
        // personaje se desarma. minWidth/minHeight impiden que la encoja.
        width: size,
        height: alto,
        minWidth: size,
        minHeight: alto,
        flexShrink: 0,
        flexGrow: 0,
        alignSelf: 'center',
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
