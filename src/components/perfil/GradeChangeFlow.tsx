'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2

/**
 * Mismos mapas que onboarding/actions.ts: la columna es el enum
 * education_level y el grado un integer. Las etiquetas son solo para
 * pantalla y nunca se escriben en la base.
 */
const LEVELS = [
  { value: 'middle_school' as const, label: 'Secundaria' },
  { value: 'high_school' as const, label: 'Preparatoria' },
]

const GRADES = [
  { value: 1, label: '1°' },
  { value: 2, label: '2°' },
  { value: 3, label: '3°' },
]

interface Props {
  learnerId: string
  learnerName: string
  currentLevel: string | null
  currentGrade: number | null
  onClose: () => void
  onChanged: () => void
}

export function GradeChangeFlow({
  learnerId,
  learnerName,
  currentLevel,
  currentGrade,
  onClose,
  onChanged,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [level, setLevel] = useState<string | null>(currentLevel)
  const [grade, setGrade] = useState<number | null>(currentGrade)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sinCambio = level === currentLevel && grade === currentGrade
  const puedeConfirmar = !!level && !!grade && !sinCambio && !loading

  async function executeChange() {
    if (!level || !grade) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/seats/change-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, educationLevel: level, grade }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo cambiar el grado')

      setStep(2)
      onChanged()
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

  const nivelLabel = LEVELS.find((l) => l.value === level)?.label ?? ''
  const gradoLabel = GRADES.find((g) => g.value === grade)?.label ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f1a] p-6 shadow-xl">

        {/* ── PASO 1: Selección ── */}
        {step === 1 && (
          <div>
            <h2 className="mb-2 text-lg font-bold text-white">
              Cambiar el grado de {learnerName}
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              Las materias y los temas se ajustan al grado nuevo.
            </p>

            {/* Nivel */}
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Nivel
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  className={`rounded-lg border py-3 text-sm font-semibold transition-colors ${
                    level === l.value
                      ? 'border-purple-500/60 bg-purple-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Grado */}
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Año
            </p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGrade(g.value)}
                  className={`rounded-lg border py-3 text-sm font-semibold transition-colors ${
                    grade === g.value
                      ? 'border-purple-500/60 bg-purple-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="mb-5 rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3">
              <p className="text-sm text-gray-300">
                Tu avance del grado actual no se borra — se guarda y vuelve a
                aparecer si regresas.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={executeChange}
                disabled={!puedeConfirmar}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Cambiando...' : sinCambio ? 'Ya está en ese grado' : 'Confirmar cambio'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-lg py-2 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50"
              >
                Cancelar
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
              Grado actualizado
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              {learnerName} ahora está en{' '}
              <strong className="text-white">{gradoLabel} de {nivelLabel}</strong>.
              Sus materias ya se ajustaron.
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
