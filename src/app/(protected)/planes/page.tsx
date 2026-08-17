'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackCheckoutStarted, trackPromoCheckoutIniciado } from '@/components/posthog-events'
import { BillingCycleToggle, type BillingCycle } from '@/components/planes/BillingCycleToggle'
import { PLAN_DISPLAY as PLANS } from '@/lib/payments/config'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { usePromo } from '@/hooks/usePromo'
import { useYaTuvoSuscripcion } from '@/hooks/useYaTuvoSuscripcion'
import { copyCTA, leyendaPromo, microcopyPromo, promoAplica } from '@/lib/promos'

type PlanKey = keyof typeof PLANS

// Mapeo de BillingCycle a duration key del checkout
const CYCLE_TO_DURATION: Record<BillingCycle, string> = {
  mensual:   'monthly',
  semestral: 'semestral',
  anual:     'annual',
}

/** El ciclo que se preselecciona cuando no hay campaña que diga otra cosa. */
const CICLO_POR_DEFECTO: BillingCycle = 'semestral'

/**
 * `promo_campaigns.ciclos` es un text[]: la base no garantiza que sus valores
 * sean ciclos válidos. Este guard es la puerta entre esa columna y el toggle.
 */
function esBillingCycle(ciclo: string): ciclo is BillingCycle {
  return Object.prototype.hasOwnProperty.call(CYCLE_TO_DURATION, ciclo)
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
  // null = el usuario todavía no ha tocado el toggle. Se distingue del ciclo
  // efectivo a propósito: mientras sea null manda el ciclo de la campaña, y en
  // cuanto la persona elige algo, su elección gana para siempre.
  const [cycleElegido, setCycleElegido] = useState<BillingCycle | null>(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)

  useEffect(() => {
    setDeviceHadTrial(localStorage.getItem('pasas_trial_used') === 'true')
  }, [])

  const { promo: promoCampana } = usePromo()
  const { yaTuvo } = useYaTuvoSuscripcion()

  /**
   * 🔴 UNA SOLA PUERTA PARA LA PROMO EN TODA LA PANTALLA.
   *
   * El promotion code es `first_time_transaction`: a un cliente que vuelve,
   * Stripe le rechaza el código y se cae la Checkout Session entera. El
   * servidor ya lo cubre (resolvePromoParaCheckout ignora la promo con
   * hasHadSubscription), pero sin esto la pantalla le prometía el descuento y
   * el checkout lo desmentía.
   *
   * 🔴 Se anula la promo ENTERA aquí arriba en vez de añadir `&& !yaTuvo` a
   * cada sitio que decora. Abajo hay siete: el ciclo inicial, promoAplica, la
   * leyenda de precio, el copy del CTA, la microcopy, el banner y el evento de
   * PostHog. Siete condiciones sueltas es una que alguien se deja mañana; con
   * `promo` en null no hay nada que decorar y todas las funciones de promos.ts
   * caen solas a su camino sin campaña.
   *
   * `yaTuvo` arranca en true, así que mientras carga esto vale null: no se
   * promete nada hasta que se confirma que aplica. Ver useYaTuvoSuscripcion.
   */
  const promo = yaTuvo ? null : promoCampana

  /**
   * 🔴 CICLO INICIAL — sale de la campaña, no de una constante.
   *
   * PASAS1 solo vale para el ciclo mensual, pero la pantalla abría en
   * Semestral: quien llegaba del anuncio veía el precio semestral y ningún
   * banner, porque promoAplica() es false para el ciclo equivocado. La promo
   * existía y era invisible.
   *
   * Se toma el PRIMERO de promo.ciclos, no 'mensual' escrito a mano: una
   * campaña semestral abrirá en Semestral sola, sin tocar este archivo. El
   * `.find` con el type guard además ignora un valor basura en la columna en
   * vez de romper el toggle.
   *
   * Sin promo aplicable al plan activo, el default de siempre queda intacto.
   */
  const cicloDeLaPromo: BillingCycle | null =
    promo && promo.planes.includes(activePlan)
      ? promo.ciclos.find(esBillingCycle) ?? null
      : null

  const cycle: BillingCycle = cycleElegido ?? cicloDeLaPromo ?? CICLO_POR_DEFECTO
  const setCycle = setCycleElegido

  const plan = PLANS[activePlan]
  const pricing = plan.prices[cycle]

  // 🔴 REGLA A: la promo se evalúa contra el ciclo ACTIVO del toggle, no
  // contra "mensual" a secas. PASAS1 vale para estandar_v2 + mensual: al
  // cambiar a Semestral o Anual todo esto se apaga solo y la pantalla vuelve
  // a precio y copy normales, sin badge ni tachado.
  //
  // 🔴 ESTE es el único booleano de promoción de la pantalla. Ya trae dentro
  // las dos condiciones —que la campaña cubra plan y ciclo, y que la cuenta
  // sea elegible— porque `promo` viene anulada arriba para quien no lo es.
  // Nada más abajo vuelve a preguntar por `yaTuvo`.
  const aplicaPromo = promoAplica(promo, activePlan, cycle)
  const leyenda = leyendaPromo(promo, activePlan, cycle)

  const cta = copyCTA(promo, activePlan, cycle, {
    label: deviceHadTrial ? `Elegir ${cycle}` : 'Probar 7 días gratis →',
    sublabel: 'Sin contrato · Cancela cuando quieras',
  })

  // 🔴 REGLA E: a quien ya usó el trial en este dispositivo no se le pinta el
  // sublabel de la campaña — "Tus primeros 7 días son gratis" le promete algo
  // que ya gastó. Solo el label.
  const sublabelCTA =
    aplicaPromo && deviceHadTrial
      ? 'Sin contrato · Cancela cuando quieras'
      : microcopyPromo(cta.sublabel, ['Cancela cuando quieras'])

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
      if (aplicaPromo && promo) {
        trackPromoCheckoutIniciado(promo.slug, activePlan, cycle)
      }

      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: activePlan,
          duration: CYCLE_TO_DURATION[cycle],
          // Solo el slug. El servidor decide si aplica y cuánto descuenta: se
          // manda tal cual haya o no aplicado en pantalla, porque quien valida
          // es resolvePromoParaCheckout, no esto.
          promo: promo?.slug,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        // El servidor devuelve un mensaje propio cuando la promoción no se
        // pudo aplicar: se muestra ese, no el genérico. Corta la venta a
        // propósito — cobrar lista después de anunciar el descuento sería
        // anunciar un precio y cobrar otro.
        alert(data.error ?? 'Error al iniciar el pago. Intenta de nuevo.')
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
            {/* Con promo se quita "7 días gratis · " y nada más: competía con
                el CTA de campaña, que ya promete los días en su sublabel.
                Sin promo queda idéntico a como estaba. */}
            {aplicaPromo
              ? 'Sin contrato · Cancela cuando quieras.'
              : deviceHadTrial
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

        {/*
          Banner. Uno u otro, nunca los dos: si la campaña aplica al ciclo
          activo se pinta el de promo; si no, el de trial de siempre.
          Va exactamente donde estaba el de trial.

          El de promo sí se pinta con deviceHadTrial: `banner_checkout` habla
          de precio, no de días gratis, así que no promete nada ya gastado.
        */}
        {aplicaPromo && promo?.banner_checkout && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.06))',
            border: '1.5px solid rgba(16,185,129,0.4)',
            borderRadius: 16, padding: '16px 20px',
            marginBottom: 24, textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 16, fontWeight: 900,
              color: '#10b981', margin: '0 0 6px',
            }}>
              🎟️ {promo.codigo_visible}
            </p>
            <p style={{
              fontSize: 14, color: '#10b981',
              opacity: 0.85, margin: 0,
              lineHeight: 1.6, fontWeight: 600,
            }}>
              {promo.banner_checkout}
            </p>
          </div>
        )}

        {/* Banner trial */}
        {!aplicaPromo && !deviceHadTrial && (
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

          {leyenda ? (
            /*
              REGLA C — lista tachada, precio del primer cargo y lo que se
              cobra después. Reemplaza al bloque de precio normal completo: no
              queda ningún monto escrito a mano junto a este, que es como se
              acaba anunciando "$1/mes".
            */
            <div style={{ marginBottom: 20, marginTop: cycle !== 'mensual' ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 22, color: '#a78bfa',
                  textDecoration: 'line-through',
                  marginBottom: 6,
                }}>
                  {leyenda.listaTexto}
                </span>
                <span style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 40, fontWeight: 900,
                  color: '#e2d9f3', lineHeight: 1,
                }}>
                  {leyenda.finalTexto}
                </span>
              </div>
              <p style={{ fontSize: 14, color: '#a78bfa', margin: '10px 0 0', fontWeight: 700 }}>
                {leyenda.despuesTexto}
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}

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
            {loadingCheckout ? 'Cargando...' : cta.label}
          </button>

          <p style={{
            textAlign: 'center', marginTop: 12,
            fontSize: 12, color: '#a78bfa', opacity: 0.7,
          }}>
            {sublabelCTA}
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
