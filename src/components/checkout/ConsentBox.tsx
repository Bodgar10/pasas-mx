'use client'

import { useState } from 'react'

interface ConsentBoxProps {
  priceMxn: number          // Ej. 799 (en pesos, no centavos)
  billingCycle: 'mensual' | 'semestral' | 'anual'
  nextBillingDate: Date
  onChange: (accepted: boolean) => void
}

const CYCLE_LABEL: Record<ConsentBoxProps['billingCycle'], string> = {
  mensual: 'mes',
  semestral: '6 meses',
  anual: 'año',
}

export function ConsentBox({
  priceMxn,
  billingCycle,
  nextBillingDate,
  onChange,
}: ConsentBoxProps) {
  const [checked, setChecked] = useState(false)

  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(priceMxn)

  const dateFormatted = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(nextBillingDate)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setChecked(e.target.checked)
    onChange(e.target.checked)
  }

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <p className="mb-3 text-sm text-gray-300">
        Acepto un cargo automático de{' '}
        <strong className="text-white">
          {formatted} cada {CYCLE_LABEL[billingCycle]}
        </strong>
        . Mi próximo cobro será el{' '}
        <strong className="text-white">{dateFormatted}</strong>. Puedo cancelar
        cuando quiera desde mi{' '}
        <a
          href="/perfil"
          className="text-purple-400 underline hover:text-purple-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          perfil
        </a>
        .
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500"
        />
        <span className="text-sm text-gray-300">
          Confirmo y acepto el cargo automático recurrente
        </span>
      </label>
    </div>
  )
}
