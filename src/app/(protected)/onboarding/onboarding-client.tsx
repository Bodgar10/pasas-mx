'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import Logo from '@/components/global/Logo'

type Step = 1 | 2 | 3 | 4
type Registrante = 'tutor' | 'alumno'

/**
 * FUENTE ÚNICA de los textos que cambian según quién registra.
 * Si hay que reescribir una pregunta, se hace AQUÍ, no en el JSX.
 */
const COPY: Record<Registrante, {
  nivel: string
  grado: string
  tema: string
  listoSub: string
  ctaFinal: string
  hobbieLabel: string
}> = {
  tutor: {
    nivel: '¿En qué está tu hijo o hija?',
    grado: '¿Qué año cursa?',
    tema: '¿Qué le gusta más?',
    listoSub: 'La cuenta está personalizada',
    ctaFinal: 'Ver cómo estudiaría →',
    hobbieLabel: 'Le gusta',
  },
  alumno: {
    nivel: '¿En qué estás?',
    grado: '¿Qué año cursas?',
    tema: '¿Cuál es tu hobbie principal?',
    listoSub: 'Tu cuenta está personalizada',
    ctaFinal: 'Ver cómo estudiarías →',
    hobbieLabel: 'Hobbie',
  },
}

interface Theme {
  id: string
  name: string
  description: string
  icon: string | null
  subtitle: string | null
}

interface Props {
  themes: Theme[]
}

const LEVELS = [
  { emoji: '📚', label: 'Secundaria', subtitle: '1°, 2° o 3° año', needsGrade: true },
  { emoji: '🚀', label: 'Preparatoria / Bachillerato', subtitle: '1°, 2° o 3° año', needsGrade: true },
  ...(FEATURE_FLAGS.ENABLE_EXAM_PLANS ? [
    { emoji: '📝', label: 'Examen de Preparatoria', subtitle: 'COMIPEMS · CCH · CECyT', needsGrade: false },
    { emoji: '🏛️', label: 'Examen de Universidad', subtitle: 'UNAM · IPN · UAM', needsGrade: false },
  ] : []),
]

const GRADES = [
  { num: '1°', label: 'Primer año' },
  { num: '2°', label: 'Segundo año' },
  { num: '3°', label: 'Tercer año' },
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

export default function OnboardingClient({ themes }: Props) {
  const [step, setStep] = useState<Step>(1)

  const [registrante, setRegistrante] = useState<Registrante>('tutor')
  const [level, setLevel] = useState<string | null>(null)
  const [grade, setGrade] = useState<string | null>(null)
  const [theme, setTheme] = useState<string | null>(null)
  const router = useRouter()

  const copy = COPY[registrante]

  const selectedLevel = LEVELS.find((l) => l.label === level)
  const selectedTheme = themes.find((t) => t.name === theme)
  const canProceed = step === 1 ? !!level : step === 2 ? !!grade : step === 3 ? !!theme : true

  async function handleNext() {
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
      // Save onboarding data in sessionStorage — will be persisted to DB after registration
      sessionStorage.setItem(
        'pasas_onboarding',
        JSON.stringify({ level, grade, theme, registrante })
      )
      const params = new URLSearchParams({ level })
      if (grade) params.set('grade', grade)
      params.set('theme', theme)
      params.set('registrante', registrante)
      router.push(`/onboarding/preview?${params.toString()}`)
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: '#7c3aed' }}>
            <Logo size={40} />
          </div>
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
              {/* Selector de quién registra. Solo en el paso 1: si se pudiera
                  cambiar más adelante, el copy mutaría bajo los pies del
                  usuario a media captura. Para cambiarlo se usa ← Regresar. */}
              <div style={{ marginBottom: 24 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#9CA3AF',
                    margin: '0 0 10px',
                  }}
                >
                  ¿Quién está creando la cuenta?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { id: 'tutor' as const, label: 'Soy el padre, madre o tutor' },
                    { id: 'alumno' as const, label: 'Soy el alumno y tengo 18 años o más' },
                  ]).map((opt) => {
                    const selected = registrante === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRegistrante(opt.id)}
                        style={{
                          ...cardBase,
                          ...(selected ? cardSelected : {}),
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        <Checkmark selected={selected} />
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#e2d9f3' }}>
                          {opt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#fbbf24',
                    backgroundColor: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    margin: '10px 0 0',
                  }}
                >
                  ⚠️ Si eres menor de edad, el registro lo debe realizar tu padre,
                  madre o tutor.
                </p>
              </div>

              <h2
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  marginBottom: 20,
                }}
              >
                {copy.nivel}
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
                        <p style={{ fontWeight: 700, fontSize: 16, color: '#e2d9f3', margin: 0 }}>
                          {opt.label}
                        </p>
                        <p style={{ fontSize: 14, color: '#a78bfa', margin: '2px 0 0' }}>
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
                {copy.grado}
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
                      <span style={{ fontSize: 13, color: '#a78bfa', marginTop: 4, textAlign: 'center' }}>
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
                {copy.tema}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {themes.map((t) => {
                  const selected = theme === t.name
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setTheme(t.name)}
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
                      <span style={{ fontSize: 24, marginBottom: 8 }}>{t.icon ?? '✨'}</span>
                      <p style={{ fontWeight: 700, fontSize: 15, color: '#e2d9f3', margin: 0 }}>
                        {t.name}
                      </p>
                      <p style={{ fontSize: 13, color: '#a78bfa', margin: '3px 0 0' }}>
                        {t.subtitle ?? t.description}
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
                    fontSize: 15,
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
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#e2d9f3',
                    margin: '0 0 6px',
                  }}
                >
                  ¡Todo listo!
                </h2>
                <p style={{ fontSize: 16, color: '#a78bfa', margin: 0 }}>
                  {copy.listoSub}
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
                  <span style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600 }}>Nivel</span>
                  <span style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700 }}>
                    {selectedLevel?.emoji} {level}
                  </span>
                </div>
                {grade && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600 }}>Año</span>
                    <span style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700 }}>
                      📅 {grade}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600 }}>{copy.hobbieLabel}</span>
                  <span style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700 }}>
                    {selectedTheme?.icon ?? '✨'} {theme}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Primary button */}
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
            {step === 3 ? '¡Empezar! ✨' : step === 4 ? copy.ctaFinal : 'Siguiente →'}
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
                fontSize: 16,
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
