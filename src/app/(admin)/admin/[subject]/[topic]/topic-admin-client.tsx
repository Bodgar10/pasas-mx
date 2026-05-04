'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

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

interface Theme {
  id: string
  name: string
}

interface Props {
  subject: { id: string; name: string; slug: string }
  topic: {
    id: string
    name: string
    slug: string
    difficulty: number
    xp_reward: number
    published: boolean
  }
  sections: Section[]
  quizQuestions: QuizQuestion[]
  themes: Theme[]
  selectedThemeId: string
  grade: number
  level: string
  completedCount: number
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

const SECTION_TYPE_LABELS: Record<
  Section['type'],
  { label: string; bg: string; color: string; border: string }
> = {
  explanation: {
    label: '📘 Explicación',
    bg: 'rgba(124,58,237,0.15)',
    color: '#c4b5fd',
    border: 'rgba(124,58,237,0.3)',
  },
  analogy: {
    label: '🎮 Analogía',
    bg: 'rgba(236,72,153,0.12)',
    color: '#ec4899',
    border: 'rgba(236,72,153,0.3)',
  },
  example: {
    label: '🔢 Ejemplo',
    bg: 'rgba(6,182,212,0.1)',
    color: '#06b6d4',
    border: 'rgba(6,182,212,0.3)',
  },
  key_fact: {
    label: '📌 Dato clave',
    bg: 'rgba(251,191,36,0.1)',
    color: '#fbbf24',
    border: 'rgba(251,191,36,0.3)',
  },
  tip: {
    label: '💡 Tip de examen',
    bg: 'rgba(16,185,129,0.1)',
    color: '#10b981',
    border: 'rgba(16,185,129,0.3)',
  },
  diagram: {
    label: '🎨 Diagrama',
    bg: 'rgba(6,182,212,0.1)',
    color: '#06b6d4',
    border: 'rgba(6,182,212,0.3)',
  },
}

const SECTION_ICONS: Record<Section['type'], string> = {
  explanation: '📘',
  analogy: '🎮',
  example: '🔢',
  key_fact: '📌',
  tip: '💡',
  diagram: '🎨',
}

export default function TopicAdminClient({
  subject,
  topic,
  sections: initialSections,
  quizQuestions: initialQuizQuestions,
  themes,
  selectedThemeId: initialThemeId,
  grade,
  level,
  completedCount,
}: Props) {
  const router = useRouter()

  // Student view state
  const [activeTab, setActiveTab] = useState<'guia' | 'quiz' | 'resumen'>('guia')
  const [sessionXp, setSessionXp] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [xpPerQuestion, setXpPerQuestion] = useState<Record<string, number>>({})
  const [comboAtAnswer, setComboAtAnswer] = useState<Record<string, number>>({})

  // Admin state
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(initialQuizQuestions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editQuestionData, setEditQuestionData] = useState<{
    question: string
    options: { letter: string; text: string }[]
    correct_answer: string
    explanation: string
  } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [themeChanging, setThemeChanging] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState(initialThemeId)
  const [published, setPublished] = useState(topic.published && initialSections.length > 0)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setThemeChanging(false)
    setSections(initialSections)
  }, [initialSections])

  useEffect(() => {
    setPublished(topic.published && initialSections.length > 0)
  }, [selectedThemeId, topic.published, initialSections])

  useEffect(() => {
    setQuizQuestions(initialQuizQuestions)
  }, [initialQuizQuestions])

  const summaryItems = sections.filter((s) => s.type === 'key_fact' || s.type === 'tip')
  const resumenSections = summaryItems.length > 0 ? summaryItems : sections

  // Student quiz handler
  function handleAnswer(questionId: string, selectedLetter: string, question: QuizQuestion) {
    if (answers[questionId]) return
    const isCorrect = selectedLetter === question.correct_answer
    const newCombo = isCorrect ? combo + 1 : 0
    const multiplier = newCombo >= 3 ? 2 : newCombo >= 2 ? 1.5 : 1
    const xpEarned = isCorrect ? Math.round(question.xp_reward * multiplier) : 0
    setAnswers((prev) => ({ ...prev, [questionId]: selectedLetter }))
    setCombo(newCombo)
    setXpPerQuestion((prev) => ({ ...prev, [questionId]: xpEarned }))
    setComboAtAnswer((prev) => ({ ...prev, [questionId]: newCombo }))
    if (isCorrect) {
      setScore((prev) => prev + 1)
      setSessionXp((prev) => prev + xpEarned)
    }
  }

  // Admin section CRUD
  function startEdit(id: string, content: string) {
    setEditingId(id)
    setEditContent(content)
  }

  async function handleSaveSection(sectionId: string) {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('sections').update({ content: editContent }).eq('id', sectionId)
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content: editContent } : s))
    )
    setEditingId(null)
    setSaving(false)
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm('¿Eliminar esta sección?')) return
    const supabase = createClient()
    await supabase.from('sections').delete().eq('id', sectionId)
    setSections((prev) => prev.filter((s) => s.id !== sectionId))
  }

  // Admin question CRUD
  function startEditQuestion(question: QuizQuestion) {
    setEditingQuestionId(question.id)
    setEditQuestionData({
      question: question.question,
      options: question.options.map((o) => ({ ...o })),
      correct_answer: question.correct_answer,
      explanation: question.explanation ?? '',
    })
  }

  async function handleSaveQuestion(questionId: string) {
    if (!editQuestionData) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('quiz_questions')
      .update({
        question: editQuestionData.question,
        options: editQuestionData.options,
        correct_answer: editQuestionData.correct_answer,
        explanation: editQuestionData.explanation,
      })
      .eq('id', questionId)
    setQuizQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, ...editQuestionData } : q
      )
    )
    setEditingQuestionId(null)
    setEditQuestionData(null)
    setSaving(false)
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    const supabase = createClient()
    await supabase.from('quiz_questions').delete().eq('id', questionId)
    setQuizQuestions((prev) => prev.filter((q) => q.id !== questionId))
  }

  async function togglePublish() {
    const supabase = createClient()
    await supabase.from('topics').update({ published: !published }).eq('id', topic.id)
    setPublished((prev) => !prev)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 55000)

      const res = await fetch('/api/admin/generate-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topicId: topic.id,
          topicName: topic.name,
          topicSlug: topic.slug,
          subjectName: subject.name,
          themeId: selectedThemeId,
          themeName: themes.find((t) => t.id === selectedThemeId)?.name,
          grade,
          level,
        }),
      })

      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.error) {
        setGenerateError(`Error del servidor: ${data.error}`)
        return
      }
      if (data.sections) setSections(data.sections)
      if (data.quizQuestions) setQuizQuestions(data.quizQuestions)
      setPublished(false)
    } catch (err) {
      setGenerateError(`Error de red: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setGenerating(false)
    }
  }

  const ADMIN_TOOLBAR_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: -12,
    right: 8,
    zIndex: 10,
    display: 'flex',
    gap: 6,
    background: '#0f0a1e',
    borderRadius: 50,
    padding: '4px 8px',
    border: '1px solid rgba(124,58,237,0.3)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  }

  const TOOLBAR_BTN_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 4px',
  }

  return (
    <div style={{ fontFamily: 'var(--font-nunito)', color: '#e2d9f3', minHeight: '100vh', maxWidth: isDesktop ? 1100 : '100%', margin: '0 auto' }}>
      {generating && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(15,10,30,0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '3px solid rgba(124,58,237,0.2)',
            borderTop: '3px solid #7c3aed',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 15,
            color: '#e2d9f3',
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            Generando contenido...
          </div>
          <div style={{
            fontSize: 14,
            color: '#a78bfa',
            fontWeight: 600,
            maxWidth: 260,
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Claude está creando las secciones y preguntas. Esto tarda unos 30 segundos.
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      {/* ─── ADMIN TOP BANNER ─── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: '#1e1040',
          borderBottom: '2px solid rgba(124,58,237,0.4)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Left */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() =>
              router.push(`/admin/${subject.slug}?grade=${grade}&level=${level}`)
            }
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
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
          <span
            style={{
              fontSize: 13,
              color: '#a78bfa',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {subject.name}
          </span>
          <span style={{ color: '#2D2048', fontSize: 14 }}>›</span>
          <span
            style={{
              fontSize: 15,
              color: '#e2d9f3',
              fontWeight: 800,
              fontFamily: 'var(--font-orbitron)',
            }}
          >
            {topic.name}
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={selectedThemeId}
            onChange={(e) => {
              if (!published && sections.length > 0) {
                const confirm = window.confirm(
                  '⚠️ Este contenido aún no está publicado.\n\n¿Seguro que quieres cambiar de temática? El contenido generado ya está guardado en la base de datos y podrás volver a verlo cuando regreses a esta temática.'
                )
                if (!confirm) return
              }
              setThemeChanging(true)
              setPublished(false)
              setSelectedThemeId(e.target.value)
              const url = new URL(window.location.href)
              url.searchParams.set('themeId', e.target.value)
              router.push(url.pathname + '?' + url.searchParams.toString())
            }}
            style={{
              background: '#1C1033',
              border: '1px solid #2D2048',
              borderRadius: 10,
              color: '#e2d9f3',
              padding: '6px 12px',
              fontSize: 14,
              fontFamily: 'var(--font-nunito)',
              cursor: 'pointer',
            }}
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 13, color: '#a78bfa' }}>
            {completedCount} alumnos completaron
          </span>

          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 50,
              padding: '4px 12px',
              ...(published
                ? {
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                  }
                : {
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    color: '#fbbf24',
                  }),
            }}
          >
            {published ? '● Publicado' : sections.length === 0 ? '○ Sin contenido' : '○ Listo para publicar'}
          </span>

          <button
            type="button"
            onClick={togglePublish}
            disabled={!published && sections.length === 0}
            style={{
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: 14,
              fontWeight: 800,
              fontFamily: 'var(--font-nunito)',
              cursor: (!published && sections.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!published && sections.length === 0) ? 0.4 : 1,
              ...(published
                ? {
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444',
                  }
                : {
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                  }),
            }}
          >
            {published ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* ─── STUDENT VIEW ─── */}
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        {themeChanging && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(15,10,30,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid rgba(124,58,237,0.2)',
              borderTop: '3px solid #7c3aed',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 14,
              color: '#a78bfa',
              fontWeight: 700,
              letterSpacing: 1,
            }}>
              Cargando temática...
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
        {/* Student top bar */}
        <div
          style={{
            position: 'sticky',
            top: 56,
            background: '#0f0a1e',
            borderBottom: '1px solid rgba(124,58,237,0.15)',
            padding: '18px 16px 14px',
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
            ⚡ +{sessionXp} XP
          </div>
        </div>

        {/* Tabs row */}
        <div
          style={{
            display: 'flex',
            padding: '0 16px',
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
                flex: 1,
                justifyContent: 'center',
                padding: '10px 0',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                background: 'none',
                fontFamily: 'var(--font-nunito)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'color 0.2s',
                color: activeTab === key ? '#e2d9f3' : '#a78bfa',
                borderBottom:
                  activeTab === key ? '2.5px solid #7c3aed' : '2.5px solid transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── TAB: GUÍA ─── */}
        <div style={{ display: activeTab === 'guia' ? 'block' : 'none', padding: 16 }}>
          {sections.length === 0 ? (
            <div
              style={{
                background: '#1a1035',
                border: '2px dashed rgba(124,58,237,0.3)',
                borderRadius: 20,
                padding: '40px 24px',
                textAlign: 'center',
                margin: '16px 0',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 16,
                  color: '#a78bfa',
                  marginBottom: 8,
                }}
              >
                Sin contenido para esta temática
              </div>
              <div style={{ fontSize: 15, color: '#a78bfa', marginBottom: 20 }}>
                Genera las secciones y preguntas de quiz con un solo clic
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  minHeight: 52,
                  padding: '0 32px',
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                }}
              >
                {generating ? '⏳ Generando...' : '✨ Generar contenido con Claude'}
              </button>
              {generating && (
                <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 12 }}>
                  Generando... esto toma unos segundos
                </div>
              )}
              {generateError && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10,
                  color: '#fca5a5',
                  fontSize: 14,
                  fontWeight: 600,
                }}>
                  {generateError}
                </div>
              )}
            </div>
          ) : (
            sections.map((section) => {
              const typeMeta = SECTION_TYPE_LABELS[section.type]
              return (
                <div key={section.id} style={{ position: 'relative' }}>
                  {/* Admin toolbar */}
                  <div style={ADMIN_TOOLBAR_STYLE}>
                    <button
                      type="button"
                      onClick={() => startEdit(section.id, section.content)}
                      style={TOOLBAR_BTN_STYLE}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(section.id)}
                      style={TOOLBAR_BTN_STYLE}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>

                  {editingId === section.id ? (
                    /* Edit mode */
                    <div
                      style={{
                        background: '#1a1035',
                        border: '2px solid #7c3aed',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                      }}
                    >
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: 120,
                          background: '#1C1033',
                          border: '1.5px solid #2D2048',
                          borderRadius: 10,
                          color: '#e2d9f3',
                          fontSize: 16,
                          lineHeight: 1.65,
                          padding: '10px 12px',
                          fontFamily: 'var(--font-nunito)',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 10,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid #2D2048',
                            color: '#a78bfa',
                            borderRadius: 10,
                            padding: '6px 14px',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-nunito)',
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSection(section.id)}
                          style={{
                            background: '#7c3aed',
                            border: 'none',
                            color: 'white',
                            borderRadius: 10,
                            padding: '6px 14px',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-nunito)',
                          }}
                        >
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Student card view */
                    <div
                      style={{
                        background: '#1a1035',
                        border: '1px solid rgba(124,58,237,0.2)',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          padding: '3px 9px',
                          borderRadius: 50,
                          marginBottom: 10,
                          border: `1px solid ${typeMeta.border}`,
                          background: typeMeta.bg,
                          color: typeMeta.color,
                        }}
                      >
                        {typeMeta.label}
                      </div>
                      <div
                        style={{ fontSize: 16, lineHeight: 1.65, color: '#e2d9f3' }}
                      >
                        {renderContent(section.content)}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          marginTop: 8,
                          gap: 6,
                          fontSize: 13,
                          color: '#a78bfa',
                          fontWeight: 700,
                        }}
                      >
                        Leíste esto{' '}
                        <span style={{ color: '#fbbf24' }}>+10 XP</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ─── TAB: QUIZ ─── */}
        <div style={{ display: activeTab === 'quiz' ? 'block' : 'none', padding: 16 }}>
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
            <>
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
                <div
                  style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600, marginTop: 4 }}
                >
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
                      border:
                        i < combo
                          ? '1px solid #fbbf24'
                          : '1px solid rgba(124,58,237,0.3)',
                      boxShadow:
                        i < combo ? '0 0 6px rgba(251,191,36,0.5)' : 'none',
                    }}
                  />
                ))}
                <span style={{ fontSize: 13, color: '#a78bfa' }}>
                  {combo >= 3 ? 'Combo x2 🔥' : combo >= 2 ? 'Combo x1.5 ⚡' : 'Combo'}
                </span>
              </div>

              {quizQuestions.map((question, index) => {
                const isAnswered = !!answers[question.id]
                const isLocked = index > 0 && !answers[quizQuestions[index - 1].id]
                const earnedXp = xpPerQuestion[question.id] ?? 0
                const comboWhenAnswered = comboAtAnswer[question.id] ?? 0
                const isCorrectAnswer = answers[question.id] === question.correct_answer

                return (
                  <div key={question.id} style={{ position: 'relative' }}>
                    {/* Admin toolbar */}
                    <div style={ADMIN_TOOLBAR_STYLE}>
                      <button
                        type="button"
                        onClick={() => startEditQuestion(question)}
                        style={TOOLBAR_BTN_STYLE}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(question.id)}
                        style={TOOLBAR_BTN_STYLE}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>

                    {editingQuestionId === question.id && editQuestionData ? (
                      /* Question edit form */
                      <div
                        style={{
                          background: '#1a1035',
                          border: '2px solid #7c3aed',
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ marginBottom: 10 }}>
                          <label
                            style={{
                              fontSize: 13,
                              color: '#a78bfa',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Pregunta
                          </label>
                          <textarea
                            value={editQuestionData.question}
                            onChange={(e) =>
                              setEditQuestionData((prev) =>
                                prev ? { ...prev, question: e.target.value } : prev
                              )
                            }
                            style={{
                              width: '100%',
                              minHeight: 72,
                              background: '#1C1033',
                              border: '1.5px solid #2D2048',
                              borderRadius: 10,
                              color: '#e2d9f3',
                              fontSize: 15,
                              padding: '8px 12px',
                              fontFamily: 'var(--font-nunito)',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {editQuestionData.options.map((opt, i) => (
                          <div key={opt.letter} style={{ marginBottom: 8 }}>
                            <label
                              style={{
                                fontSize: 13,
                                color: '#a78bfa',
                                fontWeight: 700,
                                display: 'block',
                                marginBottom: 4,
                              }}
                            >
                              Opción {opt.letter}
                            </label>
                            <input
                              value={opt.text}
                              onChange={(e) => {
                                const newOptions = editQuestionData.options.map((o, j) =>
                                  j === i ? { ...o, text: e.target.value } : o
                                )
                                setEditQuestionData((prev) =>
                                  prev ? { ...prev, options: newOptions } : prev
                                )
                              }}
                              style={{
                                width: '100%',
                                background: '#1C1033',
                                border: '1.5px solid #2D2048',
                                borderRadius: 10,
                                color: '#e2d9f3',
                                fontSize: 15,
                                padding: '8px 12px',
                                fontFamily: 'var(--font-nunito)',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        ))}

                        <div style={{ marginBottom: 10 }}>
                          <label
                            style={{
                              fontSize: 13,
                              color: '#a78bfa',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Respuesta correcta
                          </label>
                          <select
                            value={editQuestionData.correct_answer}
                            onChange={(e) =>
                              setEditQuestionData((prev) =>
                                prev ? { ...prev, correct_answer: e.target.value } : prev
                              )
                            }
                            style={{
                              background: '#1C1033',
                              border: '1.5px solid #2D2048',
                              borderRadius: 10,
                              color: '#e2d9f3',
                              padding: '8px 12px',
                              fontSize: 15,
                              fontFamily: 'var(--font-nunito)',
                              cursor: 'pointer',
                            }}
                          >
                            {editQuestionData.options.map((o) => (
                              <option key={o.letter} value={o.letter}>
                                {o.letter}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                          <label
                            style={{
                              fontSize: 13,
                              color: '#a78bfa',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Explicación
                          </label>
                          <textarea
                            value={editQuestionData.explanation}
                            onChange={(e) =>
                              setEditQuestionData((prev) =>
                                prev ? { ...prev, explanation: e.target.value } : prev
                              )
                            }
                            style={{
                              width: '100%',
                              minHeight: 72,
                              background: '#1C1033',
                              border: '1.5px solid #2D2048',
                              borderRadius: 10,
                              color: '#e2d9f3',
                              fontSize: 15,
                              padding: '8px 12px',
                              fontFamily: 'var(--font-nunito)',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionId(null)
                              setEditQuestionData(null)
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid #2D2048',
                              color: '#a78bfa',
                              borderRadius: 10,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-nunito)',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveQuestion(question.id)}
                            style={{
                              background: '#7c3aed',
                              border: 'none',
                              color: 'white',
                              borderRadius: 10,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-nunito)',
                            }}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Student question card */
                      <div
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
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* ─── TAB: RESUMEN ─── */}
        <div style={{ display: activeTab === 'resumen' ? 'block' : 'none', padding: 16 }}>
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

          <div>
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
              ✓ Listo por ahora
            </div>
            <div style={{ fontSize: 14, color: '#a78bfa' }}>Haz el Quiz para ganar XP</div>
            <button
              type="button"
              onClick={() => setActiveTab('quiz')}
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
                marginTop: 12,
              }}
            >
              IR AL QUIZ →
            </button>
          </div>
        </div>

        <div style={{ height: 80 }} />
      </div>

      {/* ─── FLOATING REGENERATE BUTTON (when content exists) ─── */}
      {sections.length > 0 && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 30,
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 50,
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 800,
            cursor: generating ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            fontFamily: 'var(--font-nunito)',
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? '⏳ Generando...' : '🔄 Regenerar todo'}
        </button>
      )}
    </div>
  )
}
