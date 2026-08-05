'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackCheckoutStarted } from '@/components/posthog-events'
import { BillingCycleToggle, type BillingCycle } from '@/components/planes/BillingCycleToggle'
import { PLAN_DISPLAY as PLANS } from '@/lib/payments/config'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

type PlanKey = keyof typeof PLANS

// Mapeo de BillingCycle a duration key del checkout
const CYCLE_TO_DURATION: Record<BillingCycle, string> = {
  mensual:   'monthly',
  semestral: 'semestral',
  anual:     'annual',
}

function PlanesContent() {
  const searchParams = useSearchParams()
  const [deviceHadTrial, setDeviceHadTrial] = useState(false)
  // Con el flag apagado, ?plan=personalizado se ignora: un enlace viejo
  // o compartido no debe poder abrir un plan que no está a la venta.
  const [activePlan, setActivePlan] = useState<PlanKey>(
    FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && searchParams.get('plan') === 'personalizado'
      ? 'personalizado_v2'
      : 'estandar_v2'
  )
  const [cycle, setCycle] = useState<BillingCycle>('semestral')
  const [loadingCheckout, setLoadingCheckout] = useState(false)

  useEffect(() => {
    setDeviceHadTrial(localStorage.getItem('pasas_trial_used') === 'true')
  }, [])

  const plan = PLANS[activePlan]
  const pricing = plan.prices[cycle]

  async function handleCTA() {
    setLoadingCheckout(true)
    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.is_anonymous) {
        sessionStorage.setItem('pasas_pending_plan', activePlan)
        sessionStorage.setItem('pasas_pending_duration', CYCLE_TO_DURATION[cycle])
        window.location.href = '/registro'
        return
      }

      localStorage.setItem('pasas_trial_used', 'true')
      trackCheckoutStarted(activePlan, CYCLE_TO_DURATION[cycle])

      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: activePlan,
          duration: CYCLE_TO_DURATION[cycle],
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error al iniciar el pago. Intenta de nuevo.')
      }
    } catch {
      alert('Error al iniciar el pago. Intenta de nuevo.')
    } finally {
      setLoadingCheckout(false)
    }
  }

  const isPersonalizado =
    FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && searchParams.get('plan') === 'personalizado'

  return (
    <div style={{ minHeight: '100vh', color: '#e2d9f3', fontFamily: 'var(--font-nunito)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .page-inner {
          max-width: 390px;
          margin: 0 auto;
          padding: 20px 16px 60px;
        }
        @media (min-width: 768px) {
          .page-inner { max-width: 560px; padding: 60px 40px; }
        }
        .title-text { font-size: 26px; }
        @media (min-width: 768px) { .title-text { font-size: 36px; } }
        .disclaimer-block { margin-top: 24px; }
        @media (min-width: 768px) { .disclaimer-block { margin-top: 32px; } }
      `}} />

      <div className="page-inner">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 14, fontWeight: 700,
            letterSpacing: '0.2em', color: '#a78bfa',
            margin: '0 0 12px',
          }}>
            PASAS.MX
          </p>
          <h1 className="title-text" style={{
            fontFamily: 'var(--font-orbitron)',
            fontWeight: 900, color: '#e2d9f3',
            margin: '0 0 8px', lineHeight: 1.2,
          }}>
            Elige tu plan
          </h1>
          <p style={{ fontSize: 16, color: '#a78bfa', margin: '0 0 24px', lineHeight: 1.6 }}>
            {deviceHadTrial
              ? 'Sin contrato. Cancela cuando quieras.'
              : '7 días gratis · Sin contrato · Cancela cuando quieras.'}
          </p>

          {/* Toggle plan (solo si viene con ?plan=personalizado) */}
          {isPersonalizado && (
            <div style={{
              display: 'inline-flex', gap: 8,
              backgroundColor: '#0f0a1e',
              border: '1.5px solid #2D2048',
              borderRadius: 999, padding: 4, marginBottom: 20,
            }}>
              {(['estandar_v2', 'personalizado_v2'] as PlanKey[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePlan(p)}
                  style={{
                    padding: '8px 18px', borderRadius: 999,
                    border: activePlan === p ? 'none' : '1.5px solid #2D2048',
                    backgroundColor: activePlan === p
                      ? p === 'personalizado_v2' ? '#ec4899' : '#7c3aed'
                      : '#1a1035',
                    color: activePlan === p ? '#fff' : '#a78bfa',
                    fontFamily: 'var(--font-nunito)',
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {PLANS[p].label}
                </button>
              ))}
            </div>
          )}

          {/* Badge del plan */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <span style={{
              display: 'inline-block',
              backgroundColor: plan.badgeBg,
              color: plan.badgeColor,
              border: `1px solid ${plan.badgeBorder}`,
              fontSize: 13, fontWeight: 700,
              borderRadius: 999, padding: '4px 14px',
            }}>
              {plan.badge}
            </span>
          </div>

          {/* Toggle ciclo de facturación */}
          <BillingCycleToggle selected={cycle} onChange={setCycle} />
        </div>

        {/* Banner trial */}
        {!deviceHadTrial && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.06))',
            border: '1.5px solid rgba(251,191,36,0.4)',
            borderRadius: 16, padding: '16px 20px',
            marginBottom: 24, textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 18, fontWeight: 900,
              color: '#fbbf24', margin: '0 0 6px',
            }}>
              🎯 7 días gratis
            </p>
            <p style={{
              fontSize: 14, color: '#fbbf24',
              opacity: 0.8, margin: 0,
              lineHeight: 1.6, fontWeight: 600,
            }}>
              Empieza hoy sin costo. Tu tarjeta se guarda pero no se cobra hasta el día 8.
            </p>
          </div>
        )}

        {/* Card de precio */}
        <div style={{
          backgroundColor: '#1a1035',
          border: `2px solid ${plan.ctaColor}`,
          borderRadius: 24,
          padding: '28px 24px',
          marginBottom: 16,
          position: 'relative',
          boxShadow: `0 0 40px ${plan.ctaColor}25`,
        }}>
          {/* Badge ciclo */}
          {cycle === 'semestral' && (
            <div style={{
              position: 'absolute', top: 0, right: 16,
              backgroundColor: '#7c3aed',
              color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '0 0 8px 8px',
              letterSpacing: '0.05em',
            }}>
              MÁS POPULAR
            </div>
          )}
          {cycle === 'anual' && (
            <div style={{
              position: 'absolute', top: 0, right: 16,
              backgroundColor: '#10b981',
              color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '0 0 8px 8px',
              letterSpacing: '0.05em',
            }}>
              MEJOR PRECIO
            </div>
          )}

          {/* Precio por mes */}
          <div style={{ marginBottom: 4, marginTop: cycle !== 'mensual' ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 48, fontWeight: 900,
                color: '#e2d9f3', lineHeight: 1,
              }}>
                ${pricing.perMonth}
              </span>
              <span style={{ fontSize: 15, color: '#a78bfa', marginBottom: 6 }}>
                /mes
              </span>
            </div>
          </div>

          {/* Total y ahorro */}
          {cycle !== 'mensual' && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 6px' }}>
                Un solo pago de{' '}
                <strong style={{ color: '#e2d9f3' }}>${pricing.total}</strong>
                {' '}por {cycle === 'semestral' ? '6 meses' : '12 meses'}
              </p>
              {pricing.savings && (
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#10b98120',
                  color: '#10b981',
                  border: '1px solid #10b98140',
                  fontSize: 13, fontWeight: 700,
                  borderRadius: 999, padding: '2px 10px',
                }}>
                  Ahorras ${pricing.savings} vs mensual
                </span>
              )}
            </div>
          )}

          {cycle === 'mensual' && <div style={{ marginBottom: 20 }} />}

          {/* CTA */}
          <button
            type="button"
            onClick={handleCTA}
            disabled={loadingCheckout}
            style={{
              width: '100%', minHeight: 56,
              backgroundColor: loadingCheckout ? '#2D2048' : plan.ctaColor,
              border: 'none', borderRadius: 14,
              fontFamily: 'var(--font-nunito)',
              fontSize: 18, fontWeight: 900,
              color: '#fff',
              cursor: loadingCheckout ? 'not-allowed' : 'pointer',
              boxShadow: loadingCheckout ? 'none' : `0 0 24px ${plan.ctaColor}60`,
              transition: 'all 0.15s ease',
            }}
          >
            {loadingCheckout
              ? 'Cargando...'
              : deviceHadTrial
                ? `Elegir ${cycle}`
                : `Probar 7 días gratis →`}
          </button>

          <p style={{
            textAlign: 'center', marginTop: 12,
            fontSize: 12, color: '#a78bfa', opacity: 0.7,
          }}>
            Sin contrato · Cancela cuando quieras
          </p>
        </div>

        {/* Disclaimer */}
        <div
          className="disclaimer-block"
          style={{
            borderLeft: '3px solid #7c3aed',
            backgroundColor: '#1a1035',
            borderRadius: '0 12px 12px 0',
            padding: '14px 16px',
          }}
        >
          <p style={{ fontSize: 14, color: '#a78bfa', margin: 0, lineHeight: 1.6 }}>
            Cancela cuando quieras y sigues teniendo acceso hasta que termina el periodo pagado.
            Recibirás un aviso 5 días antes de cada renovación.
          </p>
        </div>

        {/* Links de ayuda */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 20,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <a
            href="/ayuda"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#1a1035',
              border: '1.5px solid #2D2048',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: '#a78bfa',
              textDecoration: 'none',
              transition: 'border-color 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7c3aed'
              e.currentTarget.style.color = '#e2d9f3'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2D2048'
              e.currentTarget.style.color = '#a78bfa'
            }}
          >
            <span style={{ fontSize: 14 }}>💬</span>
            Preguntas frecuentes
          </a>
          <a
            href="/como-cancelar"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#1a1035',
              border: '1.5px solid #2D2048',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: '#a78bfa',
              textDecoration: 'none',
              transition: 'border-color 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7c3aed'
              e.currentTarget.style.color = '#e2d9f3'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2D2048'
              e.currentTarget.style.color = '#a78bfa'
            }}
          >
            <span style={{ fontSize: 14 }}>✕</span>
            ¿Cómo cancelo?
          </a>
        </div>

      </div>
    </div>
  )
}

export default function PlanesPage() {
  return (
    <Suspense>
      <PlanesContent />
    </Suspense>
  )
}
