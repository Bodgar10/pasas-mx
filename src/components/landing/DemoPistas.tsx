'use client'

import { useState } from 'react'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

/**
 * Demo interactivo de Papel y Lápiz para la landing.
 *
 * No es un GIF ni un video: es la mecánica real, jugable. Quien lo prueba ya
 * vivió el producto antes de registrarse. Pesa unos KB en vez de los megas de
 * un GIF, no se pixela y funciona en móvil sin autoplay.
 *
 * Las pistas siguen el mismo contrato que el producto: progresivas, y la última
 * trae la operación completa SIN el resultado. El alumno da el último paso.
 */

const RESPUESTA = 66

const PISTAS = [
  'Empieza por el total. Son 3 ranuras y cada una guarda 27 bloques.',
  '3 × 27 = 81 bloques en total. Ahora quítale los que sacaste.',
  'La operación completa es: 81 − 15',
]

export default function DemoPistas({ onIntento }: { onIntento?: () => void }) {
  const [valor, setValor] = useState('')
  const [pistas, setPistas] = useState(0)
  const [acertado, setAcertado] = useState(false)
  const [fallo, setFallo] = useState(false)

  function revisar() {
    const n = Number(valor.replace(',', '.'))
    onIntento?.()

    if (!valor.trim() || Number.isNaN(n)) return

    if (n === RESPUESTA) {
      setAcertado(true)
      setFallo(false)
      return
    }

    setFallo(true)
    setPistas((p) => Math.min(p + 1, PISTAS.length))
  }

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1.5px solid ${COLORS.primary}44`,
        borderRadius: RADIUS.xxl,
        padding: '22px 20px',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: COLORS.primary,
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}
      >
        Pruébalo aquí
      </p>

      {/*
        🔴 SOLO CAMBIÓ EL CONTEXTO NARRATIVO: era "un cofre de Minecraft" y la
        landing es material promocional público, donde citar la marca es uso
        comercial ajeno.

        Los números NO se tocaron —3 ranuras, 27 bloques, 15 sacados, 66 de
        respuesta— y las tres PISTAS quedaron intactas palabra por palabra,
        porque ninguna nombraba la marca. "Inventario", "ranuras" y "bloques"
        son vocabulario genérico de videojuegos, no marca registrada, y
        conservan el mismo referente mental sin apropiarse de nada.
      */}
      <p style={{ fontSize: 16, color: COLORS.text, lineHeight: 1.6, margin: '0 0 18px', fontWeight: 600 }}>
        En tu inventario tienes 3 ranuras llenas y cada una guarda 27 bloques.
        Si sacas 15 bloques, ¿cuántos quedan?
      </p>

      {!acertado && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            inputMode="numeric"
            value={valor}
            onChange={(e) => { setValor(e.target.value); setFallo(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') revisar() }}
            placeholder="Tu respuesta"
            aria-label="Tu respuesta"
            style={{
              flex: 1,
              minHeight: 48,
              background: COLORS.card2 ?? '#1C1033',
              border: `1.5px solid ${fallo ? '#f87171' : COLORS.inputBorder}`,
              borderRadius: RADIUS.lg,
              padding: '0 14px',
              color: COLORS.text,
              fontFamily: FONTS.nunito,
              fontSize: 16,
              fontWeight: 700,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={revisar}
            style={{
              minHeight: 48,
              padding: '0 20px',
              background: COLORS.primary,
              border: 'none',
              borderRadius: RADIUS.lg,
              color: '#fff',
              fontFamily: FONTS.nunito,
              fontWeight: 900,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Revisar
          </button>
        </div>
      )}

      {acertado && (
        <div
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: RADIUS.lg,
            padding: '14px 16px',
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 16, color: COLORS.success, fontWeight: 800, margin: 0 }}>
            ✓ Eso es. 66 bloques.
          </p>
          <p style={{ fontSize: 14, color: COLORS.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
            {pistas === 0
              ? 'Y lo sacaste sin pistas.'
              : 'Lo sacaste tú. Las pistas solo te empujaron.'}
          </p>
        </div>
      )}

      {/* Las pistas se apilan, no se reemplazan: se ve cómo va bajando el andamio */}
      {PISTAS.slice(0, pistas).map((pista, i) => (
        <div
          key={i}
          style={{
            background: `${COLORS.primary}12`,
            borderLeft: `3px solid ${COLORS.primary}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 8,
            animation: 'fadeUp 0.35s ease both',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary, margin: '0 0 2px' }}>
            Pista {i + 1}
          </p>
          <p style={{ fontSize: 15, color: COLORS.text, margin: 0, lineHeight: 1.5 }}>
            {pista}
          </p>
        </div>
      ))}

      {fallo && pistas > 0 && !acertado && (
        <p style={{ fontSize: 13, color: COLORS.muted, margin: '10px 0 0', opacity: 0.8 }}>
          Sin regaños. Solo otra pista.
        </p>
      )}
    </div>
  )
}
