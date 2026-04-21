'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function DiagnosticoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const theme = searchParams.get('theme') ?? ''
  const subject = searchParams.get('subject') ?? ''

  const [path, setPath] = useState<'descripcion' | 'quiz'>('descripcion')
  const [description, setDescription] = useState('')

  const canProceed =
    (path === 'descripcion' && description.trim().length >= 10) || path === 'quiz'

  function handleBack() {
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    router.push(`/personalizado/materia?${params.toString()}`)
  }

  function handleNext() {
    if (!canProceed) return
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    params.set('subject', subject)
    params.set('diagnostico', path === 'descripcion' ? description.trim() : 'quiz')
    params.set('tipo', path)
    router.push(`/personalizado/preview-ia?${params.toString()}`)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px 40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 390 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#a78bfa',
              margin: 0,
            }}
          >
            PASAS.MX
          </p>
        </div>

        {/* Progress bar — 2/3 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                backgroundColor: s <= 2 ? '#7c3aed' : '#2D2048',
              }}
            />
          ))}
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: '#1a1035',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 20,
            padding: '24px 20px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 18,
              fontWeight: 900,
              color: '#e2d9f3',
              marginBottom: 6,
            }}
          >
            ¿Qué te falla en {subject}?
          </h2>
          <p style={{ fontSize: 13, color: '#a78bfa', margin: '0 0 20px' }}>
            Cuéntanos para personalizar tu guía
          </p>

          {/* Path selector */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setPath('descripcion')}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 10,
                border: `1.5px solid ${path === 'descripcion' ? '#7c3aed' : '#2D2048'}`,
                backgroundColor: path === 'descripcion' ? '#2d1b69' : '#1a1035',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                color: '#e2d9f3',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              ✍️ Yo lo describo
            </button>
            <button
              type="button"
              onClick={() => setPath('quiz')}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 10,
                border: `1.5px solid ${path === 'quiz' ? '#7c3aed' : '#2D2048'}`,
                backgroundColor: path === 'quiz' ? '#2d1b69' : '#1a1035',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                color: '#e2d9f3',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              🎯 Hacerme un quiz
            </button>
          </div>

          {/* Path A — description */}
          {path === 'descripcion' && (
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Ej: "No entiendo cómo resolver ecuaciones de segundo grado, siempre me confundo con la fórmula general..."`}
                rows={5}
                style={{
                  width: '100%',
                  backgroundColor: '#0f0a1e',
                  border: '1.5px solid #2D2048',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 13,
                  color: '#e2d9f3',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                  fontFamily: 'var(--font-nunito)',
                }}
              />
              {description.trim().length > 0 && description.trim().length < 10 && (
                <p style={{ fontSize: 11, color: '#f87171', margin: '6px 0 0' }}>
                  Agrega un poco más de detalle (mínimo 10 caracteres)
                </p>
              )}
            </div>
          )}

          {/* Path B — quiz notice */}
          {path === 'quiz' && (
            <div
              style={{
                backgroundColor: '#0f0a1e',
                border: '1.5px solid #2D2048',
                borderRadius: 12,
                padding: '16px 14px',
                fontSize: 13,
                color: '#a78bfa',
                lineHeight: 1.6,
              }}
            >
              🎯 Te haremos 3 preguntas rápidas para identificar exactamente dónde necesitas ayuda.
              <br />
              <br />
              <span style={{ color: '#e2d9f3', fontWeight: 700 }}>¡Listo para empezar!</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              marginTop: 20,
              width: '100%',
              minHeight: 52,
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 16,
              border: 'none',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              backgroundColor: canProceed ? '#7c3aed' : '#2D2048',
              color: canProceed ? '#ffffff' : '#4B3D6E',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Ver mi guía personalizada →
          </button>

          <button
            type="button"
            onClick={handleBack}
            style={{
              marginTop: 12,
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#a78bfa',
              textAlign: 'center',
              padding: '4px 0',
            }}
          >
            ← Regresar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiagnosticoPage() {
  return (
    <Suspense>
      <DiagnosticoContent />
    </Suspense>
  )
}
