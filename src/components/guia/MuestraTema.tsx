'use client'

import { useEffect, useRef } from 'react'
import type { MuestraTema } from '@/lib/tema-muestra'

/**
 * s42 — Piezas de la guía que solo existen cuando se llega desde el reto.
 *
 *  - EntradaDesdeReto: "Fallaste este tema en el reto · vamos a reforzarlo",
 *    con la ruta guiada (idea → minijuego → quiz → Horda). Sale en la muestra
 *    sin cuenta y también en la guía de quien ya tiene cuenta (?from=arcade).
 *  - OfertaMuestra: el cierre de la muestra. Registro con la campaña vigente
 *    y el precio de después siempre al lado (REGLA C), más el mensaje listo
 *    para pedírselo a mamá o papá.
 */

const PASOS = [
  { paso: 'idea', n: 1, texto: 'Entiende la idea' },
  { paso: 'minijuego', n: 2, texto: 'Haz un minijuego' },
  { paso: 'quiz', n: 3, texto: 'Responde el Quiz' },
  { paso: 'horda', n: 4, texto: 'Si quieres más práctica, entra a la Horda' },
] as const

type Paso = (typeof PASOS)[number]['paso']

export function EntradaDesdeReto({
  perfecto = false,
  tieneHorda,
  tematicaCorta,
  cambiarTematicaHref,
  onPaso,
}: {
  /** 5/5 en el reto: no hay error que reforzar, hay un nivel que subir. */
  perfecto?: boolean
  tieneHorda: boolean
  tematicaCorta: string | null
  cambiarTematicaHref: string | null
  onPaso: (paso: Paso) => void
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.16), rgba(236,72,153,0.1))',
        border: '1px solid rgba(167,139,250,0.35)',
        borderRadius: 16,
        padding: '16px 16px 14px',
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 900, color: '#f0e6ff' }}>
        {perfecto ? 'Cinco de cinco en el reto 🔥' : 'Fallaste este tema en el reto 👀'}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#c4b5fd', marginTop: 2 }}>
        {perfecto ? 'Ahora el tema completo, de fácil a difícil.' : 'Vamos a reforzarlo.'}
      </div>
      {tematicaCorta && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginTop: 6 }}>
          Te lo explicamos con {tematicaCorta}.{' '}
          {cambiarTematicaHref && (
            <a href={cambiarTematicaHref} style={{ color: '#fbbf24', textDecoration: 'underline' }}>
              Cambiar
            </a>
          )}
        </div>
      )}
      <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PASOS.filter((p) => tieneHorda || p.paso !== 'horda').map((p) => (
          <li key={p.paso}>
            <button
              type="button"
              onClick={() => onPaso(p.paso)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(15,10,30,0.55)',
                border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 10,
                padding: '8px 10px',
                color: '#e2d9f3',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-nunito)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#0d9488',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {p.n}
              </span>
              {p.texto}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onPaso('idea')}
        style={{
          width: '100%',
          minHeight: 48,
          background: '#0d9488',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          fontFamily: 'var(--font-nunito)',
          fontSize: 16,
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        Empezar →
      </button>
    </div>
  )
}

export function OfertaMuestra({
  muestra,
  lugar,
  topicName,
  contar,
}: {
  muestra: MuestraTema
  /**
   * Dónde aparece. 'minijuego' (s50): justo después del primer minijuego de la
   * guía, porque casi nadie llega al quiz (20-22 oct: 15 abrieron el tema, 16
   * minijuegos, 2 vieron la oferta del final).
   */
  lugar: 'quiz' | 'resumen' | 'minijuego'
  topicName: string
  contar: (evento: string, props?: Record<string, unknown>) => void
}) {
  const o = muestra.oferta
  const ref = useRef<HTMLDivElement>(null)
  const vista = useRef(false)

  // "Vista" de verdad: la del Resumen vive montada en una pestaña oculta.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entradas) => {
        if (vista.current || !entradas.some((e) => e.isIntersecting)) return
        vista.current = true
        contar('tema_muestra_cta_vista', { elemento: lugar })
        obs.disconnect()
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [contar, lugar])

  const precio =
    o.finalTexto && o.despuesTexto
      ? ` Tiene 7 días gratis y luego ${o.finalTexto.replace(' primer mes', '')} el primer mes (${o.despuesTexto}).`
      : ' Tiene 7 días gratis.'
  const mensaje =
    `Hola, encontré PASAS para estudiar todas mis materias con minijuegos. ` +
    `Hoy practiqué ${topicName} y sí le entendí.${precio} ¿Me abres la cuenta?\n${o.linkPapa}`

  return (
    <div
      ref={ref}
      style={{
        background: '#1a1035',
        border: '1.5px solid rgba(251,191,36,0.55)',
        borderRadius: 16,
        padding: '18px 16px 16px',
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 900, color: '#f0e6ff', lineHeight: 1.3 }}>
        ¿Quieres seguir practicando justo lo que se te atora?
      </div>
      <div style={{ fontSize: 14, color: '#c4b5fd', marginTop: 6, lineHeight: 1.5 }}>
        Desbloquea PASAS: todas tus materias, minijuegos, Quiz, audio y Modo Horda.
      </div>

      {o.finalTexto && (
        <div style={{ marginTop: 12 }}>
          {o.badge && (
            <span
              style={{
                display: 'inline-block',
                background: '#fbbf24',
                color: '#1a1035',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {o.badge}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            {o.listaTexto && (
              <s style={{ color: '#8f84b5', fontSize: 16, fontWeight: 800 }}>{o.listaTexto}</s>
            )}
            <span style={{ color: '#fbbf24', fontSize: 22, fontWeight: 900 }}>{o.finalTexto}</span>
          </div>
          {o.despuesTexto && (
            <div style={{ color: '#8f84b5', fontSize: 13, fontWeight: 800 }}>{o.despuesTexto}</div>
          )}
        </div>
      )}

      <a
        href={o.href}
        onClick={() => contar('tema_muestra_cta_clic', { elemento: lugar })}
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 52,
          background: '#fbbf24',
          color: '#1a1035',
          borderRadius: 14,
          fontSize: 17,
          fontWeight: 900,
          textDecoration: 'none',
        }}
      >
        {o.cta}
      </a>
      <div style={{ fontSize: 12, color: '#8f84b5', textAlign: 'center', marginTop: 8 }}>{o.micro}</div>

      <div style={{ borderTop: '1px solid rgba(124,58,237,0.2)', marginTop: 14, paddingTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>¿Necesitas pedírselo a mamá o papá?</div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener"
          onClick={() => contar('tema_muestra_cta_clic', { elemento: `${lugar}_whatsapp` })}
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 46,
            border: '1.5px solid #2D2048',
            borderRadius: 12,
            color: '#e2d9f3',
            fontSize: 15,
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Enviárselo por WhatsApp →
        </a>
      </div>
    </div>
  )
}
