'use client'

import Link from 'next/link'

interface HordeEntryCardProps {
  href: string
  hasBank: boolean
  bestWave?: number
  attempts?: number
  totalWaves?: number
}

export default function HordeEntryCard({
  href,
  hasBank,
  bestWave = 0,
  attempts = 0,
  totalWaves = 6,
}: HordeEntryCardProps) {
  if (!hasBank) return null

  const played = attempts > 0
  const completed = bestWave >= totalWaves
  const remaining = Math.max(totalWaves - bestWave, 0)

  return (
    <div
      style={{
        background: '#1a1035',
        border: '1px solid #2D2048',
        borderRadius: 20,
        padding: 18,
        marginTop: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">
          🧟
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: '#a78bfa',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontFamily: 'var(--font-nunito)',
          }}
        >
          Practica para tu examen
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-orbitron)',
          fontSize: 19,
          fontWeight: 900,
          color: '#e2d9f3',
          marginBottom: played ? 12 : 6,
          lineHeight: 1.3,
        }}
      >
        Modo Horda
      </div>

      {played ? (
        <>
          <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
            {Array.from({ length: totalWaves }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: i < bestWave ? '#10b981' : '#2D2048',
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              fontFamily: 'var(--font-nunito)',
            }}
          >
            <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>
              {completed
                ? `¡Horda completa! ${totalWaves} de ${totalWaves}`
                : `Tu récord: oleada ${bestWave} de ${totalWaves}`}
            </span>
            <span style={{ fontSize: 12, color: '#4B3D6E', fontWeight: 600 }}>
              {attempts} {attempts === 1 ? 'intento' : 'intentos'}
            </span>
          </div>
        </>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: '#a78bfa',
            margin: '0 0 16px',
            lineHeight: 1.55,
            fontFamily: 'var(--font-nunito)',
            fontWeight: 600,
          }}
        >
          Sobrevive 6 oleadas de preguntas. Cada una más difícil que la anterior.
        </p>
      )}

      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          minHeight: 52,
          background: '#7c3aed',
          border: 'none',
          borderRadius: 14,
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 800,
          fontFamily: 'var(--font-nunito)',
          textDecoration: 'none',
          transition: 'all 0.2s',
        }}
      >
        <span aria-hidden="true">{played ? '🔁' : '▶'}</span>
        {played ? 'Reintentar horda' : 'Empezar horda'}
      </Link>

      <div
        style={{
          fontSize: 11,
          color: '#4B3D6E',
          marginTop: 11,
          textAlign: 'center',
          fontFamily: 'var(--font-nunito)',
          fontWeight: 600,
        }}
      >
        {played && !completed
          ? `Te ${remaining === 1 ? 'falta' : 'faltan'} ${remaining} ${remaining === 1 ? 'oleada' : 'oleadas'}`
          : '30 preguntas · 5 por oleada'}
      </div>
    </div>
  )
}
