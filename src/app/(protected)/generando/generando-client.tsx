'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trackPersonalizedPlanGenerated } from '@/components/posthog-events'

interface Props {
  userId: string
  subject: { id: string; name: string; slug: string }
  theme: { id: string; name: string; icon: string }
  weakTopicIds: string[]
  weakTopicNames: string[]
}

type StepStatus = 'pending' | 'active' | 'done'

interface Step {
  id: string
  label: string
  sublabel: string
  status: StepStatus
}

export default function GenerandoClient({ userId, subject, theme, weakTopicIds, weakTopicNames }: Props) {
  const router = useRouter()
  const hasFetched = useRef(false)

  const [steps, setSteps] = useState<Step[]>([
    { id: 'analyzing', label: 'Analizando tu diagnóstico', sublabel: `${weakTopicIds.length} temas identificados`, status: 'done' },
    { id: 'generating', label: `Generando guías con ${theme.name}`, sublabel: 'Creando contenido personalizado...', status: 'active' },
    { id: 'quiz', label: 'Creando quizzes personalizados', sublabel: '5 preguntas por tema', status: 'pending' },
    { id: 'saving', label: 'Guardando tu plan', sublabel: 'Listo para estudiar', status: 'pending' },
  ])

  const [currentTopic, setCurrentTopic] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    generatePlan()
  }, [])

  function updateStep(id: string, status: StepStatus, sublabel?: string) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, ...(sublabel ? { sublabel } : {}) } : s))
  }

  async function generatePlan() {
    try {
      for (let i = 0; i < weakTopicIds.length; i++) {
        const topicId = weakTopicIds[i]
        const topicName = weakTopicNames[i] ?? `Tema ${i + 1}`

        updateStep('generating', 'active', `Tema ${i + 1} de ${weakTopicIds.length} — ${topicName}`)
        setCurrentTopic(i)

        const res = await fetch('/api/personalized/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            subjectId: subject.id,
            themeId: theme.id,
            weakTopicIds,
            topicId,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? `Error generando ${topicName}`)
        }
      }

      updateStep('generating', 'done')
      trackPersonalizedPlanGenerated(subject.name, weakTopicIds.length, theme.name)
      updateStep('quiz', 'active', 'Guardando preguntas...')
      await new Promise(r => setTimeout(r, 600))

      updateStep('quiz', 'done')
      updateStep('saving', 'active', 'Finalizando...')
      await new Promise(r => setTimeout(r, 500))

      updateStep('saving', 'done')
      await new Promise(r => setTimeout(r, 800))

      router.push(`/guia/personalizado/${subject.slug}`)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      const { trackError } = await import('@/components/posthog-events')
      trackError('personalized_plan_generation', errorMessage, `subject:${subject.name} topics:${weakTopicIds.length}`)
    }
  }

  const progressPercent = steps.filter(s => s.status === 'done').length / steps.length * 100

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0a1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: 'var(--font-nunito)',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-300px 0} 100%{background-position:300px 0} }
        .spin { animation: spin 1s linear infinite; }
        .pulse-anim { animation: pulse 1.5s ease-in-out infinite; }
        .fade-in { animation: fadeInUp 0.4s ease forwards; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: '#a78bfa', margin: 0 }}>
            PASAS.MX
          </p>
        </div>

        <div style={{
          background: '#1a1035',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 20,
          padding: '28px 20px',
          marginBottom: 16,
          textAlign: 'center',
        }}>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              border: '2px solid rgba(124,58,237,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="spin" style={{
                width: 52, height: 52, borderRadius: '50%',
                border: '3px solid rgba(124,58,237,0.15)',
                borderTop: '3px solid #7c3aed',
              }} />
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 17, fontWeight: 900, color: '#e2d9f3', marginBottom: 8 }}>
            Creando tu plan personalizado
          </div>
          <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 24, lineHeight: 1.6 }}>
            Analizamos tu diagnóstico y generamos<br />contenido único para ti{dots}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, textAlign: 'left' }}>
            {steps.map((step) => (
              <div key={step.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: step.status === 'done'
                  ? 'rgba(16,185,129,0.08)'
                  : step.status === 'active'
                  ? 'rgba(124,58,237,0.08)'
                  : 'rgba(255,255,255,0.02)',
                border: step.status === 'done'
                  ? '1px solid rgba(16,185,129,0.2)'
                  : step.status === 'active'
                  ? '1px solid rgba(124,58,237,0.25)'
                  : '1px solid rgba(124,58,237,0.08)',
                borderRadius: 12,
                opacity: step.status === 'pending' ? 0.5 : 1,
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.status === 'done'
                    ? 'rgba(16,185,129,0.2)'
                    : step.status === 'active'
                    ? 'rgba(124,58,237,0.2)'
                    : 'rgba(255,255,255,0.05)',
                }}>
                  {step.status === 'done' ? (
                    <span style={{ fontSize: 14, color: '#10b981' }}>✓</span>
                  ) : step.status === 'active' ? (
                    <div className="spin" style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid rgba(124,58,237,0.2)',
                      borderTop: '2px solid #7c3aed',
                    }} />
                  ) : (
                    <span style={{ fontSize: 12, color: '#4B3D6E' }}>⏳</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 800,
                    color: step.status === 'done' ? '#10b981' : step.status === 'active' ? '#e2d9f3' : '#4B3D6E',
                  }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontSize: 12, marginTop: 2,
                    color: step.status === 'done' ? '#6ee7b7' : step.status === 'active' ? '#a78bfa' : '#2D2048',
                  }}>
                    {step.sublabel}{step.status === 'active' ? dots : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#0f0a1e', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>Progreso</span>
              <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 800 }}>
                {steps.filter(s => s.status === 'done').length} / {steps.length} pasos
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                width: `${progressPercent}%`, height: '100%',
                background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                borderRadius: 99, transition: 'width 0.6s ease',
              }} />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 16, padding: '12px 14px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, color: '#fca5a5', fontSize: 13, fontWeight: 600,
            }}>
              {error}
              <button
                type="button"
                onClick={() => { setError(null); hasFetched.current = false; generatePlan() }}
                style={{
                  display: 'block', marginTop: 10, width: '100%',
                  background: '#7c3aed', border: 'none', borderRadius: 8,
                  padding: '8px', color: 'white', fontSize: 13,
                  fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)',
                }}
              >
                Reintentar
              </button>
            </div>
          )}

          <div style={{ fontSize: 12, color: '#4B3D6E', marginTop: 16 }}>
            Esto puede tomar 1-2 minutos. No cierres esta ventana.
          </div>
        </div>

        <div style={{
          background: '#1a1035', border: '1px solid rgba(124,58,237,0.15)',
          borderRadius: 16, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Tu plan incluirá
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{theme.icon}</span>
              <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 600 }}>Guías con temática {theme.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>📚</span>
              <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 600 }}>{weakTopicIds.length} temas · 5 secciones cada uno</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 600 }}>{weakTopicIds.length * 5} preguntas de quiz personalizadas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 600 }}>Solo lo que necesitas estudiar</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
