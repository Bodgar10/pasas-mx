'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Pasita from '@/components/mascota/Pasita'

interface Props {
  learnerId: string
  learnerName: string
  activeSlot: number
  /** Etiqueta legible del grado en curso, p.ej. "2° de Secundaria". */
  gradoActual: string
  siguiente: { education_level: string; grade: number; etiqueta: string }
  onClose: () => void
}

export default function PromocionCicloModal({
  learnerId,
  learnerName,
  activeSlot,
  gradoActual,
  siguiente,
  onClose,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /**
   * Los TRES caminos pasan por aqui. Es un aviso una vez por ciclo, no
   * una insistencia: cerrar sin decidir tambien cuenta como visto.
   */
  async function marcarVisto() {
    try {
      await fetch('/api/seats/promocion-vista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId }),
      })
    } catch {
      // Si falla, el modal reaparece en la siguiente visita. Aceptable.
    }
  }

  async function cerrar() {
    if (guardando) return
    setOpen(false)
    await marcarVisto()
    onClose()
  }

  async function confirmarPaso() {
    if (guardando) return
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/seats/change-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          educationLevel: siguiente.education_level,
          grade: siguiente.grade,
          // Este es el paso de ciclo escolar, no una correccion de un
          // dato mal capturado. La bitacora tiene que poder separarlos:
          // en septiembre entran de golpe cientos de promociones y,
          // mezcladas con las correcciones, no se distingue una
          // migracion masiva de un error de captura.
          reason: 'promocion_ciclo',
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'No pudimos cambiar el grado')
        setGuardando(false)
        return
      }
      await marcarVisto()
      setOpen(false)
      onClose()
      router.refresh()
    } catch {
      setError('No pudimos cambiar el grado. Intenta de nuevo.')
      setGuardando(false)
    }
  }

  /**
   * "Elegir otro grado" manda a /perfil, donde vive el GradeChangeFlow
   * con la lista completa de alumnos. Montarlo aqui obligaria a que
   * este modal conociera el catalogo de niveles y grados, que es
   * justamente lo que ese componente ya resuelve.
   */
  async function elegirOtro() {
    if (guardando) return
    setOpen(false)
    await marcarVisto()
    onClose()
    router.push('/perfil')
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`¿${learnerName} pasó a ${siguiente.etiqueta}?`}
      onClick={cerrar}
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 61,
          background: '#1a1035',
          border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 24,
          padding: '32px 24px 24px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'var(--font-nunito)',
        }}
      >
        {/* Pose confiada y flotar, NO celebrando ni Confetti: esto no es
            un logro del alumno, es un tramite de inicio de ciclo. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Pasita pose="confiada" size={130} animacion="flotar" />
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
          EMPEZÓ EL CICLO ESCOLAR
        </div>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 24,
            fontWeight: 900,
            color: '#e2d9f3',
            lineHeight: 1.25,
            marginBottom: 10,
          }}
        >
          ¿{learnerName} pasó a {siguiente.etiqueta}?
        </div>
        <p style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600, margin: '0 0 24px', lineHeight: 1.5 }}>
          Su avance de {gradoActual} no se borra: se guarda y vuelve a aparecer si regresas.
        </p>

        {error && (
          <p style={{ fontSize: 13, color: '#f87171', margin: '0 0 14px', lineHeight: 1.5 }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={confirmarPaso}
          disabled={guardando}
          style={{
            width: '100%',
            minHeight: 52,
            background: guardando ? '#2D2048' : '#7c3aed',
            border: 'none',
            borderRadius: 14,
            color: guardando ? '#4B3D6E' : '#fff',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'var(--font-nunito)',
            cursor: guardando ? 'not-allowed' : 'pointer',
          }}
        >
          {guardando ? 'Actualizando…' : `Sí, pasó a ${siguiente.etiqueta}`}
        </button>

        <button
          type="button"
          onClick={elegirOtro}
          disabled={guardando}
          style={{
            width: '100%',
            minHeight: 48,
            marginTop: 10,
            background: 'transparent',
            border: '1.5px solid #2D2048',
            borderRadius: 14,
            color: '#a78bfa',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--font-nunito)',
            cursor: guardando ? 'not-allowed' : 'pointer',
          }}
        >
          Elegir otro grado
        </button>

        <button
          type="button"
          onClick={cerrar}
          disabled={guardando}
          style={{
            width: '100%',
            marginTop: 12,
            background: 'none',
            border: 'none',
            color: '#a78bfa',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-nunito)',
            cursor: guardando ? 'not-allowed' : 'pointer',
            padding: '4px 0',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
