'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Subject {
  id: string
  name: string
  slug: string
  education_level: string
}

interface Topic {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  grade: number
  display_order: number
  difficulty: number
  xp_reward: number
}

interface TopicProgress {
  topic_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  best_score: number
  attempts: number
}

interface Profile {
  grade: number
  education_level: string
}

interface Props {
  subject: Subject
  topics: Topic[]
  topicProgress: TopicProgress[]
  profile: Profile
  subjectXp: number
}

const GRADE_LABELS: Record<number, string> = { 1: '1°', 2: '2°', 3: '3°' }
const LEVEL_LABELS: Record<string, string> = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria',
}

function getProgress(topicId: string, topicProgress: TopicProgress[]): TopicProgress | null {
  return topicProgress.find((p) => p.topic_id === topicId) ?? null
}

function getStatus(
  topicId: string,
  topicProgress: TopicProgress[]
): 'not_started' | 'in_progress' | 'completed' {
  return getProgress(topicId, topicProgress)?.status ?? 'not_started'
}

export default function SubjectClient({ subject, topics, topicProgress, profile, subjectXp }: Props) {
  const router = useRouter()
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestTopicName, setRequestTopicName] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestSending, setRequestSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  async function handleSendRequest() {
    if (!requestTopicName.trim()) return
    setRequestSending(true)
    try {
      const res = await fetch('/api/topic-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: subject.id,
          subject_name: subject.name,
          grade: profile.grade,
          education_level: profile.education_level,
          topic_name: requestTopicName.trim(),
          description: requestDescription.trim() || null,
        }),
      })
      if (res.ok) {
        setRequestSent(true)
        setRequestTopicName('')
        setRequestDescription('')
        setTimeout(() => {
          setShowRequestModal(false)
          setRequestSent(false)
        }, 2000)
      }
    } catch {}
    setRequestSending(false)
  }

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const completedTopics = topics.filter((t) => getStatus(t.id, topicProgress) === 'completed')
  const inProgressTopics = topics.filter((t) => getStatus(t.id, topicProgress) === 'in_progress')
  const pendingTopics = topics.filter((t) => getStatus(t.id, topicProgress) === 'not_started')
  const totalXpEarned = subjectXp
  const overallPercent =
    topics.length > 0 ? Math.round((completedTopics.length / topics.length) * 100) : 0

  function renderTopicCard(topic: Topic) {
    const status = getStatus(topic.id, topicProgress)
    const progress = getProgress(topic.id, topicProgress)
    const isCompleted = status === 'completed'
    const isHovered = hoveredTopic === topic.id

    const cardBorder = isCompleted
      ? 'rgba(16,185,129,0.3)'
      : 'rgba(124,58,237,0.2)'
    const hoverShadow = isCompleted
      ? '0 6px 24px rgba(16,185,129,0.15)'
      : '0 6px 24px rgba(124,58,237,0.2)'

    const iconBg = isCompleted
      ? 'rgba(16,185,129,0.1)'
      : 'rgba(124,58,237,0.12)'
    const iconBorder = isCompleted
      ? '1px solid rgba(16,185,129,0.3)'
      : '1px solid rgba(124,58,237,0.2)'

    let miniBarFill = '0%'
    let miniBarBg = 'transparent'
    if (status === 'completed') {
      miniBarFill = '100%'
      miniBarBg = '#10b981'
    } else if (status === 'in_progress' && progress) {
      miniBarFill = `${progress.best_score}%`
      miniBarBg = 'linear-gradient(90deg, #7c3aed, #ec4899)'
    }

    let pctColor = 'rgba(167,139,250,0.4)'
    let pctText = '0%'
    if (status === 'completed') {
      pctColor = '#10b981'
      pctText = '100%'
    } else if (status === 'in_progress' && progress) {
      pctColor = '#a78bfa'
      pctText = `${progress.best_score}%`
    }

    let badgeBg = 'rgba(255,255,255,0.05)'
    let badgeColor = 'rgba(167,139,250,0.5)'
    let badgeBorder = 'rgba(255,255,255,0.08)'
    let badgeText = 'Nuevo'
    if (status === 'completed') {
      badgeBg = 'rgba(16,185,129,0.12)'
      badgeColor = '#10b981'
      badgeBorder = 'rgba(16,185,129,0.3)'
      badgeText = '✓ Listo'
    } else if (status === 'in_progress') {
      badgeBg = 'rgba(124,58,237,0.15)'
      badgeColor = '#c4b5fd'
      badgeBorder = 'rgba(124,58,237,0.3)'
      badgeText = 'En progreso'
    }

    let diffBg = 'rgba(16,185,129,0.1)'
    let diffColor = '#10b981'
    let diffText = '🟢 Fácil'
    if (topic.difficulty === 2) {
      diffBg = 'rgba(251,191,36,0.1)'
      diffColor = '#fbbf24'
      diffText = '⚡ Media'
    } else if (topic.difficulty === 3) {
      diffBg = 'rgba(236,72,153,0.12)'
      diffColor = '#ec4899'
      diffText = '🔴 Difícil'
    }

    return (
      <div
        key={topic.id}
        onClick={() => router.push(`/guia/${subject.slug}/${topic.slug}`)}
        onMouseEnter={() => setHoveredTopic(topic.id)}
        onMouseLeave={() => setHoveredTopic(null)}
        style={{
          background: '#1a1035',
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: isDesktop ? 0 : 10,
          cursor: 'pointer',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: isHovered ? 'translateY(-2px)' : 'none',
          boxShadow: isHovered ? hoverShadow : 'none',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            background: iconBg,
            border: iconBorder,
          }}
        >
          {topic.icon ?? '📚'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#e2d9f3', marginBottom: 3 }}>
            {topic.name}
          </div>
          {topic.description && (
            <div
              style={{
                fontSize: 14,
                color: '#a78bfa',
                lineHeight: 1.45,
                marginBottom: 8,
              }}
            >
              {topic.description}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 5,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 50,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: miniBarFill,
                  height: '100%',
                  background: miniBarBg,
                  borderRadius: 50,
                }}
              />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pctColor }}>{pctText}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 50,
                padding: '2px 8px',
                border: `1px solid ${badgeBorder}`,
                background: badgeBg,
                color: badgeColor,
              }}
            >
              {badgeText}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 50,
                padding: '2px 8px',
                marginLeft: 'auto',
                background: diffBg,
                color: diffColor,
              }}
            >
              {diffText}
            </span>
          </div>
        </div>
      </div>
    )
  }

  function renderSection(label: string, sectionTopics: Topic[]) {
    if (sectionTopics.length === 0) return null
    return (
      <div key={label}>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 12,
            color: '#a78bfa',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 10,
            marginTop: 16,
          }}
        >
          {label}
        </div>
        <div style={{
          display: isDesktop ? 'grid' : 'block',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined,
          gap: isDesktop ? 12 : undefined,
        }}>
          {sectionTopics.map(renderTopicCard)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: isDesktop ? 960 : 440, margin: '0 auto', minHeight: '100vh', padding: isDesktop ? '0 0 40px' : undefined, fontFamily: 'var(--font-nunito)', color: '#e2d9f3' }}>
      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: '#0f0a1e',
          borderBottom: '1px solid rgba(124,58,237,0.15)',
          padding: isDesktop ? '20px 32px 16px' : '18px 16px 14px',
          maxWidth: isDesktop ? 960 : 440,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => { router.back(); setTimeout(() => router.refresh(), 100) }}
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

        <div style={{ flex: 1 }}>
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
            {LEVEL_LABELS[profile.education_level] ?? profile.education_level}{' '}
            {GRADE_LABELS[profile.grade] ?? ''}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 17,
              fontWeight: 900,
              color: '#e2d9f3',
            }}
          >
            {subject.name}
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
          ⚡ {totalXpEarned} XP
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, padding: isDesktop ? '16px 32px 8px' : '14px 16px 6px' }}>
        {[
          { icon: '✅', value: completedTopics.length, label: 'Completados' },
          { icon: '🔥', value: inProgressTopics.length, label: 'En progreso' },
          { icon: '🔒', value: pendingTopics.length, label: 'Pendientes' },
        ].map(({ icon, value, label }) => (
          <div
            key={label}
            style={{
              flex: 1,
              minWidth: isDesktop ? 180 : undefined,
              background: '#1a1035',
              border: '1px solid #2D2048',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#e2d9f3' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div
        style={{
          background: '#1a1035',
          border: '1px solid #2D2048',
          borderRadius: 14,
          padding: '14px 16px',
          margin: isDesktop ? '0 32px 24px' : '0 16px 18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 14,
              color: '#a78bfa',
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontWeight: 800,
            }}
          >
            Progreso general
          </span>
          <span
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 14,
              color: '#fbbf24',
              fontWeight: 700,
            }}
          >
            {overallPercent}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${overallPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
              borderRadius: 50,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      {/* Topics sections */}
      <div style={{ padding: isDesktop ? '0 32px' : '0 16px' }}>
        {topics.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: '#a78bfa',
              fontSize: 16,
            }}
          >
            No hay temas disponibles para este grado aún.
          </div>
        ) : (
          <>
            {renderSection('📖 En progreso', inProgressTopics)}
            {renderSection('✅ Completados', completedTopics)}
            {renderSection('🔒 Pendientes', pendingTopics)}
          </>
        )}
      </div>

      {/* Banner: solicitar tema */}
      <div style={{
        margin: isDesktop ? '24px 32px 0' : '20px 16px 0',
        background: 'rgba(124,58,237,0.06)',
        border: '1px dashed rgba(124,58,237,0.3)',
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#e2d9f3', marginBottom: 2 }}>
            ¿No encuentras el tema que buscas?
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa' }}>
            Dinos qué tema necesitas y lo agregamos pronto.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowRequestModal(true)}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'var(--font-nunito)',
            whiteSpace: 'nowrap',
          }}
        >
          📩 Solicitar tema
        </button>
      </div>

      <div style={{ height: 32 }} />

      {/* Modal solicitar tema */}
      {showRequestModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.85)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 16,
        }}
          onClick={() => setShowRequestModal(false)}
        >
          <div style={{
            background: '#1a1035',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 20, padding: 24,
            width: '100%', maxWidth: 440,
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {requestSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#10b981' }}>
                  ¡Solicitud enviada!
                </div>
                <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 8 }}>
                  Lo revisamos y lo agregamos pronto.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>
                  📩 Solicitar tema
                </div>
                <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
                  Para <strong style={{ color: '#e2d9f3' }}>{subject.name}</strong>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                      Nombre del tema *
                    </label>
                    <input
                      value={requestTopicName}
                      onChange={(e) => setRequestTopicName(e.target.value)}
                      placeholder="ej. Teorema de Pitágoras"
                      style={{
                        width: '100%', background: '#1C1033',
                        border: '1.5px solid #2D2048', borderRadius: 10,
                        color: '#e2d9f3', fontSize: 15, padding: '10px 12px',
                        fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                      ¿Para qué lo necesitas? (opcional)
                    </label>
                    <textarea
                      value={requestDescription}
                      onChange={(e) => setRequestDescription(e.target.value)}
                      placeholder="ej. Lo vimos en clase y no está en la app"
                      rows={3}
                      style={{
                        width: '100%', background: '#1C1033',
                        border: '1.5px solid #2D2048', borderRadius: 10,
                        color: '#e2d9f3', fontSize: 15, padding: '10px 12px',
                        fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                        resize: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048',
                      color: '#a78bfa', borderRadius: 10, padding: '10px 20px',
                      fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      fontFamily: 'var(--font-nunito)',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSendRequest}
                    disabled={requestSending || !requestTopicName.trim()}
                    style={{
                      background: requestTopicName.trim() ? 'linear-gradient(135deg, #7c3aed, #ec4899)' : 'rgba(124,58,237,0.3)',
                      color: 'white', borderRadius: 12, padding: '10px 20px',
                      fontWeight: 800, border: 'none',
                      cursor: (requestSending || !requestTopicName.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: 14, fontFamily: 'var(--font-nunito)',
                      opacity: requestSending ? 0.7 : 1,
                    }}
                  >
                    {requestSending ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
