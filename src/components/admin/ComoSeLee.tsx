'use client'

import { useState } from 'react'
import { LECTURAS } from '@/lib/analytics/lecturas'
import { POSTHOG_INSIGHTS } from '@/lib/analytics/posthog-links'

/**
 * "¿Cómo leo esto?" — el tutorial que vive junto a cada número del admin.
 *
 * 🔴 COLAPSADO POR DEFECTO Y SIN EXCEPCIÓN. Un tablero donde la explicación
 * estorba al dato se deja de mirar. El enlace es discreto a propósito: está
 * para la primera vez y para las dudas, no para leerse cada día.
 *
 * Sin dependencias nuevas y con estilos en línea, como el resto del admin.
 */
export default function ComoSeLee({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false)
  const lectura = LECTURAS[id]

  // Un id que no existe no rompe la pantalla: simplemente no pinta nada.
  // El admin no puede caerse porque falte una ficha de tutorial.
  if (!lectura) return null

  const url = POSTHOG_INSIGHTS[lectura.link]

  return (
    <div style={{ marginTop: 8, fontFamily: 'var(--font-nunito)' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-nunito)',
          fontSize: 12,
          fontWeight: 700,
          color: '#6b5fa0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>
          ▶
        </span>
        ¿Cómo leo esto?
      </button>

      {abierto && (
        <div
          style={{
            marginTop: 10,
            background: '#1a1035',
            border: '1px solid #2D2048',
            borderRadius: 14,
            padding: '16px 18px',
            fontSize: 13,
            lineHeight: 1.65,
            color: '#c4b5fd',
          }}
        >
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 13, fontWeight: 900, color: '#e2d9f3', marginBottom: 8 }}>
            {lectura.titulo}
          </div>

          <p style={{ margin: '0 0 12px', color: '#e2d9f3' }}>{lectura.queMide}</p>

          <Bloque titulo="Cómo se lee">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lectura.comoSeLee.map((linea) => (
                <li key={linea} style={{ marginBottom: 4 }}>{linea}</li>
              ))}
            </ul>
          </Bloque>

          {/* Verde y rojo juntos: el umbral solo significa algo contra su
              contrario. Separarlos obliga a recordar el otro. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            <Umbral etiqueta="Bien" texto={lectura.bien} color="#10b981" />
            <Umbral etiqueta="Mal" texto={lectura.mal} color="#ef4444" />
          </div>

          <div
            style={{
              background: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 10,
              padding: '10px 12px',
              margin: '12px 0',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              ⚠️ Trampa
            </div>
            <div style={{ color: '#fde68a' }}>{lectura.trampa}</div>
          </div>

          <Bloque titulo="Si sale mal">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lectura.siSaleMal.map((accion) => (
                <li key={accion} style={{ marginBottom: 4 }}>{accion}</li>
              ))}
            </ul>
          </Bloque>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              background: '#7c3aed',
              color: '#fff',
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            Abrir en PostHog ↗
          </a>
        </div>
      )}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function Umbral({ etiqueta, texto, color }: { etiqueta: string; texto: string; color: string }) {
  return (
    <div
      style={{
        flex: '1 1 180px',
        background: `${color}12`,
        border: `1px solid ${color}44`,
        borderRadius: 10,
        padding: '9px 12px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
        {etiqueta}
      </div>
      <div style={{ color: '#e2d9f3' }}>{texto}</div>
    </div>
  )
}
