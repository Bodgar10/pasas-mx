'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2

interface Props {
  learnerId: string
  learnerName: string
  accessUntil: Date
  onClose: () => void
  onRemoved: () => void
}

export function SeatRemovalFlow({ learnerId, learnerName, accessUntil, onClose, onRemoved }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const dateFormatted = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(accessUntil)

  async function executeRemoval() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/seats/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo dar de baja')

      setStep(2)
      onRemoved()
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Ocurrió un error. Intenta de nuevo o escríbenos a hola@pasas.mx'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f1a] p-6 shadow-xl">

        {/* ── PASO 1: Confirmación ── */}
        {step === 1 && (
          <div>
            <h2 className="mb-2 text-lg font-bold text-white">
              ¿Dar de baja a {learnerName}?
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Conserva acceso hasta el{' '}
              <strong className="text-white">{dateFormatted}</strong>. Ese
              periodo ya está pagado y no se cobra de nuevo por ese lugar.
            </p>
            <p className="mb-6 text-sm text-gray-400">
              Su avance y su XP se guardan. Si lo reactivas antes de esa fecha,
              vuelve exactamente como estaba.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={executeRemoval}
                disabled={loading}
                className="w-full rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {loading ? 'Dando de baja...' : 'Sí, dar de baja'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                No, mantenerlo
              </button>
            </div>
            {error && (
              <p className="mt-3 text-center text-xs text-red-400">{error}</p>
            )}
          </div>
        )}

        {/* ── PASO 2: Confirmado ── */}
        {step === 2 && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-2xl">
              ✓
            </div>
            <h2 className="mb-2 text-lg font-bold text-white">
              Lugar dado de baja
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              {learnerName} no se renovará. Sigue teniendo acceso hasta el{' '}
              <strong className="text-white">{dateFormatted}</strong>, y puedes
              reactivarlo desde tu perfil antes de esa fecha.
            </p>
            <button
              onClick={() => {
                onClose()
                router.refresh()
              }}
              className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
