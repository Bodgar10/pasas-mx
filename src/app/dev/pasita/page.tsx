'use client'

import { useState } from 'react'
import Pasita from '@/components/mascota/Pasita'
import { POSES, type PoseId } from '@/lib/mascota'

/**
 * Taller de la Pasita. Solo desarrollo.
 *
 * Existe porque parte de las coordenadas del rig se dedujeron por simetría en
 * vez de medirse, así que hay piezas descuadradas. Corregirlas metiendo la
 * mascota en el dashboard y recargando sería lentísimo; aquí se ven las ocho
 * poses a la vez y el error salta solo.
 *
 * 🔴 No enlazar esta ruta desde ningún sitio. Se entra escribiendo /dev/pasita.
 */

const POSE_IDS = Object.keys(POSES) as PoseId[]
const ANIMACIONES = ['ninguna', 'flotar', 'saltar', 'temblar'] as const
const FONDOS = [
  { nombre: 'App', color: '#0a0a0f' },
  { nombre: 'Tarjeta', color: '#1a1035' },
  { nombre: 'Claro', color: '#e5e5e5' },
]

export default function TallerPasita() {
  // ⚠️ Esta ruta está ABIERTA en producción a propósito: el ajuste del rig se
  // hace en pasas.mx, no en local. No está enlazada desde ningún sitio, así
  // que solo llega quien escribe la URL.
  //
  // 🔴 Pendiente de lanzamiento: volver a cerrarla. Va en la lista de
  // bloqueadores junto a quitar el resto de rutas de desarrollo.
  const [size, setSize] = useState(160)
  const [anim, setAnim] = useState<(typeof ANIMACIONES)[number]>('ninguna')
  const [fondo, setFondo] = useState(FONDOS[0].color)
  const [rejilla, setRejilla] = useState(true)
  const [clave, setClave] = useState(0)   // para relanzar animaciones de un tiro

  const marco: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: size * 1.6,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #2D2048',
    background: fondo,
    // La rejilla revela desplazamientos que a ojo pasan desapercibidos.
    backgroundImage: rejilla
      ? 'linear-gradient(rgba(124,58,237,.18) 1px, transparent 1px),' +
        'linear-gradient(90deg, rgba(124,58,237,.18) 1px, transparent 1px)'
      : undefined,
    backgroundSize: '20px 20px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0a1e', color: '#e2d9f3',
                  padding: 24, fontFamily: 'var(--font-nunito)' }}>
      <h1 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 22,
                   fontWeight: 900, marginBottom: 4 }}>
        Taller de la Pasita
      </h1>
      <p style={{ color: '#a78bfa', fontSize: 14, marginBottom: 20 }}>
        Ocho poses. Lo que se vea torcido se corrige en <code>src/lib/mascota.ts</code>.
      </p>

      {/* Controles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
                    background: '#1a1035', border: '1px solid #2D2048',
                    borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          Tamaño
          <input type="range" min={32} max={320} value={size}
                 onChange={(e) => setSize(Number(e.target.value))} />
          <span style={{ width: 48, color: '#a78bfa' }}>{size}px</span>
        </label>

        <div style={{ display: 'flex', gap: 6 }}>
          {[48, 80, 160, 280].map((s) => (
            <button key={s} type="button" onClick={() => setSize(s)}
              style={{ background: size === s ? '#7c3aed' : '#0f0a1e',
                       border: '1px solid #2D2048', borderRadius: 8,
                       color: '#e2d9f3', padding: '4px 10px', fontSize: 13,
                       cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {ANIMACIONES.map((a) => (
            <button key={a} type="button"
              onClick={() => { setAnim(a); setClave((k) => k + 1) }}
              style={{ background: anim === a ? '#7c3aed' : '#0f0a1e',
                       border: '1px solid #2D2048', borderRadius: 8,
                       color: '#e2d9f3', padding: '4px 10px', fontSize: 13,
                       cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {FONDOS.map((f) => (
            <button key={f.nombre} type="button" onClick={() => setFondo(f.color)}
              style={{ background: fondo === f.color ? '#7c3aed' : '#0f0a1e',
                       border: '1px solid #2D2048', borderRadius: 8,
                       color: '#e2d9f3', padding: '4px 10px', fontSize: 13,
                       cursor: 'pointer' }}>
              {f.nombre}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={rejilla}
                 onChange={(e) => setRejilla(e.target.checked)} />
          Rejilla
        </label>
      </div>

      {/* Las ocho poses */}
      <div style={{ display: 'grid', gap: 16,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {POSE_IDS.map((id) => (
          <div key={id}>
            <div style={marco}>
              <Pasita key={`${id}-${clave}`} pose={id} size={size} animacion={anim} />
            </div>
            <p style={{ fontSize: 13, color: '#a78bfa', marginTop: 6,
                        textAlign: 'center', fontWeight: 700 }}>
              {id}
            </p>
            <p style={{ fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
              {POSES[id].cuerpo.split('/')[1]} ·{' '}
              {POSES[id].propias.length} brazos ·{' '}
              {POSES[id].ancladas.length} anclas
            </p>
          </div>
        ))}
      </div>

      {/* Prueba de tamaño real */}
      <h2 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900,
                   margin: '32px 0 12px' }}>
        A tamaño real
      </h2>
      <p style={{ color: '#a78bfa', fontSize: 13, marginBottom: 12 }}>
        Los tamaños a los que va a aparecer de verdad. Si a 48 px no se lee la
        silueta, esa pose no sirve para el dashboard.
      </p>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end',
                    background: '#0a0a0f', border: '1px solid #2D2048',
                    borderRadius: 12, padding: 20, flexWrap: 'wrap' }}>
        {[24, 32, 48, 64, 96].map((s) => (
          <div key={s} style={{ textAlign: 'center' }}>
            <Pasita pose="compacta" size={s} />
            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{s}px</p>
          </div>
        ))}
      </div>
    </div>
  )
}
