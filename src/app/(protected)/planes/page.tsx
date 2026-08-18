'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackCheckoutStarted, trackPromoCheckoutIniciado } from '@/components/posthog-events'
import { nuevoEventId, track } from '@/lib/analytics/track'
import { BillingCycleToggle, type BillingCycle } from '@/components/planes/BillingCycleToggle'
import { PLAN_DISPLAY as PLANS } from '@/lib/payments/config'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { usePromo } from '@/hooks/usePromo'
import { useYaTuvoSuscripcion } from '@/hooks/useYaTuvoSuscripcion'
import { useEsperandoPromo } from '@/hooks/useEsperandoPromo'
import { Hueco } from '@/components/global/HuecoPromo'
import { conPromo, copyCTA, leyendaPromo, microcopyPromo, precioConPromo, promoAplica } from '@/lib/promos'

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

  // Reloj de la pantalla, para `segundos_desde_planes` de checkout_iniciado.
  const inicioPlanesRef = useRef(0)
  useEffect(() => {
    inicioPlanesRef.current = Date.now()
  }, [])

  const { promo: promoCampana, cargando: promoCargando, hayIndicio } = usePromo()
  const { yaTuvo, cargando: yaTuvoCargando } = useYaTuvoSuscripcion()

  /**
   * 🔴 Con indicio de campaña, el precio y el botón no se pintan hasta saber:
   * leer "$249 · Probar 7 días gratis" y que se reescriba a "$1 · Entra con un
   * peso" es anunciar dos precios. Sin indicio esto es false desde el primer
   * render y no espera nadie.
   */
  const esperandoPromo = useEsperandoPromo(
    hayIndicio,
    promoCargando || yaTuvoCargando
  )

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

  /**
   * `ciclo_cambiado` solo cuando cambia DE VERDAD.
   *
   * El toggle llama a esto tambien al pulsar el ciclo ya activo; sin la
   * guarda, cada toque repetido seria un cambio y la metrica de "cuanta
   * gente compara ciclos" quedaria inflada.
   *
   * `de` es el ciclo VISIBLE, no `cycleElegido`: mientras nadie ha tocado el
   * toggle ese es null y manda el de la campana o el default.
   */
  const setCycle = (nuevo: BillingCycle) => {
    if (nuevo !== cycle) {
      track('ciclo_cambiado', { de: cycle, a: nuevo, plan: activePlan })
    }
    setCycleElegido(nuevo)
  }

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

  /**
   * `planes_vistos` — una vez por carga, y SOLO cuando ya se sabe que pintar.
   *
   * Se espera a que usePromo y useYaTuvoSuscripcion resuelvan: antes de eso
   * `cycle` puede ser el default y cambiar a los 200ms al llegar la campana,
   * y `ciclo_default` habria registrado un ciclo que el usuario nunca vio.
   */
  const yaMedidoRef = useRef(false)
  useEffect(() => {
    if (promoCargando || yaTuvoCargando || yaMedidoRef.current) return
    yaMedidoRef.current = true
    track('planes_vistos', {
      ciclo_default: cycle,
      ya_tuvo_suscripcion: yaTuvo,
      plan: activePlan,
    })
  }, [promoCargando, yaTuvoCargando, cycle, yaTuvo, activePlan])

  /**
   * `planes_directo` — llegó aquí con un slug guardado que esta pantalla NO
   * va a aplicar.
   *
   * Dos causas distintas y las dos importan: la campaña ya no cubre este plan
   * o este ciclo, o la cuenta ya tuvo suscripción y el promotion code es de
   * primera compra. En ambos casos la persona vio "$1" en la landing y aquí
   * ve precio de lista.
   *
   * 🔴 Espera a que `usePromo` y `useYaTuvoSuscripcion` terminen. Durante la
   * carga `promo` vale null por diseño, y disparar ahí marcaría como perdida
   * toda campaña que simplemente no había resuelto todavía.
   */
  const slugGuardado =
    typeof window !== 'undefined' ? sessionStorage.getItem('pasas_promo') : null
  const resolviendo = promoCargando || yaTuvoCargando

  useEffect(() => {
    if (resolviendo || !slugGuardado || aplicaPromo) return
    track('promo_perdida', {
      promo_slug_esperado: slugGuardado,
      punto: 'planes_directo',
      tenia_utm: !!sessionStorage.getItem('pasas_utm'),
    })
  }, [resolviendo, slugGuardado, aplicaPromo])
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
        /**
         * 🔴 EL PUNTO EXACTO DEL TRÁFICO FRÍO: anónimo que ya eligió plan y se
         * va a crear cuenta. El slug va en la URL además de en sessionStorage
         * porque esto es `window.location.href`, una navegación dura, y porque
         * /registro es donde el slug se convierte en pending_checkout: si se
         * pierde aquí, se pierde para todo el resto del alta.
         *
         * 🔴 Aquí se usa `promoCampana` (sin filtrar por elegibilidad) y no
         * `promo`. Esta rama es, por definición, alguien que todavía NO tiene
         * cuenta real: la que va a crear será nueva y por tanto elegible,
         * así que el filtro de "ya tuvo suscripción" no le aplica. Usar el
         * `promo` filtrado además metía una carrera — si el CTA se toca antes
         * de que useYaTuvoSuscripcion resuelva, `promo` todavía es null y el
         * slug se habría perdido justo en el salto que más importa.
         */
        window.location.href = conPromo('/registro', promoCampana?.slug)
        return
      }

      localStorage.setItem('pasas_trial_used', 'true')
      trackCheckoutStarted(activePlan, CYCLE_TO_DURATION[cycle])
      if (aplicaPromo && promo) {
        trackPromoCheckoutIniciado(promo.slug, activePlan, cycle)
      }

      /**
       * 🔴 EL ID QUE CIERRA EL EMBUDO.
       *
       * Se genera AQUI, antes del POST, y viaja tres saltos: propiedad
       * `event_id` de este `checkout_iniciado` → body de create-session →
       * metadata de Stripe → `pago_exitoso` del webhook.
       *
       * Es lo que permite responder "de los checkouts que se abrieron,
       * cuantos acabaron en cobro". Cruzarlo por usuario no vale: quien abre
       * el checkout dos veces, o lo abandona y vuelve al dia siguiente,
       * colapsa en una sola persona y el abandono desaparece.
       */
      const checkoutEventId = nuevoEventId()

      track('checkout_iniciado', {
        event_id: checkoutEventId,
        plan: activePlan,
        ciclo: cycle,
        // 🔴 Lo que el usuario VIO en pantalla, no lo que Stripe vaya a
        // cobrar. Con promo activa aqui va el precio promocional: cruzado
        // contra `monto_cobrado` de pago_exitoso, delata cualquier
        // desalineacion entre lo prometido y lo cobrado.
        precio_mostrado: precioConPromo(promo, activePlan, cycle)?.final ?? pricing.amount,
        camino: 'planes',
        segundos_desde_planes: Math.round((Date.now() - inicioPlanesRef.current) / 1000),
      })

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
          checkout_event_id: checkoutEventId,
        }),
      })
      const data = await res.json()
      if (data.url) {
        // La pantalla prometió descuento y la sesión salió sin él.
        if (promo?.slug && !data.promo_aplicada) {
          track('promo_perdida', {
            promo_slug_esperado: promo.slug,
            punto: 'checkout_sin_promo',
            tenia_utm: !!sessionStorage.getItem('pasas_utm'),
          })
        }
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
        {/*
          El slot del banner se reserva mientras se espera. Está ARRIBA de la
          tarjeta de precio: si apareciera después, empujaría precio y botón
          hacia abajo justo cuando la persona va a tocarlos. El hueco mide el
          banner de campaña, que es el que se pinta si hemos llegado a esperar.
        */}
        {esperandoPromo && <Hueco alto={64} radio={16} margenAbajo={20} />}

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
        {!aplicaPromo && !deviceHadTrial && !esperandoPromo && (
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

          {esperandoPromo ? (
            /*
              🔴 El hueco mide la variante CON promo, la más alta: la fila de
              precio (40px a lineHeight 1, con el tachado alineado abajo → 46
              contando su margen) más 10px y la línea de "después" (14px a
              ~1.4 → 20). Con `marginBottom: 20` y el mismo `marginTop`
              condicional que las dos variantes reales, para que el badge de
              ciclo de arriba no descuadre nada.
            */
            <div style={{ marginBottom: 20, marginTop: cycle !== 'mensual' ? 16 : 0 }}>
              <Hueco alto={46} ancho={230} radio={10} />
              <div style={{ height: 10 }} />
              <Hueco alto={20} ancho={180} radio={6} />
            </div>
          ) : leyenda ? (
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

          {/*
            🔴 El hueco del CTA copia width 100%, minHeight 56 y borderRadius
            14 del botón real: reemplazo sin un píxel de diferencia. Lo que
            cambia es la etiqueta —"Probar 7 días gratis" vs el cta_label de la
            campaña— y esa es la promesa que no puede reescribirse a la vista.
          */}
          {esperandoPromo ? (
            <>
              <Hueco alto={56} radio={14} margenAbajo={12} />
              <Hueco alto={18} ancho={240} radio={6} />
            </>
          ) : (
          <>
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
          </>
          )}
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
