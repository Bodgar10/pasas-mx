'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Topic {
  id: string
  name: string
  slug: string
  icon: string | null
  difficulty: number
  xp_reward: number
}

interface TopicProgress {
  topic_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  best_score: number
}

interface Props {
  subject: { id: string; name: string; slug: string; icon: string | null }
  weakTopics: Topic[]
  strongTopics: { id: string; name: string }[]
  topicProgress: TopicProgress[]
  subjectXp: number
  themeName: string
}

const TOPIC_ICONS: Record<string, string> = {
  explanation: '📘', analogy: '🎭', example: '🔢', key_fact: '📌', tip: '💡',
}

export default function PersonalizedSubjectClient({
  subject,
  weakTopics,
  strongTopics,
  topicProgress,
  subjectXp,
  themeName,
}: Props) {
  const router = useRouter()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const completedCount = topicProgress.filter(p => p.status === 'completed').length
  const progressPercent = weakTopics.length > 0 ? Math.round((completedCount / weakTopics.length) * 100) : 0

  function getTopicProgress(topicId: string): TopicProgress | null {
    return topicProgress.find(p => p.topic_id === topicId) ?? null
  }

  return (
    <div style={{
      maxWidth: isDesktop ? 860 : 440,
      margin: '0 auto',
      fontFamily: 'var(--font-nunito)',
      color: '#e2d9f3',
      minHeight: '100vh',
      padding: isDesktop ? '32px 32px 80px' : '0 0 80px',
    }}>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, background: '#0f0a1e',
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        padding: isDesktop ? '20px 32px 16px' : '18px 16px 14px',
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 10,
      }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          style={{
            width: 36, height: 36, borderRadius: 10, background: '#1a1035',
            border: '1px solid #2D2048', cursor: 'pointer', color: '#a78bfa',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: 2 }}>
            ✨ Tu plan personalizado
          </div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subject.name}
          </div>
        </div>
        <div style={{
          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 50, padding: '4px 10px', fontSize: 12, fontWeight: 800, color: '#a78bfa', flexShrink: 0,
        }}>
          🎮 {themeName}
        </div>
      </div>

      <div style={{ padding: isDesktop ? '24px 32px' : '16px' }}>

        {/* Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(236,72,153,0.08))',
          border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16,
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3', marginBottom: 4 }}>
            ✨ Generado solo para ti
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa', lineHeight: 1.6 }}>
            Basado en tu diagnóstico, identificamos <span style={{ color: '#ec4899', fontWeight: 800 }}>{weakTopics.length} temas</span> donde necesitas refuerzo. Los otros {strongTopics.length} ya los dominas.
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          background: '#1a1035', border: '1px solid #2D2048',
          borderRadius: 14, padding: '12px 14px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>Tu progreso</span>
            <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 800 }}>{completedCount} / {weakTopics.length} temas completados</span>
          </div>
          <div style={{ width: '100%', height: 6, background: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${progressPercent}%`, height: '100%',
              background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
              borderRadius: 99, transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* Weak topics label */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Temas a estudiar
        </div>

        {/* Weak topics list */}
        <div style={{
          display: isDesktop ? 'grid' : 'flex',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined,
          flexDirection: isDesktop ? undefined : 'column',
          gap: 10,
          marginBottom: 20,
        }}>
          {weakTopics.length === 0 ? (
            <div style={{
              background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 14, padding: '24px 16px', textAlign: 'center', color: '#a78bfa', fontSize: 14,
            }}>
              Tu plan personalizado está siendo generado. Vuelve en unos minutos.
            </div>
          ) : weakTopics.map((topic) => {
            const progress = getTopicProgress(topic.id)
            const isCompleted = progress?.status === 'completed'
            const isInProgress = progress?.status === 'in_progress'

            return (
              <div
                key={topic.id}
                onClick={() => router.push(`/guia/personalizado/${subject.slug}/${topic.slug}`)}
                style={{
                  background: '#1a1035',
                  border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(236,72,153,0.25)'}`,
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(124,58,237,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#1a1035' }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: isCompleted ? 'rgba(16,185,129,0.1)' : 'rgba(236,72,153,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                }}>
                  {isCompleted ? '✅' : (topic.icon ?? '📚')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#e2d9f3', marginBottom: 2, lineHeight: 1.3 }}>
                    {topic.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#a78bfa' }}>
                    {isCompleted ? `✓ Completado · ${progress?.best_score ?? 0}%` : isInProgress ? 'En progreso' : '5 secciones · 5 preguntas'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {!isCompleted && (
                    <div style={{
                      background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)',
                      borderRadius: 50, padding: '2px 8px', fontSize: 11, fontWeight: 800, color: '#ec4899',
                    }}>Para ti</div>
                  )}
                  <div style={{ fontSize: 13, color: '#a78bfa' }}>→</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Strong topics */}
        {strongTopics.length > 0 && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 14,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', marginBottom: 6 }}>
              ✓ Ya dominas {strongTopics.length} temas
            </div>
            <div style={{ fontSize: 13, color: '#6ee7b7', lineHeight: 1.6 }}>
              {strongTopics.slice(0, 5).map(t => t.name).join(', ')}{strongTopics.length > 5 ? ` y ${strongTopics.length - 5} más` : ''}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
