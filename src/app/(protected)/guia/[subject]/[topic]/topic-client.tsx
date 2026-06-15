'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trackTopicCompleted, trackQuizAnswered, trackTopicStarted } from '@/components/posthog-events'

type SectionType =
  | 'explanation' | 'analogy' | 'example' | 'key_fact' | 'tip' | 'diagram'
  | 'scrubber' | 'steps' | 'sort'

interface Section {
  id: string
  type: SectionType
  title: string | null
  content: string
  data: Record<string, unknown> | null
  display_order: number
}

interface QuizQuestion {
  id: string
  question: string
  options: { letter: string; text: string }[]
  correct_answer: string
  explanation: string | null
  difficulty: number
  xp_reward: number
}

interface TopicProgress {
  status: 'not_started' | 'in_progress' | 'completed'
  best_score: number
  attempts: number
}

interface GenerationData {
  userId: string
  subjectId: string
  themeId: string
  topicId: string
  weakTopicIds: string[]
}

interface Props {
  subject: { id: string; name: string; slug: string }
  topic: { id: string; name: string; slug: string; difficulty: number; xp_reward: number }
  sections: Section[]
  quizQuestions: QuizQuestion[]
  initialProgress: TopicProgress | null
  readSectionIds: string[]
  initialAnswers: Record<string, string>
  isPersonalized?: boolean
  needsGeneration?: boolean
  generationData?: GenerationData
}

function renderContent(text: string): React.ReactNode {
  // If content is SVG, render it directly
  if (text.trim().startsWith('<svg')) {
    return (
      <div
        style={{ width: '100%', overflowX: 'auto' }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    )
  }
  // Otherwise render markdown bold
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ fontWeight: 800, color: '#e2d9f3' }}>
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}


const SECTION_ICONS: Partial<Record<Section['type'], string>> = {
  explanation: '📘',
  analogy: '🎮',
  example: '🔢',
  key_fact: '📌',
  tip: '💡',
  diagram: '🎨',
}

const SECTION_TYPE_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  borderColor: string
  headerBg: string
}> = {
  analogy: {
    label: 'Analogía',
    icon: '🎭',
    color: '#ec4899',
    borderColor: 'rgba(236,72,153,0.25)',
    headerBg: 'rgba(236,72,153,0.06)',
  },
  explanation: {
    label: 'Explicación',
    icon: '📘',
    color: '#a78bfa',
    borderColor: 'rgba(167,139,250,0.25)',
    headerBg: 'rgba(167,139,250,0.06)',
  },
  example: {
    label: 'Ejemplo resuelto',
    icon: '🔢',
    color: '#06b6d4',
    borderColor: 'rgba(6,182,212,0.25)',
    headerBg: 'rgba(6,182,212,0.06)',
  },
  key_fact: {
    label: 'Dato clave',
    icon: '📌',
    color: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.25)',
    headerBg: 'rgba(251,191,36,0.06)',
  },
  tip: {
    label: 'Tip para el examen',
    icon: '💡',
    color: '#10b981',
    borderColor: 'rgba(16,185,129,0.25)',
    headerBg: 'rgba(16,185,129,0.06)',
  },
  diagram: {
    label: 'Diagrama',
    icon: '🎨',
    color: '#06b6d4',
    borderColor: 'rgba(6,182,212,0.25)',
    headerBg: 'rgba(6,182,212,0.06)',
  },
  scrubber: {
    label: 'Pruébalo',
    icon: '🎮',
    color: '#ec4899',
    borderColor: 'rgba(236,72,153,0.25)',
    headerBg: 'rgba(236,72,153,0.06)',
  },
  steps: {
    label: 'Resuélvelo conmigo',
    icon: '🧩',
    color: '#06b6d4',
    borderColor: 'rgba(6,182,212,0.25)',
    headerBg: 'rgba(6,182,212,0.06)',
  },
  sort: {
    label: 'Clasifica',
    icon: '📊',
    color: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.25)',
    headerBg: 'rgba(251,191,36,0.06)',
  },
}

interface SortData {
  prompt?: string
  buckets: string[]
  items: { t: string; b: number }[]
}

interface ScrubberData {
  intro?: string
  unit: string
  min: number
  max: number
  start: number
  points: { v: number; l: string }[]
  question?: string
}

interface StepsData {
  intro?: string
  visual?: 'bar' | 'chain'
  start?: number
  steps: { text: string; delta?: number }[]
}

