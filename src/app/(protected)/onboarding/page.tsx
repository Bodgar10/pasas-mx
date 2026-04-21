'use client'

import { useState, useTransition } from 'react'
import { saveOnboarding, type OnboardingResult } from './actions'

type Step = 1 | 2 | 3 | 4

const LEVELS = [
  { emoji: '📚', label: 'Secundaria', subtitle: '1°, 2° o 3° año', needsGrade: true },
  { emoji: '🚀', label: 'Preparatoria / Bachillerato', subtitle: '1°, 2° o 3° año', needsGrade: true },
  { emoji: '📝', label: 'Examen de Preparatoria', subtitle: 'COMIPEMS · CCH · CECyT', needsGrade: false },
  { emoji: '🏛️', label: 'Examen de Universidad', subtitle: 'UNAM · IPN · UAM', needsGrade: false },
]

const GRADES = [
  { num: '1°', label: 'Primer año' },
  { num: '2°', label: 'Segundo año' },
  { num: '3°', label: 'Tercer año' },
]

const THEMES = [
  { emoji: '🎮', label: 'Videojuegos', subtitle: 'Minecraft · GTA · LoL' },
  { emoji: '🎤', label: 'K-pop & K-dramas', subtitle: 'BTS · Stray Kids' },
  { emoji: '⚽', label: 'Fútbol', subtitle: 'Liga MX · Champions' },
  { emoji: '⚔️', label: 'Anime & Manga', subtitle: 'Naruto · AOT · DS' },
]

const cardBase: React.CSSProperties = {
  border: '1.5px solid #2D2048',
  backgroundColor: '#1a1035',
  borderRadius: '14px',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s',
}

const cardSelected: React.CSSProperties = {
  border: '1.5px solid #7c3aed',
  backgroundColor: '#2d1b69',
}

