'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Section {
  id: string
  type: 'explanation' | 'analogy' | 'example' | 'key_fact' | 'tip' | 'diagram'
  title: string | null
  content: string
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

interface Props {
  subject: { id: string; name: string; slug: string }
  topic: { id: string; name: string; slug: string; difficulty: number; xp_reward: number }
  sections: Section[]
  quizQuestions: QuizQuestion[]
  initialProgress: TopicProgress | null
  readSectionIds: string[]
  initialAnswers: Record<string, string>
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


const SECTION_ICONS: Record<Section['type'], string> = {
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
}

export default function TopicClient({
  subject,
  topic,
  sections,
  quizQuestions,
  initialProgress,
  readSectionIds,
  initialAnswers,
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
    if (!streakToast) return
    const timer = setTimeout(() => setStreakToast(null), 3500)
    return () => clearTimeout(timer)
  }, [streakToast])

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
        }
      } catch {
        // Silent fail
      }
    } else {
      fetch('/api/quiz-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      }).catch(() => {})
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
          onClick={() => router.push(`/guia/${subject.slug}`)}
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
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 50,
            padding: '4px 10px',
            fontSize: 13,
            fontWeight: 800,
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          ⚡ +{sessionXp} XP sesión
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
                      padding: section.type === 'diagram' ? '0' : '14px 16px',
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
            onClick={() => router.push(`/guia/${subject.slug}`)}
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
