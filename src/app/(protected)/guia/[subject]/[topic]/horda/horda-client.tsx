'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Option {
  letter: string
  text: string
}

interface Question {
  id: string
  wave: number
  question: string
  options: Option[]
}

interface Props {
  topicId: string
  topicName: string
  subjectSlug: string
  topicSlug: string
  bestWave: number
  attempts: number
}

type Phase = 'tutorial' | 'playing' | 'waveResult' | 'dead' | 'won'

const TOTAL_WAVES = 6

export default function HordaClient({
  topicId,
  topicName,
  subjectSlug,
  topicSlug,
  bestWave: initialBest,
  attempts: initialAttempts,
}: Props) {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('tutorial')
  const [wave, setWave] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [bestWave, setBestWave] = useState(initialBest)
  const [attempts, setAttempts] = useState(initialAttempts)
  const [correctInWave, setCorrectInWave] = useState(0)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{
    correct: boolean
    explanation: string
    hint: string | null
  } | null>(null)
  const [waveOutcome, setWaveOutcome] = useState<{
    outcome: string
    correctCount: number
    xpEarned: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startRun() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/horde/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')

      setAttempt(data.attempt)
      setAttempts(data.attempt)
      setBestWave(data.bestWave ?? 0)
      setWave(1)
      setQuestions(data.questions)
      setIndex(0)
      setCorrectInWave(0)
      setFeedback(null)
      setWaveOutcome(null)
      setPhase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar')
    } finally {
      setLoading(false)
    }
  }

  async function answer(letter: string) {
    if (loading || feedback) return
    setLoading(true)
    const current = questions[index]

    try {
      const res = await fetch('/api/horde/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          questionId: current.id,
          letter,
          wave,
          attempt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')

      setFeedback({
        correct: data.correct,
        explanation: data.explanation,
        hint: data.hint,
      })
      setCorrectInWave(data.correctCount)

      if (data.waveComplete) {
        setWaveOutcome({
          outcome: data.outcome,
          correctCount: data.correctCount,
          xpEarned: data.xpEarned ?? 0,
        })
        if (data.bestWave !== undefined) setBestWave(data.bestWave)
        if (data.questions) setQuestions(data.questions)
        if (data.nextWave) setWave(data.nextWave)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al responder')
    } finally {
      setLoading(false)
    }
  }

  function next() {
    setFeedback(null)

    if (!waveOutcome) {
      setIndex((i) => i + 1)
      return
    }

    const o = waveOutcome
    setWaveOutcome(null)
    setIndex(0)
    setCorrectInWave(0)

    if (o.outcome === 'finished') {
      setPhase('won')
    } else if (o.outcome === 'reset') {
      setPhase('dead')
    } else {
      setPhase('waveResult')
      setWaveOutcome(o)
    }
  }

  const backHref = `/guia/${subjectSlug}/${topicSlug}`

  if (phase === 'tutorial') {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }} aria-hidden="true">
            🧟
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 26,
              fontWeight: 900,
              color: '#e2d9f3',
              margin: '0 0 6px',
            }}
          >
            Modo Horda
          </h1>
          <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 24px', fontWeight: 600 }}>
            {topicName}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <Rule icon="1" text="Cada oleada son 5 preguntas. Hay 6 oleadas en total." />
          <Rule icon="2" text="Aciertas 4 o 5 → avanzas a la siguiente oleada." />
          <Rule icon="3" text="Aciertas 3 → repites la misma oleada." />
          <Rule icon="4" text="Aciertas 2 o menos → vuelves a la oleada 1." />
          <Rule icon="5" text="Cada oleada es más difícil que la anterior." />
        </div>

        {bestWave > 0 && (
          <div
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              textAlign: 'center',
              fontSize: 13,
              color: '#fbbf24',
              fontWeight: 700,
            }}
          >
            Tu récord: oleada {bestWave} de {TOTAL_WAVES} · {attempts}{' '}
            {attempts === 1 ? 'intento' : 'intentos'}
          </div>
        )}

        {error && <ErrorBox text={error} />}

        <PrimaryButton onClick={startRun} disabled={loading}>
          {loading ? 'Preparando…' : '▶ Empezar horda'}
        </PrimaryButton>
        <GhostButton onClick={() => router.push(backHref)}>Volver al tema</GhostButton>
      </Shell>
    )
  }

  if (phase === 'dead') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div
            style={{ fontSize: 64, marginBottom: 12, animation: 'hordaShake 0.5s ease-in-out' }}
            aria-hidden="true"
          >
            💀
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 24,
              fontWeight: 900,
              color: '#ef4444',
              margin: '0 0 8px',
            }}
          >
            La horda te alcanzó
          </h1>
          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 4px', fontWeight: 600 }}>
            Vuelves a la oleada 1
          </p>
          <p style={{ fontSize: 13, color: '#fbbf24', margin: '0 0 24px', fontWeight: 700 }}>
            Tu récord sigue siendo la oleada {bestWave} de {TOTAL_WAVES}
          </p>
          <PrimaryButton onClick={startRun} disabled={loading}>
            {loading ? 'Preparando…' : '🔁 Intentar de nuevo'}
          </PrimaryButton>
          <GhostButton onClick={() => router.push(backHref)}>Volver al tema</GhostButton>
        </div>
        <style>{`@keyframes hordaShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}`}</style>
      </Shell>
    )
  }

  if (phase === 'won') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }} aria-hidden="true">
            🏆
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 24,
              fontWeight: 900,
              color: '#fbbf24',
              margin: '0 0 8px',
            }}
          >
            ¡Sobreviviste!
          </h1>
          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 24px', fontWeight: 600 }}>
            Limpiaste las {TOTAL_WAVES} oleadas de {topicName}
          </p>
          <PrimaryButton onClick={() => router.push(backHref)}>Volver al tema</PrimaryButton>
          <GhostButton onClick={startRun}>Jugar otra vez</GhostButton>
        </div>
      </Shell>
    )
  }

  if (phase === 'waveResult' && waveOutcome) {
    const repeat = waveOutcome.outcome === 'repeat'
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">
            {repeat ? '😰' : '⚔️'}
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 22,
              fontWeight: 900,
              color: repeat ? '#fbbf24' : '#10b981',
              margin: '0 0 8px',
            }}
          >
            {repeat ? 'Apenas la libraste' : `¡Oleada ${wave - 1} superada!`}
          </h1>
          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 8px', fontWeight: 600 }}>
            {waveOutcome.correctCount} de 5 correctas
          </p>
          {waveOutcome.xpEarned > 0 && (
            <p style={{ fontSize: 15, color: '#fbbf24', margin: '0 0 8px', fontWeight: 800 }}>
              +{waveOutcome.xpEarned} XP
            </p>
          )}
          <p style={{ fontSize: 13, color: '#4B3D6E', margin: '0 0 24px', fontWeight: 600 }}>
            {repeat ? 'Repites esta oleada' : `Sigue la oleada ${wave}`}
          </p>
          <PrimaryButton
            onClick={() => {
              setWaveOutcome(null)
              setPhase('playing')
            }}
          >
            Continuar
          </PrimaryButton>
        </div>
      </Shell>
    )
  }

  const current = questions[index]
  if (!current) return null

  return (
    <Shell>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 13,
              fontWeight: 900,
              color: '#ec4899',
              letterSpacing: 1,
            }}
          >
            OLEADA {wave} / {TOTAL_WAVES}
          </span>
          <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700 }}>
            {index + 1} de 5 · {correctInWave} ✓
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {questions.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: i < index ? '#7c3aed' : i === index ? '#ec4899' : '#2D2048',
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          background: '#1e1040',
          border: '1px solid rgba(236,72,153,0.2)',
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#f0e6ff',
            marginBottom: 16,
            lineHeight: 1.55,
          }}
        >
          {current.question}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {current.options.map((o) => (
            <button
              key={o.letter}
              type="button"
              disabled={!!feedback || loading}
              onClick={() => answer(o.letter)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 15,
                color: '#e2d9f3',
                cursor: feedback ? 'default' : 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-nunito)',
                fontWeight: 600,
                opacity: feedback ? 0.5 : 1,
              }}
            >
              <strong style={{ fontWeight: 800 }}>{o.letter}.</strong> {o.text}
            </button>
          ))}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.55,
              fontWeight: 600,
              background: feedback.correct ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${feedback.correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: feedback.correct ? '#6ee7b7' : '#fca5a5',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              {feedback.correct ? '✓ Correcto' : '✗ Incorrecto'}
            </div>
            {feedback.hint && (
              <div style={{ color: '#fbbf24', marginBottom: 6 }}>💡 {feedback.hint}</div>
            )}
            <div style={{ color: '#c4b5fd' }}>{feedback.explanation}</div>
          </div>
        )}
      </div>

      {error && <ErrorBox text={error} />}

      {feedback && (
        <div style={{ marginTop: 16 }}>
          <PrimaryButton onClick={next}>Continuar</PrimaryButton>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0a1e', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Rule({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div
        style={{
          minWidth: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(124,58,237,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
          color: '#a78bfa',
          fontFamily: 'var(--font-orbitron)',
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 14, color: '#e2d9f3', lineHeight: 1.5, fontWeight: 600 }}>
        {text}
      </span>
    </div>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 44,
        marginTop: 10,
        background: 'transparent',
        border: 'none',
        color: '#a78bfa',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'var(--font-nunito)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#fca5a5',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  )
}