function Checkmark({ selected }: { selected: boolean }) {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? '#7c3aed' : 'transparent',
        border: selected ? '2px solid #7c3aed' : '2px solid #2D2048',
        transition: 'all 0.15s',
      }}
    >
      {selected && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function ProgressBar({ step }: { step: Step }) {
  const filled = Math.min(step, 3) as 1 | 2 | 3
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
      {([1, 2, 3] as const).map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            backgroundColor: s <= filled ? '#7c3aed' : '#2D2048',
            transition: 'background-color 0.3s',
          }}
        />
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1)
  const [level, setLevel] = useState<string | null>(null)
  const [grade, setGrade] = useState<string | null>(null)
  const [theme, setTheme] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedLevel = LEVELS.find((l) => l.label === level)
  const selectedTheme = THEMES.find((t) => t.label === theme)
  const canProceed = step === 1 ? !!level : step === 2 ? !!grade : step === 3 ? !!theme : true

  function handleNext() {
    if (step === 1) {
      if (!selectedLevel) return
      setGrade(null)
      setTheme(null)
      setStep(selectedLevel.needsGrade ? 2 : 3)
    } else if (step === 2) {
      if (!grade) return
      setTheme(null)
      setStep(3)
    } else if (step === 3) {
      if (!theme) return
      setStep(4)
    } else {
      if (!theme || !level) return
      setError(null)
      startTransition(async () => {
        const result: OnboardingResult = await saveOnboarding({ level, grade, theme })
        if (result?.error) setError(result.error)
      })
    }
  }

  function handleBack() {
    if (step === 2) {
      setStep(1)
    } else if (step === 3) {
      setStep(selectedLevel?.needsGrade ? 2 : 1)
    } else if (step === 4) {
      setStep(3)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px 32px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 390 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#e2d9f3',
            }}
          >
            Pa<span style={{ color: '#a78bfa' }}>s</span>a<span style={{ color: '#a78bfa' }}>s</span>.mx
          </h1>
        </div>

        <ProgressBar step={step} />

        {/* Main card */}
        <div
          style={{
            backgroundColor: '#1a1035',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 20,
            padding: '24px 20px',
          }}
        >
          {/* Step 1 — Level */}
          {step === 1 && (
            <>
              <h2
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  marginBottom: 20,
                }}
              >
                ¿En qué estás?
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {LEVELS.map((opt) => {
                  const selected = level === opt.label
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setLevel(opt.label)}
                      style={{
                        ...cardBase,
                        ...(selected ? cardSelected : {}),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '12px 16px',
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#e2d9f3', margin: 0 }}>
                          {opt.label}
                        </p>
                        <p style={{ fontSize: 12, color: '#a78bfa', margin: '2px 0 0' }}>
                          {opt.subtitle}
                        </p>
                      </div>
                      <Checkmark selected={selected} />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 2 — Grade */}
          {step === 2 && (
            <>
              <h2
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  marginBottom: 20,
                }}
              >
                ¿Qué año cursas?
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {GRADES.map((g) => {
                  const selected = grade === g.num
                  return (
                    <button
                      key={g.num}
                      type="button"
                      onClick={() => setGrade(g.num)}
                      style={{
                        ...cardBase,
                        ...(selected ? cardSelected : {}),
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px 8px 16px',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-orbitron)',
                          fontSize: 28,
                          fontWeight: 900,
                          color: '#7c3aed',
                        }}
                      >
                        {g.num}
                      </span>
                      <span style={{ fontSize: 11, color: '#a78bfa', marginTop: 4, textAlign: 'center' }}>
                        {g.label}
                      </span>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Checkmark selected={selected} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 3 — Theme */}
          {step === 3 && (
            <>
              <h2
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  marginBottom: 20,
                }}
              >
                ¿Cuál es tu hobbie principal?
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {THEMES.map((t) => {
                  const selected = theme === t.label
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setTheme(t.label)}
                      style={{
                        ...cardBase,
                        ...(selected ? cardSelected : {}),
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '14px 12px',
                        position: 'relative',
                      }}
                    >
                      <span style={{ fontSize: 24, marginBottom: 8 }}>{t.emoji}</span>
                      <p style={{ fontWeight: 700, fontSize: 13, color: '#e2d9f3', margin: 0 }}>
                        {t.label}
                      </p>
                      <p style={{ fontSize: 11, color: '#a78bfa', margin: '3px 0 0' }}>
                        {t.subtitle}
                      </p>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Checkmark selected={selected} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 4 — Confirmation */}
          {step === 4 && (
            <>
              {/* XP badge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 13,
                    fontWeight: 900,
                    backgroundColor: '#422006',
                    color: '#fbbf24',
                    border: '1.5px solid #78350f',
                    borderRadius: 999,
                    padding: '5px 16px',
                  }}
                >
                  +100 XP 🔥
                </span>
              </div>

              {/* Trophy + title */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>🏆</div>
                <h2
                  style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#e2d9f3',
                    margin: '0 0 6px',
                  }}
                >
                  ¡Todo listo!
                </h2>
                <p style={{ fontSize: 14, color: '#a78bfa', margin: 0 }}>
                  Tu cuenta está personalizada
                </p>
              </div>

              {/* Summary card */}
              <div
                style={{
                  backgroundColor: '#1a1035',
                  border: '1.5px solid #2D2048',
                  borderRadius: 16,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Nivel</span>
                  <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 700 }}>
                    {selectedLevel?.emoji} {level}
                  </span>
                </div>
                {grade && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Año</span>
                    <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 700 }}>
                      📅 {grade}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Hobbie</span>
                  <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 700 }}>
                    {selectedTheme?.emoji} {theme}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p
              role="alert"
              style={{
                marginTop: 16,
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                backgroundColor: 'rgba(239,68,68,0.1)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {error}
            </p>
          )}

          {/* Primary button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isPending}
            style={{
              marginTop: 20,
              width: '100%',
              minHeight: 52,
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 16,
              border: 'none',
              cursor: canProceed && !isPending ? 'pointer' : 'not-allowed',
              backgroundColor: canProceed && !isPending ? '#7c3aed' : '#2D2048',
              color: canProceed && !isPending ? '#ffffff' : '#4B3D6E',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {isPending
              ? 'Guardando…'
              : step === 3
              ? '¡Empezar! ✨'
              : step === 4
              ? 'Ir al dashboard →'
              : 'Siguiente →'}
          </button>

          {/* Back link */}
          {step > 1 && (
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
          )}
        </div>
      </div>
    </div>
  )
}
