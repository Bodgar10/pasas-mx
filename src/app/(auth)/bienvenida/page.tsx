'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PLAN_DISPLAY } from '@/lib/payments/config'

const DURATION_LABELS: Record<string, string> = {
  monthly: 'mensual',
  semestral: 'semestral',
  annual: 'anual',
}

const DURATION_CYCLE: Record<string, 'mensual' | 'semestral' | 'anual'> = {
  monthly: 'mensual',
  semestral: 'semestral',
  annual: 'anual',
}

function Confetti() {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string; delay: number; duration: number }[]>([])

  useEffect(() => {
    const colors = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#fbbf24']
    const p = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
    }))
    setParticles(p)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -10,
            width: 8,
            height: 8,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

function BienvenidaContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const plan = searchParams.get('plan') ?? 'estandar_v2'
  const duration = searchParams.get('duration') ?? 'monthly'

  const planKey = plan as keyof typeof PLAN_DISPLAY
  const cycleKey = DURATION_CYCLE[duration] ?? 'mensual'
  const planInfo = PLAN_DISPLAY[planKey] ?? PLAN_DISPLAY.estandar_v2
  const pricing = planInfo.prices[cycleKey]
  const durationLabel = DURATION_LABELS[duration] ?? 'mensual'
  const planLabel = planInfo.label

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), 100)
    return () => clearTimeout(timer)
  }, [])

  async function handleActivar() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, duration }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        router.push('/planes')
      }
    } catch {
      router.push('/planes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showConfetti && <Confetti />}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'var(--font-nunito)',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#1a1035',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 20,
          padding: '40px 32px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Emoji celebración */}
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>

          {/* Título */}
          <h1 style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 22,
            fontWeight: 900,
            color: '#e2d9f3',
            margin: '0 0 12px',
            lineHeight: 1.3,
          }}>
            ¡Tu cuenta está lista!
          </h1>

          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 28px', lineHeight: 1.6 }}>
            Verificaste tu correo. Ahora activa tu prueba gratis y empieza a estudiar hoy.
          </p>

          {/* Card del plan elegido */}
          <div style={{
            background: 'rgba(124,58,237,0.08)',
            border: '1.5px solid rgba(124,58,237,0.3)',
            borderRadius: 16,
            padding: '20px',
            marginBottom: 28,
            textAlign: 'left',
          }}>
            <p style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
              Tu plan elegido
            </p>
            <p style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 16,
              fontWeight: 900,
              color: '#e2d9f3',
              margin: '0 0 4px',
            }}>
              {planLabel} · {durationLabel}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 28,
                fontWeight: 900,
                color: '#e2d9f3',
              }}>
                ${pricing.perMonth}
              </span>
              <span style={{ fontSize: 14, color: '#a78bfa' }}>/mes</span>
            </div>
            {cycleKey !== 'mensual' && (
              <p style={{ fontSize: 13, color: '#a78bfa', margin: 0 }}>
                Un solo pago de <strong style={{ color: '#e2d9f3' }}>${pricing.amount}</strong> por {cycleKey === 'semestral' ? '6 meses' : '12 meses'}
              </p>
            )}
          </div>

          {/* Info trial */}
          <div style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, margin: '0 0 4px' }}>
              🎯 7 días gratis incluidos
            </p>
            <p style={{ fontSize: 12, color: '#fbbf24', opacity: 0.8, margin: 0, lineHeight: 1.5 }}>
              Tu tarjeta se guarda hoy pero no se cobra hasta el día 8. Cancela cuando quieras antes de eso y no pagas nada.
            </p>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleActivar}
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 56,
              background: loading ? '#2D2048' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
              border: 'none',
              borderRadius: 14,
              fontFamily: 'var(--font-nunito)',
              fontSize: 17,
              fontWeight: 900,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 32px rgba(124,58,237,0.4)',
              transition: 'all 0.15s ease',
              marginBottom: 12,
            }}
          >
            {loading ? 'Preparando tu plan...' : 'Activar mis 7 días gratis →'}
          </button>

          <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            Sin contrato · Cancela cuando quieras · Sin cobro hasta el día 8
          </p>

          {/* Link cambiar plan */}
          <button
            type="button"
            onClick={() => router.push('/planes')}
            style={{
              background: 'none',
              border: 'none',
              color: '#a78bfa',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 16,
              textDecoration: 'underline',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            Cambiar de plan
          </button>
        </div>
      </div>
    </>
  )
}

export default function BienvenidaPage() {
  return (
    <Suspense>
      <BienvenidaContent />
    </Suspense>
  )
}
