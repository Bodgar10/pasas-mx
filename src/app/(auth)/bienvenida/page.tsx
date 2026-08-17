'use client'

import { Suspense, useEffect, useState } from 'react'
import Confetti from '@/components/global/Confetti'
import { useSearchParams, useRouter } from 'next/navigation'
import { PLAN_DISPLAY, cicloDisplay } from '@/lib/payments/config'
import { usePromo } from '@/hooks/usePromo'
import { useYaTuvoSuscripcion } from '@/hooks/useYaTuvoSuscripcion'
import { useEsperandoPromo } from '@/hooks/useEsperandoPromo'
import { Hueco } from '@/components/global/HuecoPromo'
import { copyCTA, leyendaPromo, microcopyPromo, promoAplica } from '@/lib/promos'

/*
  Aquí vivían DURATION_LABELS y DURATION_CYCLE: dos mapas locales con los
  MISMOS tres pares monthly→mensual, y un tercero privado en config.ts
  (CICLO_A_DISPLAY). Ahora los tres son cicloDisplay() de
  src/lib/payments/config.ts, que es el único lugar donde existe la
  traducción base → display.
*/
function BienvenidaContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const plan = searchParams.get('plan') ?? 'estandar_v2'
  const duration = searchParams.get('duration') ?? 'monthly'

  const planKey = plan as keyof typeof PLAN_DISPLAY
  const cycleKey = cicloDisplay(duration)
  const planInfo = PLAN_DISPLAY[planKey] ?? PLAN_DISPLAY.estandar_v2
  const pricing = planInfo.prices[cycleKey]
  const durationLabel = cycleKey
  const planLabel = planInfo.label

  // 🔴 Última pantalla antes de Stripe: aquí el "después $249/mes" no es
  // opcional. Es el último lugar donde la persona puede leer lo que se le va
  // a cobrar antes de meter la tarjeta.
  //
  // `cycleKey` es el ciclo en vocabulario de PLAN_DISPLAY (mensual/semestral/
  // anual), que es el mismo que guarda promo_campaigns.ciclos. `duration` de
  // la URL viene en el de la base (monthly/annual) y NO sirve aquí.
  const { promo: promoCampana, cargando: promoCargando, hayIndicio } = usePromo()
  const { yaTuvo, cargando: yaTuvoCargando } = useYaTuvoSuscripcion()

  /**
   * 🔴 Con indicio de campaña, precio y CTA NO se pintan hasta saber. Sin
   * indicio esto es false ya en el primer render y la pantalla va como
   * siempre, sin un milisegundo de espera.
   */
  const esperandoPromo = useEsperandoPromo(
    hayIndicio,
    promoCargando || yaTuvoCargando
  )

  /**
   * 🔴 UNA SOLA PUERTA PARA LA PROMO EN TODA LA PANTALLA.
   *
   * El promotion code es `first_time_transaction`. Un cliente que vuelve —y a
   * esta pantalla se puede llegar con ?promo= desde el correo, no solo desde
   * el embudo— no puede canjearlo: Stripe rechazaría el código y se caería la
   * Checkout Session. create-session ya lo ignora en el servidor con
   * hasHadSubscription; esto es para que la pantalla tampoco lo prometa.
   *
   * Se anula la promo ENTERA aquí en vez de añadir `&& !yaTuvo` a cada sitio
   * que decora —leyenda, banner, CTA, microcopy y el body del POST—. Con
   * `promo` en null no queda nada que decorar y todo cae solo a la pantalla
   * sin campaña.
   *
   * `yaTuvo` arranca en true: mientras carga, esto es null y no se promete
   * nada. Ver useYaTuvoSuscripcion.
   */
  const promo = yaTuvo ? null : promoCampana

  // 🔴 El único booleano de promoción de la pantalla: trae dentro tanto el
  // alcance de la campaña como la elegibilidad de la cuenta.
  const aplicaPromo = promoAplica(promo, plan, cycleKey)
  const leyenda = leyendaPromo(promo, plan, cycleKey)

  const cta = copyCTA(promo, plan, cycleKey, {
    label: 'Activar mis 7 días gratis →',
    sublabel: 'Sin contrato · Cancela cuando quieras · Sin cobro hasta el día 8',
  })

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
        // Solo el slug: el servidor decide si aplica y cuánto.
        body: JSON.stringify({ plan, duration, promo: promo?.slug }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        // Si la promoción no se pudo aplicar hay que decirlo antes de mandar a
        // /planes: esta persona acaba de leer "$1" y un redirect silencioso la
        // dejaría creyendo que se cayó el sitio.
        if (data.error) alert(data.error)
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
            {esperandoPromo ? (
              /*
                🔴 EL HUECO MIDE LO QUE MIDE LA VARIANTE CON PROMO, que es la
                más alta de las dos: línea de precio (28px, alto de línea 34) +
                4px + línea de "después" (13px, alto de línea 20). Si llega la
                promo —el caso probable cuando hay indicio— el reemplazo es de
                cero salto. Si resulta que no aplica, el bloque encoge esa
                última línea; se prefiere ese encogimiento raro a que el caso
                habitual empuje la pantalla hacia abajo.
              */
              <>
                <Hueco alto={34} ancho={190} radio={8} margenAbajo={4} />
                <Hueco alto={20} ancho={150} radio={6} />
              </>
            ) : leyenda ? (
              /* REGLA C — lista tachada, precio del primer cargo y lo que se
                 cobra después. Los tres juntos, sin excepción. */
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 18,
                    color: '#a78bfa',
                    textDecoration: 'line-through',
                  }}>
                    {leyenda.listaTexto}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 28,
                    fontWeight: 900,
                    color: '#e2d9f3',
                  }}>
                    {leyenda.finalTexto}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#a78bfa', margin: 0, fontWeight: 700 }}>
                  {leyenda.despuesTexto}
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/*
            Info trial. REGLA D: con promo NO se pinta — su contenido queda
            dicho entre el bloque de precio (regla C) y la microcopy del
            botón, que conserva "Cancela cuando quieras" y "Sin cobro hasta el
            día 8". Dejar los dos apilaría dos veces la promesa de los 7 días.
          */}
          {!aplicaPromo && !esperandoPromo && (
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
          )}

          {/*
            El slot del banner también se reserva. El banner "aparece o no
            aparece", pero está ARRIBA del CTA: si se materializa después,
            empuja el botón hacia abajo justo cuando la persona va a tocarlo.
            El hueco mide el banner de campaña —12px de padding arriba y abajo,
            una línea de 13px a 1.5, 1px de borde— que es el que se pinta
            cuando hay promo, o sea el caso probable si hemos llegado a
            esperar.
          */}
          {esperandoPromo && <Hueco alto={46} radio={12} margenAbajo={24} />}

          {/* Banner de la campaña, donde estaba el de trial. */}
          {aplicaPromo && promo?.banner_checkout && (
            <div style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 24,
            }}>
              <p style={{ fontSize: 13, color: '#10b981', fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
                🎟️ {promo.banner_checkout}
              </p>
            </div>
          )}

          {/*
            🔴 CTA. El hueco copia las tres medidas del botón real —width
            100%, minHeight 56, borderRadius 14, marginBottom 12—, así que el
            reemplazo no mueve un píxel. La etiqueta es lo que cambia entre
            "Activar mis 7 días gratis" y el cta_label de la campaña, y esa es
            justo la promesa que no puede reescribirse a la vista.
          */}
          {esperandoPromo ? (
            <>
              <Hueco alto={56} radio={14} margenAbajo={12} />
              {/* La microcopy: 12px a 1.5 de alto de línea = 18px. */}
              <Hueco alto={18} ancho={260} radio={6} />
            </>
          ) : (
          <>
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
            {loading ? 'Preparando tu plan...' : cta.label}
          </button>

          {/* REGLA D: el sublabel de promo reemplaza esta línea, pero
              "Cancela cuando quieras" y "Sin cobro hasta el día 8" siguen. */}
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            {microcopyPromo(cta.sublabel, ['Cancela cuando quieras', 'Sin cobro hasta el día 8'])}
          </p>
          </>
          )}

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
