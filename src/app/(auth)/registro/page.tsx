'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { registroAction, type RegistroState } from './actions'
import { trackSignup } from '@/components/posthog-events'
import ConsentimientoLegal from '@/components/legal/ConsentimientoLegal'
import Logo from '@/components/global/Logo'

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
  const [utmData, setUtmData] = useState('')
  // Default 'tutor': quien entra a /registro por URL directa, sin pasar por el
  // onboarding, cae en el caso más común y más protector. La edad real la
  // decide `birthdate` en el servidor, no este valor.
  const [registrante, setRegistrante] = useState<'tutor' | 'alumno'>('tutor')

  useEffect(() => {
    const raw = sessionStorage.getItem('pasas_onboarding') ?? ''
    setOnboardingData(raw)
    setPendingPlan(sessionStorage.getItem('pasas_pending_plan') ?? '')
    setPendingDuration(sessionStorage.getItem('pasas_pending_duration') ?? '')
    setUtmData(sessionStorage.getItem('pasas_utm') ?? '')

    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.registrante === 'alumno') setRegistrante('alumno')
      } catch {
        /* onboarding_data malformado — se queda el default 'tutor' */
      }
    }
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

  // Pantalla de verificación de email
  if (state && 'emailSent' in state && state.emailSent) {
    return (
      <div
        className="rounded-[20px] p-8 space-y-6 text-center"
        style={{ backgroundColor: '#1a1035', border: '1px solid rgba(124,58,237,0.25)' }}
      >
        <div style={{ fontSize: 48 }}>📬</div>
        <h1
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--font-orbitron)', color: '#e2d9f3' }}
        >
          Revisa tu correo
        </h1>
        <p style={{ color: '#a78bfa', fontSize: 15, lineHeight: 1.6 }}>
          Te enviamos un link de verificación a:
        </p>
        <p
          className="rounded-xl px-4 py-3 font-bold text-sm"
          style={{
            background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.2)',
            color: '#c4b5fd',
            // Los correos largos no tienen dónde cortar. `anywhere` permite el
            // salto en cualquier carácter en vez de desbordar el recuadro.
            overflowWrap: 'anywhere',
          }}
        >
          {state.email}
        </p>
        <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6 }}>
          Haz clic en el link del correo para activar tu cuenta. Revisa también tu carpeta de spam si no lo ves en unos minutos.
        </p>
        <div
          className="rounded-xl px-4 py-3 text-xs"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}
        >
          El link expira en 24 horas.
        </div>
        <VerifyButton />
      </div>
    )
  }

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

  function VerifyButton() {
    const [checking, setChecking] = useState(false)
    const [notVerified, setNotVerified] = useState(false)

    async function handleCheck() {
      setChecking(true)
      setNotVerified(false)
      try {
        const { createClient } = await import('@/utils/supabase/client')
        const supabase = createClient()
        await supabase.auth.signInWithPassword({
          email: (state as any)?.email ?? '',
          password: '',
        })
        // Si el error es "Email not confirmed" → no verificado
        // Si el error es "Invalid login credentials" → sí verificado (password vacío falla)
        // Si no hay sesión activa, verificamos directo
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email_confirmed_at) {
          window.location.href = '/dashboard'
          return
        }
        // Intentar refresh de sesión
        const { data: refreshed } = await supabase.auth.refreshSession()
        if (refreshed?.user?.email_confirmed_at) {
          window.location.href = '/dashboard'
          return
        }
        setNotVerified(true)
      } catch {
        setNotVerified(true)
      } finally {
        setChecking(false)
      }
    }

    return (
      <>
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="w-full rounded-xl font-bold text-white text-base"
          style={{
            backgroundColor: checking ? '#4B3D6E' : '#7c3aed',
            minHeight: '52px',
            border: 'none',
            cursor: checking ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-nunito)',
            transition: 'background-color 0.15s ease',
          }}
        >
          {checking ? 'Verificando...' : 'Ya verifiqué mi correo →'}
        </button>
        {notVerified && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            Aún no vemos tu verificación. Revisa tu correo — puede estar en spam o en la carpeta de "No deseado".
          </div>
        )}
      </>
    )
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
        <div className="mb-3 flex justify-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: '#7c3aed' }}
          >
            <Logo size={34} className="text-white" />
          </div>
        </div>
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
          {registrante === 'tutor'
            ? 'Aprende con lo que ya le gusta'
            : 'Aprende con lo que ya te gusta'}
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
            {registrante === 'tutor' ? '¿Cómo se llama el alumno?' : '¿Cómo te llamas?'}
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete={registrante === 'tutor' ? 'off' : 'name'}
            required
            className={inputClass}
            style={{ ...inputStyle, minHeight: '52px' }}
            placeholder={
              registrante === 'tutor'
                ? 'Nombre o apodo del estudiante'
                : 'Tu nombre o apodo'
            }
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-semibold"
            style={{ color: '#9CA3AF' }}
          >
            {registrante === 'tutor'
              ? 'Tu correo (padre, madre o tutor)'
              : 'Correo electrónico'}
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
          {registrante === 'tutor' && (
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Aquí llegarán los avisos de la cuenta y el progreso del alumno.
            </p>
          )}
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
          <ConsentimientoLegal registrante={registrante} />

          {/* Disclaimer mayoría de edad */}
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
          >
            ⚠️ Si el alumno es menor de edad, el registro lo debe realizar su padre, madre o tutor. Al completar este registro, el adulto responsable declara que tiene 18 años o más y asume plena responsabilidad por el uso de la plataforma por parte del menor.
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
