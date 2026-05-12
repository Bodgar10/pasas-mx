'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackCheckoutStarted } from '@/components/posthog-events'

const PLANS = {
  estandar: {
    badge: 'Curso por Grado — Todas las materias',
    badgeColor: '#06b6d4',
    badgeBg: '#06b6d420',
    badgeBorder: '#06b6d440',
    monthly: 199,
    quarterly: 169,
    biannual: 139,
    quarterlyTotal: 507,
    biannualTotal: 834,
    quarterlySavings: 90,
    biannualSavings: 360,
  },
  personalizado: {
    badge: 'Guías Únicas — Solo una materia',
    badgeColor: '#ec4899',
    badgeBg: '#ec489920',
    badgeBorder: '#ec489940',
    monthly: 499,
    quarterly: 429,
    biannual: 349,
    quarterlyTotal: 1287,
    biannualTotal: 2094,
    quarterlySavings: 210,
    biannualSavings: 900,
  },
} as const

type PlanKey = keyof typeof PLANS
type Duration = 'monthly' | 'quarterly' | 'biannual'

function PlanesContent() {
  const searchParams = useSearchParams()

  // After registro, resume pending plan from sessionStorage
  useEffect(() => {
    const pendingPlan = sessionStorage.getItem('pasas_pending_plan') as PlanKey | null
    const pendingDuration = sessionStorage.getItem('pasas_pending_duration') as Duration | null
    if (pendingPlan && pendingDuration) {
      sessionStorage.removeItem('pasas_pending_plan')
      sessionStorage.removeItem('pasas_pending_duration')
      setActivePlan(pendingPlan)
      handleCTA(pendingDuration)
    }
  }, [])

const planParam = searchParams.get('plan')
  const isPersonalizado = planParam === 'personalizado'

  const [activePlan, setActivePlan] = useState<PlanKey>(
    isPersonalizado ? 'personalizado' : 'estandar'
  )

  const plan = PLANS[activePlan]

  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)

  async function handleCTA(duration: Duration) {
    setLoadingCheckout(duration)
    try {
      // Check if user is anonymous — if so, redirect to registro first
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.is_anonymous) {
        // Save intended plan in sessionStorage so registro can redirect back
        sessionStorage.setItem('pasas_pending_plan', activePlan)
        sessionStorage.setItem('pasas_pending_duration', duration)
        window.location.href = '/registro'
        return
      }

      trackCheckoutStarted(activePlan, duration)
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: activePlan, duration }),
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
      setLoadingCheckout(null)
    }
  }

  const cards = [
    {
      key: 'monthly' as Duration,
      label: 'Mensual',
      price: plan.monthly,
      popular: false,
      savings: null,
      total: null,
    },
    {
      key: 'quarterly' as Duration,
      label: '3 meses',
      price: plan.quarterly,
      popular: true,
      savings: plan.quarterlySavings,
      total: plan.quarterlyTotal,
    },
    {
      key: 'biannual' as Duration,
      label: '6 meses',
      price: plan.biannual,
      popular: false,
      savings: plan.biannualSavings,
      total: plan.biannualTotal,
    },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .planes-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: stretch;
        }
        @media (min-width: 768px) {
          .planes-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            align-items: stretch;
          }
        }
        .card-middle-desktop {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        @media (min-width: 768px) {
          .card-middle-desktop {
            transform: scale(1.04);
            box-shadow: 0 0 40px rgba(124, 58, 237, 0.25);
          }
        }
        .page-inner {
          max-width: 390px;
          margin: 0 auto;
          padding: 20px 16px 40px;
        }
        @media (min-width: 768px) {
          .page-inner {
            max-width: 1100px;
            padding: 60px 40px;
          }
        }
        .title-text {
          font-size: 26px;
        }
        @media (min-width: 768px) {
          .title-text {
            font-size: 36px;
          }
        }
        .card-price {
          font-size: 32px;
        }
        @media (min-width: 768px) {
          .card-price {
            font-size: 40px;
          }
        }
        .card-padding {
          padding: 20px 16px;
        }
        @media (min-width: 768px) {
          .card-padding {
            padding: 32px 24px;
          }
        }
        .disclaimer-block {
          margin-top: 24px;
        }
        @media (min-width: 768px) {
          .disclaimer-block {
            max-width: 500px;
            margin: 32px auto 0;
          }
        }
      `}} />

      <div className="page-inner">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#a78bfa',
              margin: '0 0 12px',
            }}
          >
            PASAS.MX
          </p>
          <h1
            className="title-text"
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontWeight: 900,
              color: '#e2d9f3',
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}
          >
            Elige cómo pagar
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#a78bfa',
              margin: '0 0 16px',
              lineHeight: 1.6,
            }}
          >
            Sin contrato. Cancela cuando quieras.
          </p>

          {/* Tab switcher — only when plan=personalizado */}
          {isPersonalizado && (
            <div
              style={{
                display: 'inline-flex',
                gap: 8,
                backgroundColor: '#0f0a1e',
                border: '1.5px solid #2D2048',
                borderRadius: 999,
                padding: 4,
                marginBottom: 16,
              }}
            >
              {(['estandar', 'personalizado'] as PlanKey[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePlan(p)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    border: activePlan === p ? 'none' : '1.5px solid #2D2048',
                    backgroundColor:
                      activePlan === p
                        ? p === 'personalizado'
                          ? '#ec4899'
                          : '#7c3aed'
                        : '#1a1035',
                    color: activePlan === p ? '#fff' : '#a78bfa',
                    fontFamily: 'var(--font-nunito)',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {p === 'estandar' ? 'Estándar' : 'Personalizado'}
                </button>
              ))}
            </div>
          )}

          {/* Plan badge */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: plan.badgeBg,
                color: plan.badgeColor,
                border: `1px solid ${plan.badgeBorder}`,
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 999,
                padding: '4px 14px',
              }}
            >
              {plan.badge}
            </span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="planes-grid">
          {cards.map((card, idx) => {
            const isMiddle = idx === 1
            const ctaBg = isMiddle && activePlan === 'personalizado' ? '#ec4899' : '#7c3aed'

            return (
              <div
                key={card.key}
                className={isMiddle ? 'card-middle-desktop' : ''}
                style={{
                  position: 'relative',
                  backgroundColor: '#1a1035',
                  border: isMiddle ? '2px solid #7c3aed' : '1.5px solid #2D2048',
                  borderRadius: 20,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                {/* Popular tag */}
                {isMiddle && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 16,
                      backgroundColor: '#7c3aed',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '0 0 8px 8px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    MÁS POPULAR
                  </div>
                )}

                <div className="card-padding" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Duration label */}
                  <p
                    style={{
                      fontFamily: 'var(--font-orbitron)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#a78bfa',
                      margin: isMiddle ? '16px 0 12px' : '0 0 12px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {card.label}
                  </p>

                  {/* Price */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 4,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      className="card-price"
                      style={{
                        fontFamily: 'var(--font-orbitron)',
                        fontWeight: 900,
                        color: '#e2d9f3',
                        lineHeight: 1,
                      }}
                    >
                      ${card.price}
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        color: '#a78bfa',
                        marginBottom: 4,
                      }}
                    >
                      /mes
                    </span>
                  </div>

                  {/* Savings badge */}
                  {card.savings !== null && (
                    <div style={{ marginBottom: 6 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#10b98120',
                          color: '#10b981',
                          border: '1px solid #10b98140',
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: '2px 10px',
                        }}
                      >
                        Ahorras ${card.savings}
                      </span>
                    </div>
                  )}

                  {/* Total line */}
                  {card.total !== null && (
                    <p
                      style={{
                        fontSize: 14,
                        color: '#a78bfa',
                        margin: '0 0 16px',
                      }}
                    >
                      Total ${card.total} · Ahorras ${card.savings}
                    </p>
                  )}

                  {!card.total && <div style={{ marginBottom: 16 }} />}

                  {/* CTA button */}
                  <button
                    type="button"
                    onClick={() => handleCTA(card.key)}
                    disabled={loadingCheckout !== null}
                    style={{
                      width: '100%',
                      minHeight: 52,
                      backgroundColor: ctaBg,
                      border: 'none',
                      borderRadius: 14,
                      fontFamily: 'var(--font-nunito)',
                      fontSize: 17,
                      fontWeight: 900,
                      color: '#ffffff',
                      cursor: loadingCheckout !== null ? 'not-allowed' : 'pointer',
                      marginTop: 'auto',
                      opacity: loadingCheckout !== null && loadingCheckout !== card.key ? 0.6 : 1,
                    }}
                  >
                    {loadingCheckout === card.key ? 'Cargando...' : `Elegir ${card.label}`}
                  </button>
                </div>
              </div>
            )
          })}
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
          <p
            style={{
              fontSize: 15,
              color: '#a78bfa',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Sin contrato. Cancela cuando quieras y sigues teniendo acceso hasta que termina el periodo pagado.
          </p>
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
