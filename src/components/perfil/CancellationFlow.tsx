'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/analytics/track'

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
  /** Solo analitica: dia del ciclo, plan y ciclo para los eventos. */
  plan?: string
  ciclo?: string
  /** Dias transcurridos desde `current_period_start`. */
  diaDelCiclo?: number
  diasDesdeAlta?: number
  /**
   * Lugares que tiene la cuenta. Con mas de uno, el paso 1 advierte que
   * la cancelacion se los lleva a todos: alguien con dos hijos puede
   * cancelar creyendo que solo quita uno.
   */
  totalLugares?: number
}

export function CancellationFlow({
  periodEnd,
  onClose,
  onCancelled,
  totalLugares = 1,
  plan,
  ciclo,
  diaDelCiclo,
  diasDesdeAlta,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pauseMonths, setPauseMonths] = useState(1)

  // ── ANALITICA. Refs: ni un render de mas. ────────────────────────────
  /** Se llego al paso 3, donde se ofrece la pausa. */
  const pausaOfrecidaRef = useRef(false)
  /** Salio por una via que NO es abandono (cancelo o pauso). */
  const resueltoRef = useRef(false)
  const pasoRef = useRef<Step>(1)
  // Sincronizado en un efecto y no asignado durante el render: escribir una
  // ref en el cuerpo del componente lo rechaza el compilador de React.
  useEffect(() => {
    pasoRef.current = step
  }, [step])

  const propsComunes = { plan, ciclo, dia_del_ciclo: diaDelCiclo, dias_desde_alta: diasDesdeAlta }

  useEffect(() => {
    // Al ABRIR el flujo, no al confirmar. Es el denominador de la retencion:
    // sin el no se sabe a cuanta gente se convencio de quedarse.
    track('cancelacion_iniciada', { ...propsComunes, n_alumnos: totalLugares })

    /**
     * `cancelacion_abandonada` — el que se quedo.
     *
     * Se emite al desmontar SI no hubo desenlace. El componente es un modal:
     * cerrarlo lo desmonta, asi que la limpieza cubre tanto la X como el
     * boton de "no, mejor no".
     */
    return () => {
      if (resueltoRef.current) return
      track('cancelacion_abandonada', {
        ...propsComunes,
        paso_alcanzado: pasoRef.current,
        pausa_ofrecida: pausaOfrecidaRef.current,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dateFormatted = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(periodEnd)

  /**
   * 🔴 ARREGLO DEL CONTRATO — s38.
   *
   * Este cliente mandaba `{ reason, detail }` y el endpoint espera
   * `{ reason_category, reason_detail, pause_offered, pause_accepted }`.
   * Como `reason_category` llegaba undefined, /api/cancellation-feedback
   * devolvia 400 y NO guardaba nada — y nadie miraba la respuesta, asi que
   * la cancelacion seguia adelante en silencio y `cancellation_reasons`
   * quedaba vacia.
   *
   * El contrato correcto es el del endpoint; el cliente era el que estaba
   * mal, y por eso se arregla aqui y no alla.
   */
  async function guardarFeedback(pausaAceptada: boolean) {
    try {
      const res = await fetch('/api/cancellation-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason_category: reason,
          reason_detail: detail || null,
          pause_offered: pausaOfrecidaRef.current,
          pause_accepted: pausaAceptada,
        }),
      })

      // 5.2 — se COMPRUEBA la respuesta, pero NO se bloquea nada. Perder el
      // feedback no puede impedir que alguien cancele; que se pierda en
      // silencio, como hasta ahora, si es inaceptable.
      if (!res.ok) {
        track('error_occurred', {
          error_type: 'cancellation_feedback_api',
          error_message: `HTTP ${res.status}`,
          context: `reason:${reason}`,
          ruta: window.location.pathname,
        })
        return
      }

      track('motivo_cancelacion', {
        motivo: reason,
        texto_libre: detail.trim().length > 0,
        pausa_ofrecida: pausaOfrecidaRef.current,
        pausa_aceptada: pausaAceptada,
      })
    } catch (err) {
      track('error_occurred', {
        error_type: 'cancellation_feedback_api',
        error_message: err instanceof Error ? err.message : 'unknown',
        context: `reason:${reason}`,
        ruta: window.location.pathname,
      })
    }
  }

  async function executePause() {
    setLoading(true)
    setError('')
    try {
      /**
       * 🔴 EL FEEDBACK TAMBIEN SE GUARDA AL PAUSAR.
       *
       * Antes solo se guardaba en el camino de cancelar, asi que de quien
       * aceptaba la oferta de pausa no quedaba ni el motivo ni constancia de
       * que la oferta funciono. `pause_accepted: true` es justo lo que mide
       * si la retencion sirve.
       */
      if (reason) await guardarFeedback(true)

      const res = await fetch('/api/subscription/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: pauseMonths }),
      })
      if (!res.ok) throw new Error('No se pudo pausar')
      resueltoRef.current = true
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
      if (reason) await guardarFeedback(false)

      // Cancelar suscripción
      const res = await fetch('/api/subscription/cancel', { method: 'POST' })
      if (!res.ok) throw new Error('No se pudo cancelar')

      resueltoRef.current = true
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
            {totalLugares > 1 && (
              <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-200/90">
                  Esto cancela los <strong className="text-amber-300">{totalLugares} lugares</strong> de
                  tu cuenta, no solo uno. Si solo quieres quitar a una persona, cierra esto y usa
                  “Dar de baja” en su tarjeta de la sección Alumnos.
                </p>
              </div>
            )}
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
                onClick={() => {
                  pausaOfrecidaRef.current = true
                  setStep(3)
                }}
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
