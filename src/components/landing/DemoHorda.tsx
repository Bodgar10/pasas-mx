'use client'

import { useState } from 'react'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

/**
 * Escalera de oleadas del Modo Horda para la landing.
 *
 * Interactivo en vez de animado en bucle: el visitante avanza cuando quiere y
 * ve que la dificultad sube. Un bucle automático se ignora; algo que responde
 * al toque, no.
 */

const OLEADAS = [
  { n: 1, dif: 'Fácil',   color: COLORS.success },
  { n: 2, dif: 'Fácil',   color: COLORS.success },
  { n: 3, dif: 'Media',   color: COLORS.yellow },
  { n: 4, dif: 'Media',   color: COLORS.yellow },
  { n: 5, dif: 'Difícil', color: COLORS.pink },
  { n: 6, dif: 'Difícil', color: COLORS.pink },
]

export default function DemoHorda({ onAvanzar }: { onAvanzar?: () => void }) {
  const [actual, setActual] = useState(1)
  const completada = actual > OLEADAS.length

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1.5px solid ${COLORS.pink}44`,
        borderRadius: RADIUS.xxl,
        padding: '22px 20px',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {OLEADAS.map((o) => (
          <div
            key={o.n}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              background: o.n < actual ? o.color : COLORS.inputBorder,
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      {!completada ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                fontFamily: FONTS.orbitron,
                fontWeight: 900,
                fontSize: 26,
                color: COLORS.text,
              }}
            >
              Oleada {actual}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: OLEADAS[actual - 1].color,
              }}
            >
              {OLEADAS[actual - 1].dif}
            </span>
          </div>

          <p style={{ fontSize: 15, color: COLORS.muted, margin: '0 0 18px', lineHeight: 1.5 }}>
            5 preguntas. Necesitas 4 para pasar. Con 3 la repites, con menos
            vuelves al principio.
          </p>

          <button
            type="button"
            onClick={() => { setActual((a) => a + 1); onAvanzar?.() }}
            style={{
              width: '100%',
              minHeight: 48,
              background: `${COLORS.pink}22`,
              border: `1.5px solid ${COLORS.pink}66`,
              borderRadius: RADIUS.lg,
              color: COLORS.pink,
              fontFamily: FONTS.nunito,
              fontWeight: 900,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {actual === OLEADAS.length ? 'Última oleada →' : 'Siguiente oleada →'}
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <p
            style={{
              fontFamily: FONTS.orbitron,
              fontWeight: 900,
              fontSize: 20,
              color: COLORS.text,
              margin: '0 0 6px',
            }}
          >
            Horda despejada
          </p>
          <p style={{ fontSize: 15, color: COLORS.muted, margin: 0, lineHeight: 1.5 }}>
            30 preguntas del tema, de fácil a difícil. Así llegas al examen.
          </p>
        </div>
      )}
    </div>
  )
}
