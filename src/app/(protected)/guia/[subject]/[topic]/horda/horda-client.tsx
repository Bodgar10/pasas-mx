'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Confetti from '@/components/global/Confetti'
import Pasita from '@/components/mascota/Pasita'

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
  activeSlot?: number
}

type Phase = 'tutorial' | 'playing' | 'waveResult' | 'dead' | 'won' | 'broken'

const TOTAL_WAVES = 6
const PER_WAVE = 5

export default function HordaClient({
  topicId,
  topicName,
  subjectSlug,
  topicSlug,
  bestWave: initialBest,
  attempts: initialAttempts,
  activeSlot = 1,
}: Props) {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('tutorial')
  const [wave, setWave] = useState(1)
  const [round, setRound] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [bestWave, setBestWave] = useState(initialBest)
  const [attempts, setAttempts] = useState(initialAttempts)
  const [correctInWave, setCorrectInWave] = useState(0)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
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
  const [pending, setPending] = useState<{
    questions: Question[] | null
    wave: number
    round: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const backHref = `/guia/${subjectSlug}/${topicSlug}`

  function goToTopic() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.replace(backHref)
    }
  }

  async function startRun() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/horde/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, slot: activeSlot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('No llegaron preguntas')
      }

      setAttempt(data.attempt)
      setAttempts(data.attempt)
      setBestWave(data.bestWave ?? 0)
      setWave(1)
      setRound(1)
      setQuestions(data.questions)
      setIndex(0)
      setCorrectInWave(0)
      setPicked(null)
      setFeedback(null)
      setWaveOutcome(null)
      setPending(null)
      setPhase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar')
      setPhase('broken')
    } finally {
      setLoading(false)
    }
  }

  async function answer(letter: string) {
    if (loading || feedback) return
    setPicked(letter)
    setLoading(true)
    const current = questions[index]

    try {
      const res = await fetch('/api/horde/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          slot: activeSlot,
          questionId: current.id,
          letter,
          wave,
          attempt,
          round,
          answeredSoFar: index,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')

      setFeedback({
        correct: data.correct,
        explanation: data.explanation,
        hint: data.hint,
      })
      if (data.correct) setCorrectInWave((c) => c + 1)

      const isLast = index >= PER_WAVE - 1
      if (data.waveComplete || isLast) {
        setWaveOutcome({
          outcome: data.outcome ?? 'reset',
          correctCount: data.correctCount ?? 0,
          xpEarned: data.xpEarned ?? 0,
        })
        if (typeof data.bestWave === 'number') setBestWave(data.bestWave)
        // NO aplicar aqui las preguntas ni la oleada siguiente: el alumno
        // sigue viendo la pregunta que acaba de responder. Si se reemplaza
        // `questions` en este momento, questions[index] pasa a ser otra
        // pregunta y el feedback queda encima de un enunciado distinto.
        setPending({
          questions:
            Array.isArray(data.questions) && data.questions.length > 0
              ? data.questions
              : null,
          wave: data.nextWave ?? wave,
          round: data.nextRound ?? round,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al responder')
      setPicked(null)
    } finally {
      setLoading(false)
    }
  }

  function next() {
    setFeedback(null)
    setPicked(null)

    if (!waveOutcome) {
      if (index + 1 >= questions.length) {
        setError('Se perdió el hilo de la oleada')
        setPhase('broken')
        return
      }
      setIndex((i) => i + 1)
      return
    }

    const o = waveOutcome
    setWaveOutcome(null)
    setIndex(0)
    setCorrectInWave(0)

    if (pending) {
      if (pending.questions) setQuestions(pending.questions)
      setWave(pending.wave)
      setRound(pending.round)
      setPending(null)
    }

    if (o.outcome === 'finished') {
      setPhase('won')
    } else if (o.outcome === 'reset') {
      setPhase('dead')
    } else {
      setWaveOutcome(o)
      setPhase('waveResult')
    }
  }

  if (phase === 'broken') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }} aria-hidden="true">
            🛠️
          </div>
          <h1 style={{ ...h1Style, color: '#e2d9f3', fontSize: 21 }}>Algo se atoró</h1>
          <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 20px', fontWeight: 600 }}>
            {error ?? 'Error desconocido'}
          </p>
          <PrimaryButton onClick={startRun} disabled={loading}>
            {loading ? 'Reintentando…' : 'Volver a empezar'}
          </PrimaryButton>
          <GhostButton onClick={goToTopic}>Volver al tema</GhostButton>
        </div>
      </Shell>
    )
  }

  if (phase === 'tutorial') {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          {/* La pose zombie sustituye al emoji: cicatriz, tornillos y lengua
              fuera. Cuenta de qué va el modo antes de leer las reglas. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Pasita pose="zombie" size={130} animacion="flotar" />
          </div>
          <h1 style={h1Style}>Modo Horda</h1>
          <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 24px', fontWeight: 600 }}>
            {topicName}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <Rule n="1" text="Cada oleada son 5 preguntas. Hay 6 oleadas en total." />
          <Rule n="2" text="Aciertas 4 o 5 → avanzas a la siguiente oleada." />
          <Rule n="3" text="Aciertas 3 → repites la misma oleada." />
          <Rule n="4" text="Aciertas 2 o menos → vuelves a la oleada 1." />
          <Rule n="5" text="Cada oleada es más difícil que la anterior." />
        </div>

        {bestWave > 0 && (
          <div style={recordBox}>
            Tu récord: oleada {bestWave} de {TOTAL_WAVES} · {attempts}{' '}
            {attempts === 1 ? 'intento' : 'intentos'}
          </div>
        )}

        {error && <ErrorBox text={error} />}

        <PrimaryButton onClick={startRun} disabled={loading}>
          {loading ? 'Preparando…' : '▶ Empezar horda'}
        </PrimaryButton>
        <GhostButton onClick={goToTopic}>Volver al tema</GhostButton>
      </Shell>
    )
  }

  if (phase === 'dead') {
    return (
      <Shell dark>
        <style>{`
@keyframes hdShake{0%,100%{transform:translate(0,0)}10%{transform:translate(-8px,3px)}20%{transform:translate(7px,-4px)}30%{transform:translate(-6px,-2px)}40%{transform:translate(5px,4px)}50%{transform:translate(-4px,2px)}60%{transform:translate(3px,-3px)}70%{transform:translate(-2px,1px)}80%{transform:translate(1px,-1px)}90%{transform:translate(-1px,0)}}
@keyframes hdPulse{0%{box-shadow:inset 0 0 0 rgba(220,38,38,0)}12%{box-shadow:inset 0 0 140px 40px rgba(220,38,38,.85)}45%{box-shadow:inset 0 0 90px 20px rgba(220,38,38,.35)}70%{box-shadow:inset 0 0 110px 28px rgba(220,38,38,.5)}100%{box-shadow:inset 0 0 80px 18px rgba(220,38,38,.3)}}
@keyframes hdDrip{0%{transform:scaleY(0);opacity:0}15%{opacity:1}100%{transform:scaleY(1);opacity:1}}
@keyframes hdIn{0%{opacity:0;transform:scale(1.5)}60%{opacity:1;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}
@keyframes hdFade{0%,35%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
        `}</style>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 16,
            animation: 'hdShake .7s ease-out 1',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              borderRadius: 16,
              animation: 'hdPulse 2.2s ease-out forwards',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 90,
              display: 'flex',
              gap: 14,
              padding: '0 22px',
              pointerEvents: 'none',
            }}
          >
            {drips.map((d, i) => (
              <div
                key={i}
                style={{
                  width: d.w,
                  height: d.h,
                  background: d.c,
                  borderRadius: `0 0 ${d.w}px ${d.w}px`,
                  transformOrigin: 'top',
                  animation: `hdDrip ${d.dur}s ease-out ${d.delay}s forwards`,
                  marginLeft: d.spacer ? 'auto' : undefined,
                }}
              />
            ))}
          </div>

          <div style={{ position: 'relative', padding: '56px 24px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 62, lineHeight: 1, marginBottom: 14, animation: 'hdIn .6s ease-out' }} aria-hidden="true">
              💀
            </div>
            <div
              style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 25,
                fontWeight: 900,
                color: '#ef4444',
                letterSpacing: 1,
                marginBottom: 10,
                animation: 'hdIn .6s ease-out .1s both',
              }}
            >
              LA HORDA TE ALCANZÓ
            </div>
            <div style={{ animation: 'hdFade 1.4s ease-out forwards' }}>
              <div style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600, marginBottom: 6 }}>
                Solo acertaste {waveOutcome?.correctCount ?? 0} de {PER_WAVE} · Vuelves a la oleada 1
              </div>
              <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, marginBottom: 22 }}>
                Tu récord sigue siendo la oleada {bestWave} de {TOTAL_WAVES}
              </div>
              <PrimaryButton onClick={startRun} disabled={loading}>
                {loading ? 'Preparando…' : '🔁 Intentar de nuevo'}
              </PrimaryButton>
              <GhostButton onClick={goToTopic}>Volver al tema</GhostButton>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  if (phase === 'won') {
    return (
      <Shell>
        <Confetti />
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {/* Sobrevivir las 6 oleadas es el logro más grande del modo, así que
              lleva la pose de celebración y no el trofeo genérico. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Pasita pose="celebrando" size={140} animacion="saltar" />
          </div>
          <h1 style={{ ...h1Style, color: '#fbbf24' }}>¡Sobreviviste!</h1>
          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 24px', fontWeight: 600 }}>
            Limpiaste las {TOTAL_WAVES} oleadas de {topicName}
          </p>
          <PrimaryButton onClick={goToTopic}>Volver al tema</PrimaryButton>
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
          <h1 style={{ ...h1Style, fontSize: 22, color: repeat ? '#fbbf24' : '#10b981' }}>
            {repeat ? 'Apenas la libraste' : `¡Oleada ${wave - 1} superada!`}
          </h1>
          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 8px', fontWeight: 600 }}>
            {waveOutcome.correctCount} de {PER_WAVE} correctas
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
  if (!current) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }} aria-hidden="true">
            🛠️
          </div>
          <h1 style={{ ...h1Style, color: '#e2d9f3', fontSize: 21 }}>Se perdió el hilo</h1>
          <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 20px', fontWeight: 600 }}>
            Vuelve a empezar la horda.
          </p>
          <PrimaryButton onClick={startRun} disabled={loading}>
            Volver a empezar
          </PrimaryButton>
          <GhostButton onClick={goToTopic}>Volver al tema</GhostButton>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
            {index + 1} de {PER_WAVE} · {correctInWave} ✓
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: PER_WAVE }).map((_, i) => (
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
        <div style={{ fontSize: 17, fontWeight: 700, color: '#f0e6ff', marginBottom: 16, lineHeight: 1.55 }}>
          {current.question}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {current.options.map((o) => {
            const isPicked = picked === o.letter
            let bg = 'rgba(255,255,255,0.04)'
            let border = '1px solid rgba(124,58,237,0.25)'
            let color = '#e2d9f3'

            if (isPicked && !feedback) {
              bg = 'rgba(124,58,237,0.35)'
              border = '1px solid #7c3aed'
            } else if (isPicked && feedback) {
              bg = feedback.correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.18)'
              border = `1px solid ${feedback.correct ? '#10b981' : '#ef4444'}`
              color = feedback.correct ? '#6ee7b7' : '#fca5a5'
            }

            return (
              <button
                key={o.letter}
                type="button"
                disabled={!!feedback || loading}
                onClick={() => answer(o.letter)}
                style={{
                  width: '100%',
                  background: bg,
                  border,
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 15,
                  color,
                  cursor: feedback ? 'default' : 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-nunito)',
                  fontWeight: 600,
                  opacity: feedback && !isPicked ? 0.4 : 1,
                  transition: 'background .12s, border-color .12s',
                }}
              >
                <strong style={{ fontWeight: 800 }}>{o.letter}.</strong> {o.text}
              </button>
            )
          })}
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
            {feedback.hint && <div style={{ color: '#fbbf24', marginBottom: 6 }}>💡 {feedback.hint}</div>}
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

const drips = [
  { w: 7, h: 34, c: '#dc2626', dur: 1.6, delay: 0, spacer: false },
  { w: 5, h: 62, c: '#b91c1c', dur: 2.0, delay: 0.15, spacer: false },
  { w: 9, h: 24, c: '#dc2626', dur: 1.3, delay: 0.3, spacer: false },
  { w: 4, h: 48, c: '#991b1b', dur: 1.8, delay: 0.1, spacer: false },
  { w: 6, h: 40, c: '#b91c1c', dur: 1.7, delay: 0.25, spacer: true },
  { w: 8, h: 70, c: '#dc2626', dur: 2.1, delay: 0.05, spacer: false },
  { w: 5, h: 30, c: '#991b1b', dur: 1.4, delay: 0.35, spacer: false },
]

const h1Style: React.CSSProperties = {
  fontFamily: 'var(--font-orbitron)',
  fontSize: 26,
  fontWeight: 900,
  color: '#e2d9f3',
  margin: '0 0 6px',
}

const recordBox: React.CSSProperties = {
  background: 'rgba(251,191,36,0.1)',
  border: '1px solid rgba(251,191,36,0.3)',
  borderRadius: 12,
  padding: '12px 16px',
  marginBottom: 20,
  textAlign: 'center',
  fontSize: 13,
  color: '#fbbf24',
  fontWeight: 700,
}

function Shell({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0a1e', padding: dark ? '16px' : '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Rule({ n, text }: { n: string; text: string }) {
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
        {n}
      </div>
      <span style={{ fontSize: 14, color: '#e2d9f3', lineHeight: 1.5, fontWeight: 600 }}>{text}</span>
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

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
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
