'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CANCELLATION_REASONS = [
  { value: 'precio', label: 'Muy caro / no puedo seguir pagando' },
  { value: 'no_la_uso', label: 'No la estoy usando lo suficiente' },
  { value: 'mi_hijo_no_quiso', label: 'A mi hijo no le gustó' },
  { value: 'encontre_algo_mejor', label: 'Encontré otra alternativa' },
  { value: 'falla_tecnica', label: 'Tuve problemas técnicos' },
  { value: 'vacaciones', label: 'Vacaciones, vuelvo después' },
  { value: 'otro', label: 'Otro motivo' },
] as const

type Step = 1 | 2 | 3 | 4

interface Props {
  periodEnd: Date
  onClose: () => void
  onCancelled: () => void
}

export function CancellationFlow({ periodEnd, onClose, onCancelled }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pauseMonths, setPauseMonths] = useState(1)

  const dateFormatted = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(periodEnd)

  async function executePause() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/subscription/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: pauseMonths }),
      })
      if (!res.ok) throw new Error('No se pudo pausar')
      setStep(4)
      onCancelled()
    } catch {
      setError('No se pudo pausar. Intenta de nuevo o escríbenos a hola@pasas.mx')
    } finally {
      setLoading(false)
    }
  }

  async function executeCancellation() {
    setLoading(true)
    setError('')

    try {
      // Guardar feedback si existe
      if (reason) {
        await fetch('/api/cancellation-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, detail }),
        })
      }

      // Cancelar suscripción
      const res = await fetch('/api/subscription/cancel', { method: 'POST' })
      if (!res.ok) throw new Error('No se pudo cancelar')

      setStep(4)
      onCancelled()
    } catch {
      setError('Ocurrió un error. Intenta de nuevo o escríbenos a hola@pasas.mx')
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
              ¿Cancelar tu suscripción?
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              Seguirás teniendo acceso hasta el{' '}
              <strong className="text-white">{dateFormatted}</strong>. No se
              cobrará nada más.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep(2)}
                className="w-full rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20"
              >
                Sí, quiero cancelar
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                No, mantener mi suscripción
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Feedback (opcional) ── */}
        {step === 2 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              Paso 2 de 3
            </p>
            <h2 className="mb-2 text-lg font-bold text-white">
              ¿Nos cuentas por qué?
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              Somos una empresa pequeña y esto nos ayuda mucho. Puedes saltarte
              este paso.
            </p>
            <div className="mb-4 space-y-2">
              {CANCELLATION_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                    reason === r.value
                      ? 'border-purple-500/60 bg-purple-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-purple-500"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            {reason && (
              <textarea
                placeholder="Cuéntanos más (opcional)..."
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/60 focus:outline-none"
              />
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setStep(3)}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                {reason ? 'Enviar y continuar' : 'Saltar y continuar'}
              </button>
              <button
                onClick={executeCancellation}
                disabled={loading}
                className="w-full rounded-lg py-2 text-xs text-gray-500 hover:text-red-400 disabled:opacity-50"
              >
                Cancelar definitivamente sin feedback
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Oferta de pausa (post-feedback, PROFECO ok) ── */}
        {step === 3 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              Paso 3 de 3
            </p>
            <h2 className="mb-2 text-lg font-bold text-white">
              ¿Vas de vacaciones?
            </h2>
            <p className="mb-5 text-sm text-gray-400">
              Pausa tu cuenta hasta 3 meses y tu progreso te espera. Sin costo.
              Sin cargos adicionales. Solo disponible para suscriptores activos.
            </p>

            {/* Opciones de pausa */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setPauseMonths(months)}
                  className={`rounded-lg border py-3 text-sm font-semibold transition-colors ${
                    pauseMonths === months
                      ? 'border-purple-500/60 bg-purple-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {months} {months === 1 ? 'mes' : 'meses'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={executePause}
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Pausando...' : `Pausar ${pauseMonths} ${pauseMonths === 1 ? 'mes' : 'meses'}`}
              </button>
              <button
                onClick={executeCancellation}
                disabled={loading}
                className="w-full rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {loading ? 'Cancelando...' : 'No, cancelar definitivamente'}
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-lg py-2 text-xs text-gray-500 hover:text-gray-300"
              >
                Mantener mi suscripción
              </button>
            </div>
            {error && (
              <p className="mt-3 text-center text-xs text-red-400">{error}</p>
            )}
          </div>
        )}

        {/* ── PASO 4: Confirmación de cancelación ── */}
        {step === 4 && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-2xl">
              ✓
            </div>
            <h2 className="mb-2 text-lg font-bold text-white">
              Suscripción cancelada
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              Tu suscripción no se renovará. Sigues teniendo acceso hasta el{' '}
              <strong className="text-white">{dateFormatted}</strong>. Te
              enviamos un correo de confirmación.
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
