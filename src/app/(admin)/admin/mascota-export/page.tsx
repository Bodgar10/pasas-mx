// Pagina temporal de exportacion. NO forma parte del producto: existe
// para generar los PNG de las fotos de perfil de redes. Se puede
// borrar cuando esten generados. Vive bajo (admin) para que el
// middleware la proteja.

'use client'

import { useRef, useState } from 'react'
import Pasita from '@/components/mascota/Pasita'
import { POSES, VIEWBOX, type PoseId } from '@/lib/mascota'

const LADO = 1024

/**
 * Alto que ocupa la Pasita dentro del cuadro, como fraccion del lado.
 *
 * 🔴 68% y no mas: Instagram y TikTok recortan el avatar en circulo. Si
 * la Pasita toca los bordes, el circulo le corta la cabeza y los pies.
 */
const OCUPACION = 0.68

/** Lado del cuadro en pantalla. El export escala de aqui a 1024. */
const PREVIEW = 300

type FondoTipo = 'solido' | 'oscuro' | 'degradado'

const VARIANTES: { id: FondoTipo; nombre: string; css: string }[] = [
  { id: 'solido', nombre: 'Sólido', css: '#7C3AED' },
  { id: 'oscuro', nombre: 'Oscuro', css: '#0f0a1e' },
  { id: 'degradado', nombre: 'Degradado', css: 'linear-gradient(135deg, #7c3aed, #ec4899)' },
]

/** Pinta el fondo de la variante sobre el canvas ya dimensionado. */
function pintarFondo(ctx: CanvasRenderingContext2D, tipo: FondoTipo) {
  if (tipo === 'degradado') {
    // 135deg en CSS va de la esquina superior izquierda a la inferior
    // derecha, que es exactamente esta diagonal.
    const g = ctx.createLinearGradient(0, 0, LADO, LADO)
    g.addColorStop(0, '#7c3aed')
    g.addColorStop(1, '#ec4899')
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = tipo === 'solido' ? '#7C3AED' : '#0f0a1e'
  }
  ctx.fillRect(0, 0, LADO, LADO)
}

/** Carga una imagen y resuelve cuando esta lista para dibujarse. */
function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Mismo origen (/mascota/...), pero se declara igual: si algun dia
    // las piezas se sirven desde un CDN, sin esto el canvas queda
    // contaminado y toBlob lanza SecurityError.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    img.src = src
  })
}

export default function MascotaExportPage() {
  const [pose, setPose] = useState<PoseId>('compacta')
  const [ocupado, setOcupado] = useState<FondoTipo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  // Pasita recibe el ANCHO; su alto sale de la proporcion del lienzo.
  // Se despeja al reves para que el ALTO sea el 68% del cuadro.
  const anchoPasita = (alto: number) => (alto * OCUPACION * VIEWBOX.w) / VIEWBOX.h

  const poses = Object.keys(POSES) as PoseId[]

  async function descargar(tipo: FondoTipo) {
    const contenedor = refs.current[tipo]
    if (!contenedor || ocupado) return

    setOcupado(tipo)
    setError(null)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = LADO
      canvas.height = LADO
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo crear el contexto 2D')

      pintarFondo(ctx, tipo)

      // Posiciones REALES que calculo el navegador, escaladas a 1024.
      // Se leen del DOM en vez de recalcular el rig: asi el PNG es
      // exactamente lo que se ve en pantalla, piezas y orden incluidos.
      const caja = contenedor.getBoundingClientRect()
      const escala = LADO / caja.width

      const nodos = Array.from(contenedor.querySelectorAll('img'))
      const piezas = await Promise.all(
        nodos.map(async (nodo) => {
          const r = nodo.getBoundingClientRect()
          return {
            img: await cargarImagen(nodo.src),
            x: (r.left - caja.left) * escala,
            y: (r.top - caja.top) * escala,
            w: r.width * escala,
            h: r.height * escala,
          }
        })
      )

      // El orden del DOM ES el orden de pintado: las piezas van en
      // posicion absoluta sin z-index, asi que apilan por orden.
      for (const p of piezas) {
        ctx.drawImage(p.img, p.x, p.y, p.w, p.h)
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) throw new Error('toBlob devolvió null')

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pasita-${pose}-${tipo}-1024.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al exportar')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '40px 24px 80px',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 22,
            fontWeight: 900,
            margin: '0 0 6px',
          }}
        >
          Exportar Pasita a PNG
        </h1>
        <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 28px' }}>
          1024×1024 para fotos de perfil. La mascota ocupa el 68% del alto para
          que el recorte circular de Instagram y TikTok no le corte la cabeza ni
          los pies.
        </p>

        {/* Selector de pose */}
        <div style={{ marginBottom: 28 }}>
          <label
            style={{
              fontSize: 12,
              color: '#a78bfa',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              display: 'block',
              marginBottom: 8,
            }}
          >
            Pose
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {poses.map((p) => {
              const activa = p === pose
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPose(p)}
                  style={{
                    background: activa ? '#7c3aed' : '#1a1035',
                    border: activa ? 'none' : '1.5px solid #2D2048',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: activa ? '#fff' : '#a78bfa',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)',
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 14,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
            }}
          >
            {error}
          </p>
        )}

        {/* Las tres variantes */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {VARIANTES.map((v) => (
            <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{v.nombre}</p>

              {/* Cuadro que se exporta */}
              <div
                ref={(el) => { refs.current[v.id] = el }}
                style={{
                  width: PREVIEW,
                  height: PREVIEW,
                  background: v.css,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderRadius: 8,
                }}
              >
                <Pasita
                  pose={pose}
                  size={anchoPasita(PREVIEW)}
                  parpadea={false}
                  animacion="ninguna"
                />
              </div>

              {/* Como se veria en el feed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: v.css,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <Pasita
                    pose={pose}
                    size={anchoPasita(56)}
                    parpadea={false}
                    animacion="ninguna"
                  />
                </div>
                <span style={{ fontSize: 12, color: '#a78bfa' }}>
                  Recorte circular
                </span>
              </div>

              <button
                type="button"
                onClick={() => descargar(v.id)}
                disabled={ocupado !== null}
                style={{
                  width: PREVIEW,
                  minHeight: 44,
                  background: ocupado !== null ? '#2D2048' : '#7c3aed',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  color: ocupado !== null ? '#4B3D6E' : '#fff',
                  cursor: ocupado !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-nunito)',
                }}
              >
                {ocupado === v.id ? 'Generando…' : 'Descargar PNG'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
