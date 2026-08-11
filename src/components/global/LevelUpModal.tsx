'use client'

import { useEffect, useState } from 'react'
import Confetti from './Confetti'
import Pasita from '@/components/mascota/Pasita'

interface Props {
  from: number
  to: number
  /**
   * Slot del alumno que subio de nivel. Sin esto, /api/level-seen cae al
   * primario y el modal del alumno 2 marcaria como visto el nivel del
   * alumno 1 — reapareciendo en cada visita para uno y desapareciendo
   * sin razon para el otro.
   */
  activeSlot?: number
}

export default function LevelUpModal({ from, to, activeSlot = 1 }: Props) {
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  async function close() {
    if (saving) return
    setSaving(true)
    setOpen(false)
    try {
      await fetch('/api/level-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: activeSlot }),
      })
    } catch {
      // Si falla, el modal reaparece en la siguiente visita. Aceptable.
    }
  }

  if (!open) return null

  const jumped = to - from > 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Subiste al nivel ${to}`}
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(10,6,22,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <Confetti />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 61,
          background: '#1a1035',
          border: '1px solid rgba(251,191,36,0.5)',
          borderRadius: 24,
          padding: '32px 24px 24px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'var(--font-nunito)',
        }}
      >
        {/* El momento más celebratorio del producto. 'saltar' se dispara una
            vez al montar el modal, que es exactamente cuando ocurre.
            <Pasita> directa y no diferida: el modal ya está en pantalla. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Pasita pose="celebrando" size={130} animacion="saltar" />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 13,
            fontWeight: 700,
            color: '#a78bfa',
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          SUBISTE DE NIVEL
        </div>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 44,
            fontWeight: 900,
            color: '#fbbf24',
            lineHeight: 1,
            marginBottom: 10,
          }}
        >
          NIVEL {to}
        </div>
        <p style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 600, margin: '0 0 24px', lineHeight: 1.5 }}>
          {jumped
            ? `Pasaste del nivel ${from} al ${to} de un jalón. Vas con todo.`
            : '¡Felicidades! Sigue así y no rompas la racha.'}
        </p>
        <button
          type="button"
          onClick={close}
          style={{
            width: '100%',
            minHeight: 52,
            background: '#7c3aed',
            border: 'none',
            borderRadius: 14,
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'var(--font-nunito)',
            cursor: 'pointer',
          }}
        >
          Seguir aprendiendo
        </button>
      </div>
    </div>
  )
}
