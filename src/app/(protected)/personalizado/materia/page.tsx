'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const SUBJECTS_BY_LEVEL: Record<string, { emoji: string; label: string }[]> = {
  Secundaria: [
    { emoji: '🧮', label: 'Matemáticas' },
    { emoji: '📝', label: 'Español' },
    { emoji: '🔬', label: 'Ciencias' },
    { emoji: '🗺️', label: 'Historia' },
    { emoji: '🌎', label: 'Geografía' },
  ],
  'Preparatoria / Bachillerato': [
    { emoji: '🧮', label: 'Matemáticas' },
    { emoji: '📝', label: 'Español' },
    { emoji: '🔬', label: 'Ciencias' },
    { emoji: '🗺️', label: 'Historia' },
    { emoji: '🌎', label: 'Geografía' },
  ],
  'Examen de Preparatoria': [
    { emoji: '🧮', label: 'Matemáticas' },
    { emoji: '📝', label: 'Comprensión lectora' },
    { emoji: '🗺️', label: 'Historia' },
    { emoji: '🔬', label: 'Ciencias' },
    { emoji: '🧬', label: 'Biología' },
  ],
  'Examen de Universidad': [
    { emoji: '🧮', label: 'Cálculo' },
    { emoji: '📐', label: 'Álgebra lineal' },
    { emoji: '🔬', label: 'Física' },
    { emoji: '📝', label: 'Español' },
    { emoji: '🧬', label: 'Química' },
  ],
}

function MateriaContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const theme = searchParams.get('theme') ?? ''

  const [subject, setSubject] = useState<string | null>(null)

  const subjects = SUBJECTS_BY_LEVEL[level] ?? SUBJECTS_BY_LEVEL['Secundaria']!

  function handleBack() {
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    router.push(`/onboarding/preview?${params.toString()}`)
  }

  function handleNext() {
    if (!subject) return
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    params.set('subject', subject)
    router.push(`/personalizado/diagnostico?${params.toString()}`)
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

        {/* Progress bar — 1/3 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                backgroundColor: s <= 1 ? '#7c3aed' : '#2D2048',
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
          <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 12 }}>📖</div>
          <h2
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 20,
              fontWeight: 900,
              color: '#e2d9f3',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            ¿Qué materia te falla?
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {subjects.map((opt) => {
              const selected = subject === opt.label
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSubject(opt.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    backgroundColor: selected ? '#2d1b69' : '#1a1035',
                    border: `1.5px solid ${selected ? '#7c3aed' : '#2D2048'}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2d9f3' }}>
                    {opt.label}
                  </span>
                  <div
                    style={{
                      marginLeft: 'auto',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? '#7c3aed' : 'transparent',
                      border: `2px solid ${selected ? '#7c3aed' : '#2D2048'}`,
                    }}
                  >
                    {selected && (
                      <svg width="11" height="9" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                        <path
                          d="M1 5L4.5 8.5L11 1.5"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!subject}
            style={{
              marginTop: 20,
              width: '100%',
              minHeight: 52,
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 16,
              border: 'none',
              cursor: subject ? 'pointer' : 'not-allowed',
              backgroundColor: subject ? '#7c3aed' : '#2D2048',
              color: subject ? '#ffffff' : '#4B3D6E',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Siguiente →
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

export default function MateriaPage() {
  return (
    <Suspense>
      <MateriaContent />
    </Suspense>
  )
}