function StepsBlock({ data }: { data: Record<string, unknown> | null }) {
  const sd = data as unknown as StepsData | null
  const [step, setStep] = useState(0)

  if (!sd || !Array.isArray(sd.steps) || sd.steps.length === 0) {
    return null
  }

  const isBar = sd.visual === 'bar'
  const start = sd.start ?? 0
  const value = isBar
    ? start + sd.steps.slice(0, step).reduce((a, s) => a + (s.delta ?? 0), 0)
    : 0
  const barColor = value > 50 ? '#10b981' : value > 25 ? '#fbbf24' : '#ec4899'
  const done = step >= sd.steps.length

  return (
    <div style={{ padding: '14px 16px' }}>
      {sd.intro && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sd.intro}
        </div>
      )}

      {isBar && (
        <>
          <div style={{
            position: 'relative', height: 34, borderRadius: 50,
            background: '#000', border: `1px solid ${barColor}`,
            overflow: 'hidden', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.max(0, Math.min(100, value))}%`,
              background: barColor, transition: 'width 0.5s ease, background 0.5s ease',
            }} />
            <span style={{
              position: 'relative', zIndex: 1,
              fontFamily: 'var(--font-orbitron)', fontWeight: 900,
              fontSize: 14, color: '#0f0a1e',
            }}>
              {value}
            </span>
          </div>
          <div style={{
            textAlign: 'center', fontSize: 14, marginBottom: 14,
            fontFamily: 'var(--font-orbitron)', color: '#a78bfa',
          }}>
            {start}
            {sd.steps.slice(0, step).map((s, i) => (
              <span key={i} style={{ color: (s.delta ?? 0) < 0 ? '#ec4899' : '#10b981' }}>
                {' '}{(s.delta ?? 0) < 0 ? '−' : '+'} {Math.abs(s.delta ?? 0)}
              </span>
            ))}
            {step > 0 && <span style={{ color: barColor }}> = {value}</span>}
          </div>
        </>
      )}

      {!isBar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {sd.steps.slice(0, step).map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#e2d9f3',
            }}>
              <span style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 900, color: '#06b6d4', marginRight: 8 }}>
                {i + 1}.
              </span>
              {s.text}
            </div>
          ))}
        </div>
      )}

      {!done ? (
        <button
          type="button"
          onClick={() => setStep((s) => s + 1)}
          style={{
            width: '100%', minHeight: 44,
            background: 'rgba(6,182,212,0.15)', color: '#06b6d4',
            border: '1px solid #06b6d4', borderRadius: 12,
            fontFamily: 'var(--font-nunito)', fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {isBar
            ? `${sd.steps[step].text} ${(sd.steps[step].delta ?? 0) < 0 ? '−' : '+'}${Math.abs(sd.steps[step].delta ?? 0)} →`
            : 'Siguiente paso →'}
        </button>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#6ee7b7' }}>
          ✓ ¡Completado!
        </div>
      )}
    </div>
  )
}

function ScrubberBlock({ data }: { data: Record<string, unknown> | null }) {
  const sc = data as unknown as ScrubberData | null
  const [val, setVal] = useState<number>(() => sc?.start ?? 0)

  if (!sc || !Array.isArray(sc.points) || typeof sc.min !== 'number' || typeof sc.max !== 'number') {
    return null
  }

  const closest = sc.points.reduce((p, q) =>
    Math.abs(q.v - val) < Math.abs(p.v - val) ? q : p
  )

  return (
    <div style={{ padding: '14px 16px' }}>
      {sc.intro && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sc.intro}
        </div>
      )}
      <div style={{
        background: '#0f0a1e',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 12,
        padding: '16px 14px',
        textAlign: 'center',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {sc.unit}
        </div>
        <div style={{
          fontFamily: 'var(--font-orbitron)',
          fontSize: 32,
          fontWeight: 900,
          color: val >= 0 ? '#06b6d4' : '#ec4899',
        }}>
          {val > 0 ? `+${val}` : val}
        </div>
        <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 2 }}>
          {closest.l}
        </div>
      </div>
      <input
        type="range"
        min={sc.min}
        max={sc.max}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#ec4899' }}
      />
      {sc.question && (
        <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 8, lineHeight: 1.6 }}>
          {sc.question}
        </div>
      )}
    </div>
  )
}

function SortBlock({ data }: { data: Record<string, unknown> | null }) {
  const sort = data as unknown as SortData | null
  const [assign, setAssign] = useState<number[]>(
    () => (sort?.items ?? []).map(() => -1)
  )
  const [checked, setChecked] = useState(false)

  if (!sort || !Array.isArray(sort.items) || !Array.isArray(sort.buckets)) {
    return null
  }

  const allDone = assign.every((a) => a !== -1)
  const correct = assign.every((a, i) => a === sort.items[i].b)
  const bucketColors = ['#06b6d4', '#ec4899', '#fbbf24']

  return (
    <div style={{ padding: '14px 16px' }}>
      {sort.prompt && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sort.prompt}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {sort.items.map((it, i) => {
          const bk = assign[i]
          const ok = checked && bk === it.b
          const bad = checked && bk !== it.b
          const borderC = ok ? '#10b981' : bad ? '#ef4444' : 'rgba(124,58,237,0.25)'
          return (
            <button
              key={i}
              type="button"
              disabled={checked}
              onClick={() =>
                setAssign((arr) =>
                  arr.map((a, j) => (j === i ? (a + 1) % sort.buckets.length : a))
                )
              }
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${borderC}`, borderRadius: 10,
                padding: '10px 14px', fontSize: 15, color: '#e2d9f3',
                fontFamily: 'var(--font-nunito)', fontWeight: 600,
                cursor: checked ? 'default' : 'pointer', textAlign: 'left',
              }}
            >
              <span>{it.t}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                whiteSpace: 'nowrap',
                color: bk === -1 ? '#a78bfa' : bucketColors[bk % bucketColors.length],
                border: `1px solid ${bk === -1 ? 'rgba(167,139,250,0.3)' : bucketColors[bk % bucketColors.length]}`,
              }}>
                {bk === -1 ? 'toca para elegir →' : sort.buckets[bk]}
              </span>
            </button>
          )
        })}
      </div>
      {!checked ? (
        <button
          type="button"
          disabled={!allDone}
          onClick={() => setChecked(true)}
          style={{
            width: '100%', minHeight: 44,
            background: allDone ? '#7c3aed' : 'rgba(124,58,237,0.2)',
            color: allDone ? 'white' : '#a78bfa', border: 'none', borderRadius: 12,
            fontFamily: 'var(--font-nunito)', fontSize: 15, fontWeight: 800,
            cursor: allDone ? 'pointer' : 'default',
          }}
        >
          Revisar
        </button>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 700, color: correct ? '#6ee7b7' : '#fca5a5' }}>
          {correct
            ? '¡Todo bien clasificado!'
            : 'Revisa los marcados en rojo. Vuelve a intentarlo en el siguiente repaso.'}
        </div>
      )}
    </div>
  )
}

