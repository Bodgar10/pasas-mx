'use client'

import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

export type BillingCycle = 'mensual' | 'semestral' | 'anual'

interface Props {
  selected: BillingCycle
  onChange: (cycle: BillingCycle) => void
}

const OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

export function BillingCycleToggle({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          backgroundColor: COLORS.card,
          border: `1.5px solid rgba(255,255,255,0.08)`,
          borderRadius: RADIUS.xl,
          padding: 4,
          gap: 4,
          width: '100%',
          maxWidth: 380,
        }}
      >
        {OPTIONS.map(({ value, label }) => {
          const isSelected = selected === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              style={{
                flex: 1,
                minHeight: 42,
                backgroundColor: isSelected ? COLORS.primary : 'transparent',
                border: 'none',
                borderRadius: RADIUS.lg,
                fontSize: 14,
                fontWeight: 800,
                color: isSelected ? '#fff' : COLORS.muted,
                cursor: 'pointer',
                fontFamily: FONTS.nunito,
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 0 20px rgba(139,92,246,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {selected === 'semestral' && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 999,
            padding: '4px 14px',
          }}
        >
          <span style={{ fontSize: 12 }}>⭐</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.muted,
              fontFamily: FONTS.nunito,
            }}
          >
            Pago único por 6 meses — el más elegido
          </span>
        </div>
      )}

      {/*
        🔴 Aquí NO va un badge de ahorro. Había uno, con el monto escrito a
        mano: era un precio muerto de dos subidas de lista atrás y contradecía
        al "Ahorras … vs mensual" que planes/page.tsx pinta en la tarjeta,
        unos píxeles abajo y en la misma pantalla — dos ahorros distintos al
        mismo tiempo, que es el bug de s26.

        El ahorro ya se muestra por plan y por ciclo desde PLAN_DISPLAY en
        planes/page.tsx. Este toggle solo elige el ciclo; un segundo número
        aquí sería una copia que puede desincronizarse, y además tendría que
        ser un máximo entre planes —cada plan ahorra distinto— o sea un
        número que no le corresponde a nadie.

        El badge de semestral sobrevive porque no lleva cifras.
      */}
    </div>
  )
}
