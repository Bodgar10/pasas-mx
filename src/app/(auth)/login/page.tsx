'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { loginAction, type LoginState } from './actions'
import { createClient } from '@/utils/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

const inputStyle = {
  backgroundColor: '#1C1033',
  border: '1.5px solid #2D2048',
  color: '#e2d9f3',
}

const inputClass =
  'w-full rounded-xl px-4 text-base placeholder-[#4B3D6E] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  )
  const [googlePending, setGooglePending] = useState(false)

  async function handleGoogleSignIn() {
    setGooglePending(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div
      className="rounded-[20px] p-8 space-y-6"
      style={{
        backgroundColor: '#1a1035',
        border: '1px solid rgba(124,58,237,0.25)',
      }}
    >
      {/* Logo + Brand */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#7c3aed' }}
        >
          <span
            className="text-white text-2xl font-black"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            P
          </span>
        </div>

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
            El truco para pasar tus exámenes
          </p>
        </div>
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
            autoComplete="current-password"
            required
            className={inputClass}
            style={{ ...inputStyle, minHeight: '52px' }}
            placeholder="••••••••"
          />
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
          {pending ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: '#2D2048' }} />
        <span className="text-xs" style={{ color: '#4B3D6E' }}>
          o continúa con
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: '#2D2048' }} />
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googlePending}
        className="w-full rounded-xl flex items-center justify-center gap-3 font-semibold text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          backgroundColor: '#1C1033',
          border: '1.5px solid #2D2048',
          color: '#e2d9f3',
          minHeight: '52px',
        }}
      >
        <GoogleIcon />
        {googlePending ? 'Redirigiendo…' : 'Continuar con Google'}
      </button>

      {/* Register link */}
      <p className="text-center text-sm" style={{ color: '#6B7280' }}>
        ¿No tienes cuenta?{' '}
        <Link
          href="/registro"
          className="font-bold hover:brightness-125 transition-all"
          style={{ color: '#a78bfa' }}
        >
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}