export default function TopicClient({
  subject,
  topic,
  sections,
  quizQuestions,
  initialProgress,
  readSectionIds,
  initialAnswers,
  isPersonalized: _isPersonalized = false,
  needsGeneration = false,
  generationData,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'guia' | 'quiz' | 'resumen'>('guia')
  // sessionXp starts at XP already earned from reading in previous visits
  const [sessionXp, setSessionXp] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => initialAnswers
  )
  const [score, setScore] = useState(() => {
    if (!quizQuestions || Object.keys(initialAnswers).length === 0) return 0
    return quizQuestions.filter(
      (q) => initialAnswers[q.id] === q.correct_answer
    ).length
  })
  const [combo, setCombo] = useState(0)
  const [xpPerQuestion, setXpPerQuestion] = useState<Record<string, number>>({})
  const [comboAtAnswer, setComboAtAnswer] = useState<Record<string, number>>({})
  const [isDesktop, setIsDesktop] = useState(false)
  const [readSections, setReadSections] = useState<Set<string>>(
    () => new Set(readSectionIds)
  )
  const [attempt, setAttempt] = useState(1)
  const [quizCompleted, setQuizCompleted] = useState(
    () =>
      quizQuestions.length > 0 &&
      Object.keys(initialAnswers).length === quizQuestions.length
  )
  const [quizResult, setQuizResult] = useState<{
    best_score: number
    perfect: boolean
  } | null>(() => {
    if (
      quizQuestions.length > 0 &&
      Object.keys(initialAnswers).length === quizQuestions.length &&
      initialProgress
    ) {
      return {
        best_score: initialProgress.best_score ?? 0,
        perfect: (initialProgress.best_score ?? 0) === 100,
      }
    }
    return null
  })
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateDots, setGenerateDots] = useState('.')
  const [generationDone, setGenerationDone] = useState(false)

  const [streakToast, setStreakToast] = useState<{
    days: number
    event: 'continued' | 'started'
  } | null>(null)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (initialProgress?.attempts) {
      setAttempt(initialProgress.attempts + 1)
    }
  }, [initialProgress])

  useEffect(() => {
    if (sections.length > 0) {
      trackTopicStarted(topic.name, subject.name, '')
    }
  }, [])

  useEffect(() => {
    if (!streakToast) return
    const timer = setTimeout(() => setStreakToast(null), 3500)
    return () => clearTimeout(timer)
  }, [streakToast])

  useEffect(() => {
    if (!generating) return
    const interval = setInterval(() => {
      setGenerateDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [generating])

  async function handleGenerate() {
    if (!generationData) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/personalized/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: generationData.userId,
          subjectId: generationData.subjectId,
          themeId: generationData.themeId,
          topicId: generationData.topicId,
          weakTopicIds: generationData.weakTopicIds,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al generar')
      }
      setGenerationDone(true)
      await new Promise(r => setTimeout(r, 800))
      router.refresh()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }

  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = (entry.target as HTMLElement).dataset.sectionId
            // Skip sections already read in previous sessions
            if (!sectionId || readSections.has(sectionId) || readSectionIds.includes(sectionId)) return

            const timer = setTimeout(() => {
              setReadSections((prev) => {
                if (prev.has(sectionId)) return prev
                return new Set([...prev, sectionId])
              })

              fetch('/api/section-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  section_id: sectionId,
                  topic_id: topic.id,
                  subject_id: subject.id,
                }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (!data.already_read && data.xp_earned > 0) {
                    setSessionXp((prev) => prev + data.xp_earned)
                  }
                  if (data.streak?.event === 'continued' || data.streak?.event === 'started') {
                    setStreakToast({
                      days: data.streak.days,
                      event: data.streak.event,
                    })
                  }
                })
                .catch(() => {})
            }, 2000)

            ;(entry.target as HTMLElement).dataset.timerId = String(timer)

            observer.unobserve(entry.target)
          } else {
            const timerId = (entry.target as HTMLElement).dataset.timerId
            if (timerId) {
              clearTimeout(Number(timerId))
              delete (entry.target as HTMLElement).dataset.timerId
            }
          }
        })
      },
      { threshold: 0.6, rootMargin: '0px' }
    )

    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections, topic.id, subject.id, readSections])

  async function handleAnswer(questionId: string, selectedLetter: string, question: QuizQuestion) {
    if (answers[questionId]) return
    const isCorrect = selectedLetter === question.correct_answer
    const newCombo = isCorrect ? combo + 1 : 0
    const multiplier = newCombo >= 3 ? 2 : newCombo >= 2 ? 1.5 : 1
    const xpEarned = isCorrect ? Math.round(question.xp_reward * multiplier) : 0

    const currentAnswerCount = Object.keys(answers).length
    const isLastQuestion = currentAnswerCount === quizQuestions.length - 1

    const newAnswers = { ...answers, [questionId]: selectedLetter }
    setAnswers(newAnswers)
    setCombo(newCombo)
    setXpPerQuestion((prev) => ({ ...prev, [questionId]: xpEarned }))
    setComboAtAnswer((prev) => ({ ...prev, [questionId]: newCombo }))
    if (isCorrect) {
      setScore((prev) => prev + 1)
      setSessionXp((prev) => prev + xpEarned)
    }

    let finalScore: number | undefined
    let totalCorrect: number | undefined
    if (isLastQuestion) {
      const correctCount = quizQuestions.filter(
        (q) => newAnswers[q.id] === q.correct_answer
      ).length
      totalCorrect = correctCount
      finalScore = Math.round((correctCount / quizQuestions.length) * 100)
    }

    const apiPayload = {
      question_id: questionId,
      topic_id: topic.id,
      subject_id: subject.id,
      selected_answer: selectedLetter,
      is_correct: isCorrect,
      xp_earned: xpEarned,
      combo: newCombo,
      attempt,
      ...(isLastQuestion && {
        is_last_question: true,
        final_score: finalScore,
        total_correct: totalCorrect,
        total_questions: quizQuestions.length,
      }),
    }

    if (isLastQuestion) {
      try {
        const res = await fetch('/api/quiz-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
        })
        const data = await res.json()
        if (data.topic_completed) {
          setQuizCompleted(true)
          setQuizResult({
            best_score: data.best_score,
            perfect: data.perfect,
          })
          if (data.perfect) {
            setSessionXp((prev) => prev + 150)
          }
          trackTopicCompleted(topic.name, subject.name, data.best_score, data.perfect)
        }
        trackQuizAnswered(topic.name, isCorrect, question.difficulty)
      } catch (err) {
        const { trackError } = await import('@/components/posthog-events')
        trackError('quiz_answer_api', err instanceof Error ? err.message : 'unknown', `topic:${topic.name}`)
      }
    } else {
      fetch('/api/quiz-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      }).catch(() => {})
      trackQuizAnswered(topic.name, isCorrect, question.difficulty)
    }
  }

  const summaryItems = sections.filter((s) => s.type === 'key_fact' || s.type === 'tip')
  const resumenSections = summaryItems.length > 0 ? summaryItems : sections

  return (
    <div
      style={{
        maxWidth: isDesktop ? 860 : 440,
        margin: '0 auto',
        fontFamily: 'var(--font-nunito)',
        color: '#e2d9f3',
        minHeight: '100vh',
      }}
    >

      {/* Generation screen for personalized topics without content */}
      {needsGeneration && !generationDone && (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '32px 16px',
        }}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            .gen-spin { animation: spin 1s linear infinite; }
          `}</style>
          <div style={{ width: '100%', maxWidth: 390 }}>
            <div style={{
              background: '#1a1035', border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 20, padding: '32px 20px', textAlign: 'center',
            }}>
              {!generating && !generateError && (
                <>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                  <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: '#e2d9f3', marginBottom: 8 }}>
                    {topic.name}
                  </div>
                  <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 24, lineHeight: 1.6 }}>
                    Tu guía personalizada para este tema aún no está lista. Generamos contenido único basado en tu diagnóstico.
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    style={{
                      width: '100%', minHeight: 52,
                      background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                      color: 'white', border: 'none', borderRadius: 14,
                      fontFamily: 'var(--font-orbitron)', fontSize: 14,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
                    }}
                  >
                    ✨ Generar mi guía →
                  </button>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    style={{
                      marginTop: 12, width: '100%', background: 'none',
                      border: 'none', cursor: 'pointer', fontSize: 15,
                      fontWeight: 600, color: '#a78bfa',
                    }}
                  >
                    ← Regresar
                  </button>
                </>
              )}

              {generating && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      border: '2px solid rgba(124,58,237,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div className="gen-spin" style={{
                        width: 46, height: 46, borderRadius: '50%',
                        border: '3px solid rgba(124,58,237,0.15)',
                        borderTop: '3px solid #7c3aed',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', marginBottom: 8 }}>
                    Generando tu guía{generateDots}
                  </div>
                  <div style={{ fontSize: 13, color: '#a78bfa', lineHeight: 1.6 }}>
                    Creando contenido personalizado para {topic.name}. No cierres esta ventana.
                  </div>
                </>
              )}

              {generateError && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    padding: '12px 14px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                    color: '#fca5a5', fontSize: 13, fontWeight: 600, marginBottom: 12,
                  }}>
                    {generateError}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    style={{
                      width: '100%', minHeight: 48, background: '#7c3aed',
                      color: 'white', border: 'none', borderRadius: 12,
                      fontFamily: 'var(--font-nunito)', fontSize: 15,
                      fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: '#0f0a1e',
          borderBottom: '1px solid rgba(124,58,237,0.15)',
          padding: isDesktop ? '20px 32px 16px' : '18px 16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#1a1035',
            border: '1px solid #2D2048',
            cursor: 'pointer',
            color: '#a78bfa',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ←
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: '#a78bfa',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              fontWeight: 700,
              marginBottom: 2,
            }}
          >
            {subject.name}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 15,
              fontWeight: 900,
              color: '#e2d9f3',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {topic.name}
          </div>
        </div>

        <div
          style={{
            background: initialProgress?.status === 'completed'
              ? 'rgba(16,185,129,0.1)'
              : 'rgba(251,191,36,0.1)',
            border: `1px solid ${
              initialProgress?.status === 'completed'
                ? 'rgba(16,185,129,0.3)'
                : 'rgba(251,191,36,0.25)'
            }`,
            borderRadius: 50,
            padding: '4px 10px',
            fontSize: 13,
            fontWeight: 800,
            color: initialProgress?.status === 'completed'
              ? '#10b981'
              : '#fbbf24',
            flexShrink: 0,
          }}
        >
          {initialProgress?.status === 'completed'
            ? '✓ Completado'
            : sessionXp > 0
            ? `⚡ +${sessionXp} XP sesión`
            : readSectionIds.length > 0
            ? `⚡ +${readSectionIds.length * 10} XP ganados`
            : '⚡ +0 XP sesión'}
        </div>
      </div>

      {/* Tabs row */}
      <div
        style={{
          display: 'flex',
          padding: isDesktop ? '0 32px' : '0 16px',
          borderBottom: '1px solid rgba(124,58,237,0.15)',
        }}
      >
        {(
          [
            { key: 'guia', label: '📖 Guía' },
            { key: 'quiz', label: '🎮 Quiz' },
            { key: 'resumen', label: '⚡ Resumen' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              flex: isDesktop ? undefined : 1,
              justifyContent: 'center',
              padding: isDesktop ? '12px 24px' : '10px 0',
              fontSize: isDesktop ? 16 : 15,
              fontWeight: 800,
              cursor: 'pointer',
              background: 'none',
              fontFamily: 'var(--font-nunito)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'color 0.2s',
              color: activeTab === key ? '#e2d9f3' : '#a78bfa',
              borderBottom: activeTab === key ? '2.5px solid #7c3aed' : '2.5px solid transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Guía */}
      <div style={{ display: activeTab === 'guia' ? 'block' : 'none', padding: isDesktop ? '24px 32px' : 16 }}>
        {sections.length === 0 ? (
          <div
            style={{
              background: '#1a1035',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 16,
              padding: '32px 16px',
              textAlign: 'center',
              color: '#a78bfa',
              fontSize: 16,
            }}
          >
            Contenido próximamente
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 40 }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute',
              left: 15,
              top: 20,
              bottom: 20,
              width: 1,
              background: 'rgba(124,58,237,0.2)',
            }} />

            {sections.map((section, index) => {
              const meta = SECTION_TYPE_CONFIG[section.type]
              return (
                <div
                  key={section.id}
                  style={{ position: 'relative', marginBottom: 16 }}
                  data-section-id={section.id}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(section.id, el)
                    else sectionRefs.current.delete(section.id)
                  }}
                >
                  {/* Dot */}
                  <div style={{
                    position: 'absolute',
                    left: -33,
                    top: 16,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: readSections.has(section.id) ? '2px solid #10b981' : `2px solid ${meta.color}`,
                    background: readSections.has(section.id) ? 'rgba(16,185,129,0.15)' : '#0f0a1e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    color: readSections.has(section.id) ? '#10b981' : meta.color,
                    fontFamily: 'var(--font-nunito)',
                    transition: 'all 0.3s ease',
                  }}>
                    {readSections.has(section.id) ? '✓' : index + 1}
                  </div>

                  {/* Card */}
                  <div style={{
                    background: '#1a1035',
                    border: `1px solid ${meta.borderColor}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '10px 16px',
                      borderBottom: `1px solid ${meta.borderColor}`,
                      background: meta.headerBg,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span style={{ fontSize: 15 }}>{meta.icon}</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase' as const,
                        letterSpacing: 1,
                        color: meta.color,
                      }}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{
                      padding: (section.type === 'diagram' || section.type === 'sort' || section.type === 'scrubber' || section.type === 'steps') ? '0' : '14px 16px',
                      fontSize: 15,
                      lineHeight: 1.75,
                      color: '#e2d9f3',
                    }}>
                      {section.type === 'diagram' ? (
                        <div
                          style={{ width: '100%' }}
                          dangerouslySetInnerHTML={{ __html: section.content
                            .replace(/<svg([^>]*?)width="[^"]*"([^>]*?)height="[^"]*"/g, '<svg$1$2')
                            .replace(/<svg([^>]*?)height="[^"]*"([^>]*?)width="[^"]*"/g, '<svg$1$2')
                            .replace('<svg ', '<svg style="width:100%;height:auto;display:block;" ')
                          }}
                        />
                      ) : section.type === 'sort' ? (
                        <SortBlock data={section.data} />
                      ) : section.type === 'scrubber' ? (
                        <ScrubberBlock data={section.data} />
                      ) : section.type === 'steps' ? (
                        <StepsBlock data={section.data} />
                      ) : renderContent(section.content)}
                    </div>

                    {/* Footer XP */}
                    <div style={{
                      padding: '8px 16px 12px',
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}>
                      <span style={{
                        fontSize: 12,
                        color: '#a78bfa',
                        fontWeight: 600,
                        transition: 'opacity 0.4s ease',
                      }}>
                        {readSections.has(section.id) ? (
                          <>
                            Leíste esto{' '}
                            <span style={{ color: '#fbbf24' }}>+10 XP</span>
                          </>
                        ) : (
                          <span style={{ color: 'rgba(167,139,250,0.4)' }}>Lee esta sección para ganar XP</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA to go to Quiz — only shown when there are sections */}
        {sections.length > 0 && (
          <div style={{
            margin: '8px 0 0',
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 16,
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 14,
              color: '#a78bfa',
              fontWeight: 600,
              marginBottom: 10,
            }}>
              ¿Ya leíste todo? Pon a prueba lo que aprendiste
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('quiz')}
              style={{
                width: '100%',
                minHeight: 52,
                background: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                fontFamily: 'var(--font-orbitron)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              IR AL QUIZ →
            </button>
          </div>
        )}
      </div>

      {/* Tab: Quiz */}
      <div style={{ display: activeTab === 'quiz' ? 'block' : 'none', padding: isDesktop ? '24px 32px' : 16 }}>
        {quizQuestions.length === 0 ? (
          <div
            style={{
              background: '#1a1035',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 16,
              padding: '32px 16px',
              textAlign: 'center',
              color: '#a78bfa',
              fontSize: 16,
            }}
          >
            Preguntas próximamente
          </div>
        ) : (
          <div style={{
            display: isDesktop ? 'grid' : 'block',
            gridTemplateColumns: isDesktop ? '200px 1fr' : undefined,
            gap: isDesktop ? 24 : undefined,
            alignItems: 'start',
          }}>
            {/* Left: score + combo dots */}
            <div style={{ position: isDesktop ? 'sticky' : undefined, top: isDesktop ? 80 : undefined }}>
              {/* Score display */}
              <div style={{ textAlign: 'center', paddingBottom: 16 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 24,
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #fbbf24, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {score} / {quizQuestions.length}
                </div>
                <div style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600, marginTop: 4 }}>
                  Respuestas correctas
                </div>
              </div>

              {/* Combo dots */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: i < combo ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                      border: i < combo
                        ? '1px solid #fbbf24'
                        : '1px solid rgba(124,58,237,0.3)',
                      boxShadow: i < combo ? '0 0 6px rgba(251,191,36,0.5)' : 'none',
                    }}
                  />
                ))}
                <span style={{ fontSize: 13, color: '#a78bfa' }}>
                  {combo >= 3 ? 'Combo x2 🔥' : combo >= 2 ? 'Combo x1.5 ⚡' : 'Combo'}
                </span>
              </div>
            </div>

            {/* Right: questions */}
            <div>
              {quizQuestions.map((question, index) => {
                const isAnswered = !!answers[question.id]
                const isLocked = index > 0 && !answers[quizQuestions[index - 1].id]
                const earnedXp = xpPerQuestion[question.id] ?? 0
                const comboWhenAnswered = comboAtAnswer[question.id] ?? 0
                const isCorrectAnswer = answers[question.id] === question.correct_answer

                return (
                  <div
                    key={question.id}
                    style={{
                      background: '#1e1040',
                      border: '1px solid rgba(236,72,153,0.2)',
                      borderRadius: 16,
                      padding: 18,
                      marginBottom: 12,
                      opacity: isLocked ? 0.4 : 1,
                      pointerEvents: isLocked ? 'none' : 'auto',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#f0e6ff',
                        marginBottom: 14,
                        lineHeight: 1.55,
                      }}
                    >
                      {question.question}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {question.options.map((option) => {
                        const isThisCorrect = option.letter === question.correct_answer
                        const isThisSelected = answers[question.id] === option.letter
                        const isThisWrong = isThisSelected && !isThisCorrect

                        let optBg = 'rgba(255,255,255,0.04)'
                        let optBorder = '1px solid rgba(124,58,237,0.2)'
                        let optColor = '#e2d9f3'

                        if (isAnswered && isThisCorrect) {
                          optBg = 'rgba(16,185,129,0.2)'
                          optBorder = '1px solid #10b981'
                          optColor = '#6ee7b7'
                        } else if (isThisWrong) {
                          optBg = 'rgba(239,68,68,0.15)'
                          optBorder = '1px solid #ef4444'
                          optColor = '#fca5a5'
                        }

                        return (
                          <button
                            key={option.letter}
                            type="button"
                            onClick={() => handleAnswer(question.id, option.letter, question)}
                            style={{
                              width: '100%',
                              background: optBg,
                              border: optBorder,
                              borderRadius: 10,
                              padding: '10px 14px',
                              fontSize: 15,
                              color: optColor,
                              cursor: isAnswered ? 'default' : 'pointer',
                              textAlign: 'left',
                              fontFamily: 'var(--font-nunito)',
                              fontWeight: 600,
                              transition: 'all 0.2s',
                              pointerEvents: isAnswered ? 'none' : 'auto',
                            }}
                          >
                            <strong style={{ fontWeight: 800 }}>{option.letter}.</strong>{' '}
                            {option.text}
                          </button>
                        )
                      })}
                    </div>

                    {isAnswered && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 700,
                          ...(isCorrectAnswer
                            ? {
                                background: 'rgba(16,185,129,0.12)',
                                color: '#6ee7b7',
                                border: '1px solid rgba(16,185,129,0.3)',
                              }
                            : {
                                background: 'rgba(239,68,68,0.08)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239,68,68,0.25)',
                              }),
                        }}
                      >
                        {question.explanation}
                        {isCorrectAnswer && earnedXp > 0 && (
                          <span
                            style={{
                              background: 'rgba(251,191,36,0.15)',
                              color: '#fbbf24',
                              borderRadius: 50,
                              padding: '2px 8px',
                              fontSize: 13,
                              marginLeft: 8,
                            }}
                          >
                            +{earnedXp}XP{comboWhenAnswered >= 3 ? ' COMBO🔥' : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {quizCompleted && quizResult && (
                <div style={{
                  marginTop: 16,
                  background: quizResult.perfect
                    ? 'rgba(251,191,36,0.08)'
                    : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${quizResult.perfect ? 'rgba(251,191,36,0.3)' : 'rgba(16,185,129,0.25)'}`,
                  borderRadius: 16,
                  padding: '20px 16px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 28,
                    fontWeight: 900,
                    color: quizResult.perfect ? '#fbbf24' : '#10b981',
                    marginBottom: 4,
                  }}>
                    {quizResult.best_score}%
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: quizResult.perfect ? '#fbbf24' : '#10b981',
                    marginBottom: 8,
                    letterSpacing: 1,
                  }}>
                    {quizResult.perfect ? '🔥 ¡PERFECTO! +150 XP' : '✓ Quiz completado'}
                  </div>
                  <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 16 }}>
                    {quizResult.perfect
                      ? 'Dominaste este tema al 100%'
                      : 'Puedes repetir el quiz para mejorar tu puntaje'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('resumen')}
                    style={{
                      width: '100%',
                      minHeight: 52,
                      background: quizResult.perfect
                        ? 'linear-gradient(135deg, #fbbf24, #ec4899)'
                        : 'linear-gradient(135deg, #7c3aed, #ec4899)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 14,
                      fontFamily: 'var(--font-orbitron)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: 1,
                    }}
                  >
                    VER RESUMEN →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab: Resumen */}
      <div style={{ display: activeTab === 'resumen' ? 'block' : 'none', padding: isDesktop ? '24px 32px' : 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 12,
            color: '#a78bfa',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          ⚡ Lo que necesitas saber
        </div>

        <div style={{
          display: isDesktop ? 'grid' : 'block',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined,
          gap: isDesktop ? '0 24px' : undefined,
        }}>
          {resumenSections.map((section, index) => (
            <div
              key={section.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '12px 0',
                borderBottom:
                  index < resumenSections.length - 1
                    ? '1px solid rgba(124,58,237,0.1)'
                    : 'none',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(124,58,237,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 17,
                  flexShrink: 0,
                }}
              >
                {SECTION_ICONS[section.type]}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.55, color: '#e2d9f3' }}>
                {renderContent(section.content)}
              </div>
            </div>
          ))}
        </div>

        {/* Completion card */}
        <div
          style={{
            marginTop: 16,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 14,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 14,
              color: '#10b981',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            ✓ Tema dominado
          </div>
          <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 12 }}>
            Continúa con el siguiente tema
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: '100%',
              minHeight: 52,
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              fontFamily: 'var(--font-orbitron)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 1,
            }}
          >
            SIGUIENTE TEMA →
          </button>
        </div>
      </div>

      <div style={{ height: 32 }} />

      {/* Streak toast */}
      {streakToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'linear-gradient(135deg, #1a1035, #1e1040)',
            border: '1.5px solid rgba(251,191,36,0.4)',
            borderRadius: 16,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 28 }}>🔥</span>
          <div>
            <div style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 13,
              fontWeight: 900,
              color: '#fbbf24',
              letterSpacing: 0.5,
            }}>
              {streakToast.event === 'continued'
                ? `¡Racha de ${streakToast.days} días!`
                : '¡Racha iniciada!'}
            </div>
            <div style={{
              fontSize: 13,
              color: '#a78bfa',
              fontWeight: 600,
              marginTop: 2,
            }}>
              {streakToast.event === 'continued'
                ? 'Sigue así, no rompas la cadena 💪'
                : 'Vuelve mañana para mantenerla'}
            </div>
          </div>
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateX(-50%) translateY(16px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
