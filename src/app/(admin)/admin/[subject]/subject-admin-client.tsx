'use client'

import { useRouter } from 'next/navigation'

interface Topic {
  id: string
  name: string
  slug: string
  icon: string | null
  difficulty: number
  published: boolean
  display_order: number
}

interface Theme {
  id: string
  name: string
}

interface SectionCount {
  topic_id: string
  theme_id: string | null
  count: number
}

interface Props {
  subject: { id: string; name: string; slug: string }
  topics: Topic[]
  themes: Theme[]
  sectionCounts: SectionCount[]
  grade: number
  level: string
}

function getSectionCount(
  topicId: string,
  themeId: string,
  sectionCounts: SectionCount[]
): number {
  return sectionCounts.find((s) => s.topic_id === topicId && s.theme_id === themeId)?.count ?? 0
}

export default function SubjectAdminClient({
  subject,
  topics,
  themes,
  sectionCounts,
  grade,
  level,
}: Props) {
  const router = useRouter()

  return (
    <div
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: 'var(--font-nunito)',
        color: '#e2d9f3',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => router.push('/admin')}
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
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 20,
            fontWeight: 900,
            color: '#e2d9f3',
          }}
        >
          {subject.name}
        </div>
        <div
          style={{
            background: 'rgba(6,182,212,0.1)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 50,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 800,
            color: '#06b6d4',
            flexShrink: 0,
          }}
        >
          Grado {grade}°
        </div>
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 28 }}>
        Selecciona un tema para gestionar su contenido por temática
      </div>

      {/* Topics table */}
      {topics.length === 0 ? (
        <div
          style={{
            background: '#1a1035',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 16,
            padding: '32px 16px',
            textAlign: 'center',
            color: '#a78bfa',
            fontSize: 14,
          }}
        >
          No hay temas para este grado.
        </div>
      ) : (
        topics.map((topic) => (
          <div
            key={topic.id}
            style={{
              background: '#1a1035',
              border: '1px solid rgba(124,58,237,0.15)',
              borderRadius: 16,
              padding: '14px 18px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Left: icon + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(124,58,237,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {topic.icon ?? '📚'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3' }}>
                {topic.name}
              </div>
            </div>

            {/* Middle: theme pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {themes.map((theme) => {
                const count = getSectionCount(topic.id, theme.id, sectionCounts)
                const hasContent = count > 0
                return (
                  <span
                    key={theme.id}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 50,
                      padding: '3px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: hasContent
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(255,255,255,0.04)',
                      border: hasContent
                        ? '1px solid rgba(16,185,129,0.3)'
                        : '1px solid rgba(124,58,237,0.15)',
                      color: hasContent ? '#10b981' : 'rgba(167,139,250,0.5)',
                    }}
                  >
                    {theme.name}
                    {hasContent ? ` ✓ ${count}` : ' —'}
                  </span>
                )
              })}
            </div>

            {/* Right: manage button */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/admin/${subject.slug}/${topic.slug}?grade=${grade}&level=${level}`
                )
              }
              style={{
                background: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'var(--font-nunito)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Gestionar →
            </button>
          </div>
        ))
      )}
    </div>
  )
}
