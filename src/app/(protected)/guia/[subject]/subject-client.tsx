'use client'

import { useState } from 'react'
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

export default function SubjectClient({ subject, topics, topicProgress, profile }: Props) {
  const router = useRouter()
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null)

  const completedTopics = topics.filter((t) => getStatus(t.id, topicProgress) === 'completed')
  const inProgressTopics = topics.filter((t) => getStatus(t.id, topicProgress) === 'in_progress')
  const pendingTopics = topics.filter((t) => getStatus(t.id, topicProgress) === 'not_started')
  const totalXpEarned = completedTopics.reduce((sum, t) => sum + t.xp_reward, 0)
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
          marginBottom: 10,
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
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3', marginBottom: 3 }}>
            {topic.name}
          </div>
          {topic.description && (
            <div
              style={{
                fontSize: 12,
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
            <span style={{ fontSize: 11, fontWeight: 800, color: pctColor }}>{pctText}</span>
            <span
              style={{
                fontSize: 10,
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
                fontSize: 10,
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
            fontSize: 10,
            color: '#a78bfa',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 10,
            marginTop: 16,
          }}
        >
          {label}
        </div>
        {sectionTopics.map(renderTopicCard)}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', fontFamily: 'var(--font-nunito)', color: '#e2d9f3' }}>
      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
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
          onClick={() => router.push('/dashboard')}
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
              fontSize: 10,
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
              fontSize: 15,
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
            fontSize: 11,
            fontWeight: 800,
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          ⚡ {totalXpEarned} XP
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px 6px' }}>
        {[
          { icon: '✅', value: completedTopics.length, label: 'Completados' },
          { icon: '🔥', value: inProgressTopics.length, label: 'En progreso' },
          { icon: '🔒', value: pendingTopics.length, label: 'Pendientes' },
        ].map(({ icon, value, label }) => (
          <div
            key={label}
            style={{
              flex: 1,
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
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>{label}</div>
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
          margin: '0 16px 18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 12,
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
              fontSize: 12,
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
      <div style={{ padding: '0 16px' }}>
        {topics.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: '#a78bfa',
              fontSize: 14,
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

      <div style={{ height: 32 }} />
    </div>
  )
}
