'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

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
  const router = useRouter()
  const planParam = searchParams.get('plan')
  const isPersonalizado = planParam === 'personalizado'

  const [activePlan, setActivePlan] = useState<PlanKey>(
    isPersonalizado ? 'personalizado' : 'estandar'
  )

  const plan = PLANS[activePlan]

  function handleCTA(duration: Duration) {
    router.push(`/checkout?plan=${activePlan}&duration=${duration}`)
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
        backgroundColor: '#0f0a1e',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .planes-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .planes-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
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
              fontSize: 12,
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
              fontSize: 14,
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
                    fontSize: 14,
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
                fontSize: 12,
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
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '0 0 8px 8px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    MÁS POPULAR
                  </div>
                )}

                <div className="card-padding" style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Duration label */}
                  <p
                    style={{
                      fontFamily: 'var(--font-orbitron)',
                      fontSize: 13,
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
                        fontSize: 13,
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
                          fontSize: 11,
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
                        fontSize: 12,
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
                    style={{
                      width: '100%',
                      minHeight: 52,
                      backgroundColor: ctaBg,
                      border: 'none',
                      borderRadius: 14,
                      fontFamily: 'var(--font-nunito)',
                      fontSize: 15,
                      fontWeight: 900,
                      color: '#ffffff',
                      cursor: 'pointer',
                      marginTop: 'auto',
                    }}
                  >
                    Elegir {card.label}
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
              fontSize: 13,
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
