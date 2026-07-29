'use client'

import { useEffect, useState } from 'react'

/**
 * Confetti de celebracion. Vivia dentro de bienvenida/page.tsx; se extrajo
 * aqui para reusarlo en el Modo Horda. Fuente unica: si se cambian colores
 * o cantidad, se cambia aqui y aplica en los dos lugares.
 *
 * Nota: `borderRadius` usa Math.random() en el render, asi que la forma de
 * cada particula puede cambiar entre renders. Es intencional y no importa
 * visualmente: son 8px cayendo.
 */
export default function Confetti() {
  const [particles, setParticles] = useState<
    { id: number; x: number; color: string; delay: number; duration: number }[]
  >([])

  useEffect(() => {
    const colors = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#fbbf24']
    const p = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
    }))
    setParticles(p)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -10,
            width: 8,
            height: 8,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
