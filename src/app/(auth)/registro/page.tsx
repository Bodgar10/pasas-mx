'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { registroAction, type RegistroState } from './actions'
import { trackSignup } from '@/components/posthog-events'

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
  const [googlePending, setGooglePending] = useState(false)
  const [onboardingData, setOnboardingData] = useState('')
  const [pendingPlan, setPendingPlan] = useState('')
  const [pendingDuration, setPendingDuration] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [utmData, setUtmData] = useState('')

  useEffect(() => {
    setOnboardingData(sessionStorage.getItem('pasas_onboarding') ?? '')
    setPendingPlan(sessionStorage.getItem('pasas_pending_plan') ?? '')
    setPendingDuration(sessionStorage.getItem('pasas_pending_duration') ?? '')
    setUtmData(sessionStorage.getItem('pasas_utm') ?? '')
  }, [])

  useEffect(() => {
    if (state && 'stripeUrl' in state && state.stripeUrl) {
      // Clear sessionStorage and redirect to Stripe or dashboard
      sessionStorage.removeItem('pasas_onboarding')
      sessionStorage.removeItem('pasas_pending_plan')
      sessionStorage.removeItem('pasas_pending_duration')
      sessionStorage.removeItem('pasas_pending_timestamp')
      window.location.href = state.stripeUrl
    }
  }, [state])

  async function handleGoogleSignIn() {
    setGooglePending(true)
    trackSignup('google')
    const { createClient } = await import('@/utils/supabase/client')
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
      <form action={formAction} className="space-y-4" onSubmit={() => trackSignup('email')}>
        <input type="hidden" name="onboarding_data" value={onboardingData} />
        <input type="hidden" name="pending_plan" value={pendingPlan} />
        <input type="hidden" name="pending_duration" value={pendingDuration} />
        <input type="hidden" name="utm_data" value={utmData} />
        <div className="space-y-1">
          <label
            htmlFor="full_name"
            className="block text-sm font-semibold"
            style={{ color: '#9CA3AF' }}
          >
            ¿Cómo te llamas?
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
            style={{ ...inputStyle, minHeight: '52px' }}
            placeholder="Tu nombre o apodo (el estudiante)"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="parent_name"
            className="block text-sm font-semibold"
            style={{ color: '#9CA3AF' }}
          >
            Nombre completo del adulto responsable
          </label>
          <input
            id="parent_name"
            name="parent_name"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
            style={{ ...inputStyle, minHeight: '52px' }}
            placeholder="Nombre del padre, madre o tutor"
          />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Requerido para usuarios menores de 18 años.
          </p>
        </div>

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

        {/* Checkbox T&C */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="tos_accepted"
              required
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-1 shrink-0 accent-[#7c3aed] w-4 h-4"
            />
            <span className="text-sm" style={{ color: '#a78bfa' }}>
              He leído y acepto los{' '}
              <a
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
                style={{ color: '#c4b5fd' }}
              >
                Términos y Condiciones
              </a>
              {' '}y el{' '}
              <a
                href="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
                style={{ color: '#c4b5fd' }}
              >
                Aviso de Privacidad
              </a>
              {' '}de Pasas.mx (Versión 1.0).
            </span>
          </label>

          {/* Disclaimer mayoría de edad */}
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
          >
            ⚠️ Al completar este registro, el adulto responsable declara que tiene 18 años o más, o que cuenta con autorización del padre, madre o tutor del estudiante para suscribir este servicio y proporcionar los datos personales indicados. El adulto responsable asume plena responsabilidad por el uso de la plataforma por parte del menor.
          </div>
        </div>

        {state && 'error' in state && state.error && (
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
          disabled={pending || !tosAccepted}
          className="w-full rounded-xl font-bold text-white text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundColor: tosAccepted ? '#7c3aed' : '#4B3D6E',
            minHeight: '52px',
          }}
        >
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
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
