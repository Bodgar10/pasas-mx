'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { registroAction, type RegistroState } from './actions'

const inputStyle = {
  backgroundColor: '#1C1033',
  border: '1.5px solid #2D2048',
  color: '#e2d9f3',
}

const inputClass =
  'w-full rounded-xl px-4 text-base placeholder-[#4B3D6E] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all'

const INTEREST_TAGS = [
  { label: 'K-pop',       bg: '#2e1065', color: '#a78bfa' },
  { label: 'Videojuegos', bg: '#052e16', color: '#4ade80' },
  { label: 'F1',          bg: '#451a03', color: '#fbbf24' },
  { label: 'Anime',       bg: '#2e1065', color: '#c084fc' },
]

function StrengthBar({ password }: { password: string }) {
  const len = password.length
  const level = len === 0 ? 0 : len < 3 ? 1 : len < 6 ? 2 : 3
  const widths = ['0%', '30%', '65%', '100%']
  const colors = ['#7c3aed', '#ef4444', '#f59e0b', '#7c3aed']

  return (
    <div
      className="mt-2 h-1.5 rounded-full overflow-hidden"
      style={{ backgroundColor: '#2D2048' }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: widths[level], backgroundColor: colors[level] }}
      />
    </div>
  )
}

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState<RegistroState, FormData>(
    registroAction,
    null
  )
  const [password, setPassword] = useState('')

  return (
    <div
      className="rounded-[20px] p-8 space-y-6"
      style={{
        backgroundColor: '#1a1035',
        border: '1px solid rgba(124,58,237,0.25)',
      }}
    >
      {/* Brand */}
      <div className="text-center">
        <h1
          className="text-2xl font-black tracking-widest uppercase"
          style={{ fontFamily: 'var(--font-orbitron)' }}
        >
          <span className="text-white">Pa</span>
          <span style={{ color: '#a78bfa' }}>s</span>
          <span className="text-white">a</span>
          <span style={{ color: '#a78bfa' }}>s</span>
          <span className="text-white">.mx</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6B7280' }}>
          Aprende con lo que ya te gusta
        </p>
      </div>

      {/* Interest tags */}
      <div className="flex flex-wrap gap-2 justify-center">
        {INTEREST_TAGS.map((tag) => (
          <span
            key={tag.label}
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: tag.bg, color: tag.color }}
          >
            {tag.label}
          </span>
        ))}
      </div>

      {/* Form */}
      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-semibold"
            style={{ color: '#9CA3AF' }}
          >
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
            style={{ ...inputStyle, minHeight: '52px' }}
            placeholder="tu@correo.com"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-semibold"
            style={{ color: '#9CA3AF' }}
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            style={{ ...inputStyle, minHeight: '52px' }}
            placeholder="Mínimo 6 caracteres"
          />
          <StrengthBar password={password} />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl font-bold text-white text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundColor: '#7c3aed',
            minHeight: '52px',
          }}
        >
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      {/* XP welcome badge */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: '#0d0b24',
          border: '1px solid #1e1b4b',
        }}
      >
        <span className="text-xl shrink-0" aria-hidden="true">⭐</span>
        <div>
          <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>
            +100 XP de bienvenida
          </p>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Al completar tu perfil hoy
          </p>
        </div>
      </div>

      {/* Login link */}
      <p className="text-center text-sm" style={{ color: '#6B7280' }}>
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="font-bold hover:brightness-125 transition-all"
          style={{ color: '#a78bfa' }}
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
