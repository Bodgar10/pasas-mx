'use client'

import LevelUpModal from '@/components/global/LevelUpModal'
import { xpToLevel, levelProgress } from '@/lib/gamification'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { trackCheckoutCompleted } from '@/components/posthog-events'
import { waLink } from '@/lib/contacto'

type SubscriptionStatus = 'no_subscription' | 'expired' | 'active'

interface Subject {
  id: string
  slug: string
  name: string
  display_order: number
}

interface UserSubject {
  subject_id: string
  xp: number
  theme_id: string | null
}

interface Profile {
  name: string
  xp_total: number
  streak_days: number
  education_level: string
  grade: number
  interests: string[]
}

interface LastActiveTopic {
  topicName: string
  topicSlug: string
  subjectName: string
  subjectSlug: string
}

interface Props {
  profile: Profile
  subscriptionStatus: SubscriptionStatus
  subjects: Subject[]
  userSubjects: UserSubject[]
  lastActiveTopic: LastActiveTopic | null
  isPersonalized: boolean
  trialEndsAt: string | null
  isCancelled: boolean
  periodEnd: string | null
  billingCycle: string | null
  isPaused: boolean
  pausedUntil: string | null
  levelUp?: { from: number; to: number } | null
}

const SUBJECT_ICONS: Record<string, { icon: string; color: string }> = {
  matematicas: { icon: '∑', color: '#7c3aed' },
  espanol: { icon: 'Aa', color: '#ec4899' },
  historia: { icon: '🏛', color: '#06b6d4' },
  fisica: { icon: '⚡', color: '#fbbf24' },
  quimica: { icon: '⚗', color: '#10b981' },
  biologia: { icon: '🧬', color: '#ec4899' },
  geografia: { icon: '🌎', color: '#06b6d4' },
  civica: { icon: '⚖', color: '#a78bfa' },
}
const DEFAULT_SUBJECT = { icon: '📚', color: '#7c3aed' }

const LEVEL_LABELS: Record<string, { label: string; emoji: string }> = {
  middle_school: { label: 'Secundaria', emoji: '📚' },
  high_school: { label: 'Preparatoria', emoji: '🚀' },
  'Examen de Preparatoria': { label: 'Examen de Preparatoria', emoji: '📝' },
  'Examen de Universidad': { label: 'Examen de Universidad', emoji: '🏛' },
}

const GRADE_LABELS: Record<number, string> = { 1: '1°', 2: '2°', 3: '3°' }

const THEME_EMOJIS: Record<string, string> = {
  'Videojuegos': '🎮',
  'K-pop & K-dramas': '🎤',
  'Fútbol': '⚽',
  'Anime & Manga': '⚔️',
}

export default function DashboardClient({ profile, subscriptionStatus, subjects, userSubjects, lastActiveTopic, isPersonalized, trialEndsAt, isCancelled, periodEnd, billingCycle, isPaused, pausedUntil, levelUp = null }: Props) {
  const router = useRouter()
  const { level, current, total } = xpToLevel(profile.xp_total)
  const fillPercent = Math.min((current / total) * 100, 100)

  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [showMenu, setShowMenu] = useState(false)

  // Modales de feedback
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showBugModal, setShowBugModal] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [subjectDesc, setSubjectDesc] = useState('')
  const [bugDesc, setBugDesc] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState<'subject' | 'bug' | null>(null)

  async function handleSubjectRequest() {
    if (!subjectName.trim()) return
    setFeedbackSending(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subject_request',
          subject_name: subjectName,
          grade: profile.grade,
          education_level: profile.education_level,
          description: subjectDesc,
        }),
      })
      setFeedbackSent('subject')
      setSubjectName('')
      setSubjectDesc('')
      setTimeout(() => { setShowSubjectModal(false); setFeedbackSent(null) }, 2000)
    } catch {}
    setFeedbackSending(false)
  }

  async function handleBugReport() {
    if (!bugDesc.trim()) return
    setFeedbackSending(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bug_report',
          page_url: window.location.href,
          description: bugDesc,
        }),
      })
      setFeedbackSent('bug')
      setBugDesc('')
      setTimeout(() => { setShowBugModal(false); setFeedbackSent(null) }, 2000)
    } catch {}
    setFeedbackSending(false)
  }

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-avatar-menu]')) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isExam =
    profile.education_level === 'Examen de Preparatoria' ||
    profile.education_level === 'Examen de Universidad'

  const NO_SUB_TITLE = isExam
    ? '🚀 ¡Empieza a pasar tu examen!'
    : '🚀 ¡Empieza a pasar tus materias!'
  const NO_SUB_BODY = isExam
    ? 'Activa tu plan y desbloquea tu guía de examen personalizada. Sin contrato.'
    : 'Activa tu plan y desbloquea todas tus guías de estudio. Sin contrato.'

  const EXPIRED_TITLE = '⏸ Tu plan pausó un momento'
  const EXPIRED_BODY =
    'Sin presión — tu progreso está guardado. Renueva cuando quieras y sigue donde lo dejaste.'

  const showBanner = subscriptionStatus === 'no_subscription' || subscriptionStatus === 'expired'
  const isExpiredBanner = subscriptionStatus === 'expired'

  const periodEndFormatted = periodEnd
    ? new Date(periodEnd).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && subscriptionStatus === 'active') {
      trackCheckoutCompleted('ai_personalized', 0)
      if (isPersonalized) {
        router.push('/generando')
      }
    }
  }, [isPersonalized, subscriptionStatus])

  const levelMeta = LEVEL_LABELS[profile.education_level]
  const showGrade =
    profile.education_level === 'middle_school' || profile.education_level === 'high_school'
  const themeEmoji = profile.interests[0] ? THEME_EMOJIS[profile.interests[0]] ?? '' : ''
  const showProfileSummary = !!levelMeta

  return (
    <>
    {levelUp && <LevelUpModal from={levelUp.from} to={levelUp.to} />}
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          padding: '40px 0 100px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isDesktop ? 'row' : 'column',
            gap: isDesktop ? 48 : 0,
          }}
        >
          {/* Left column: header, stats, XP bar, banner, continue card */}
          <div style={{ flex: 1, maxWidth: 420 }}>
            {/* Header */}
            <div style={{ position: 'relative', marginBottom: 28 }}>
              {/* Brand */}
              <p
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: '0.2em',
                  margin: '0 0 16px',
                  background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                PASAS.MX
              </p>

              {/* Greeting */}
              <p style={{ fontSize: 16, color: '#a78bfa', margin: '0 0 4px', fontWeight: 600 }}>
                Bienvenido de vuelta,
              </p>
              <p
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  margin: 0,
                  paddingRight: 56,
                }}
              >
                {profile.name}
              </p>

              {/* Avatar with dropdown */}
              <div
                data-avatar-menu=""
                style={{ position: 'absolute', top: 0, right: 0 }}
              >
                <div
                  onClick={() => setShowMenu(!showMenu)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 18,
                    fontWeight: 900,
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </div>

                {showMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 44,
                      right: 0,
                      background: '#1a1035',
                      border: '1.5px solid #2D2048',
                      borderRadius: 12,
                      padding: '6px',
                      minWidth: 160,
                      zIndex: 50,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); router.push('/perfil') }}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#e2d9f3',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-nunito)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2D2048')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      👤 Mi perfil
                    </button>
                    <div style={{ height: '1px', background: '#2D2048', margin: '4px 0' }} />
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#f87171',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-nunito)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2D2048')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      🚪 Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {/* XP pill */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#1a1035',
                  border: '1.5px solid rgba(251,191,36,0.4)',
                  borderRadius: 14,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>⭐</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>XP Total</p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>
                    {profile.xp_total.toLocaleString('es-MX')}
                  </p>
                </div>
              </div>

              {/* Streak pill */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#1a1035',
                  border: '1.5px solid rgba(236,72,153,0.4)',
                  borderRadius: 14,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>🔥</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Racha</p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ec4899' }}>
                    {profile.streak_days} días
                  </p>
                </div>
              </div>
            </div>

            {/* XP progress bar */}
            <div
              style={{
                backgroundColor: '#1a1035',
                border: '1.5px solid #2D2048',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fbbf24',
                    letterSpacing: '0.05em',
                  }}
                >
                  NIVEL {level}
                </span>
                <span style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600 }}>
                  {current}/{total} XP
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: '#2D2048',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${fillPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                    borderRadius: 99,
                    boxShadow: '0 0 8px #7c3aed88',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Banner cancelación */}
            {isCancelled && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.05))',
                border: '1.5px solid rgba(251,191,36,0.35)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 16,
              }}>
                <p style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15, fontWeight: 900,
                  color: '#fbbf24', margin: '0 0 6px',
                }}>
                  ⚠️ Tu suscripción está cancelada
                </p>
                <p style={{
                  fontSize: 14, color: '#fbbf24',
                  opacity: 0.85, margin: '0 0 14px',
                  lineHeight: 1.6, fontWeight: 600,
                }}>
                  Tienes acceso hasta el{' '}
                  <strong>{periodEndFormatted}</strong>.
                  Reactiva cuando quieras y sigue donde lo dejaste.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/planes')}
                  style={{
                    backgroundColor: '#fbbf24',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 20px',
                    fontSize: 14, fontWeight: 900,
                    color: '#0a0a0f',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)',
                  }}
                >
                  Renovar mi plan →
                </button>
              </div>
            )}

            {/* Trial banner */}
            {subscriptionStatus === 'active' && trialEndsAt && (() => {
              const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              if (daysLeft === 0) return null
              const cycleLabel = billingCycle === 'annual' ? 'plan anual' : billingCycle === 'semestral' ? 'plan semestral' : billingCycle === 'monthly' ? 'plan mensual' : null
              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(236,72,153,0.08))',
                  border: '1.5px solid rgba(251,191,36,0.35)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div>
                    <p style={{ margin: 0, fontFamily: 'var(--font-orbitron)', fontSize: 13, fontWeight: 900, color: '#fbbf24' }}>
                      🎯 Periodo de prueba
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: '#a78bfa', fontWeight: 600 }}>
                      Te quedan <strong style={{ color: '#fbbf24' }}>{daysLeft} día{daysLeft !== 1 ? 's' : ''}</strong> gratis{cycleLabel ? <> · luego continúa tu <strong style={{ color: '#fbbf24' }}>{cycleLabel}</strong></> : ''}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Upgrade Banner — solo para usuarios mensuales activos sin trial */}
            {subscriptionStatus === 'active' && billingCycle === 'monthly' && !trialEndsAt && !isPersonalized && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))',
                border: '1.5px solid rgba(16,185,129,0.35)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 13, fontWeight: 900,
                    color: '#10b981', margin: '0 0 4px',
                  }}>
                    💰 Ahorra $695 al año
                  </p>
                  <p style={{ fontSize: 13, color: '#a78bfa', margin: 0, lineHeight: 1.5 }}>
                    Cámbiarte al plan semestral y paga solo $133/mes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/planes')}
                  style={{
                    background: '#10b981',
                    border: 'none', borderRadius: 10,
                    padding: '8px 16px',
                    fontSize: 13, fontWeight: 900,
                    color: '#fff', cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ver semestral →
                </button>
              </div>
            )}

            {/* Pause Banner — cuando el usuario está en pausa */}
            {isPaused && pausedUntil && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))',
                border: '1.5px solid rgba(245,158,11,0.4)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 20,
              }}>
                <p style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15, fontWeight: 900,
                  color: '#f59e0b', margin: '0 0 6px',
                }}>
                  ⏸ Tu cuenta está pausada
                </p>
                <p style={{
                  fontSize: 14, color: '#fbbf24',
                  opacity: 0.85, margin: '0 0 14px',
                  lineHeight: 1.6, fontWeight: 600,
                }}>
                  Se reactiva automáticamente el{' '}
                  <strong>{new Date(pausedUntil).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                  Tu XP y progreso están guardados.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/perfil')}
                  style={{
                    backgroundColor: '#f59e0b',
                    border: 'none', borderRadius: 10,
                    padding: '10px 20px',
                    fontSize: 14, fontWeight: 900,
                    color: '#0a0a0f', cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)',
                  }}
                >
                  Reactivar ahora →
                </button>
              </div>
            )}

            {/* Support Button */}
            {subscriptionStatus === 'active' && (
              <div style={{
                background: 'rgba(124,58,237,0.04)',
                border: '1px solid rgba(124,58,237,0.15)',
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3', margin: '0 0 2px' }}>
                    ¿Necesitas ayuda?
                  </p>
                  <p style={{ fontSize: 12, color: '#a78bfa', margin: 0 }}>
                    L-V 9AM–8PM · Respondemos rápido
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={waLink('Hola, necesito ayuda con Pasas.mx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#25D366',
                      border: 'none', borderRadius: 10,
                      padding: '8px 14px',
                      fontSize: 13, fontWeight: 900,
                      color: '#fff', cursor: 'pointer',
                      textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    💬 WhatsApp
                  </a>
                  <a
                    href="mailto:soporte@pasas.mx?subject=Ayuda%20con%20Pasas.mx"
                    style={{
                      background: 'rgba(124,58,237,0.15)',
                      border: '1px solid rgba(124,58,237,0.3)',
                      borderRadius: 10,
                      padding: '8px 14px',
                      fontSize: 13, fontWeight: 900,
                      color: '#a78bfa', cursor: 'pointer',
                      textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    ✉️ Email
                  </a>
                </div>
              </div>
            )}

            {/* Personalized plan banner */}
            {isPersonalized && subscriptionStatus === 'active' && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.1))',
                border: '1.5px solid rgba(124,58,237,0.3)',
                borderRadius: 20,
                padding: '20px 16px',
                marginBottom: 24,
              }}>
                <p style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15, fontWeight: 900,
                  color: '#e2d9f3', margin: '0 0 6px',
                }}>
                  ✨ Tu plan personalizado
                </p>
                <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 14px', lineHeight: 1.6 }}>
                  Tu guía está lista con los temas que más necesitas estudiar.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/generando')}
                  style={{
                    width: '100%', minHeight: 48,
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    color: '#ffffff', border: 'none', borderRadius: 12,
                    fontFamily: 'var(--font-nunito)', fontSize: 16,
                    fontWeight: 900, cursor: 'pointer',
                  }}
                >
                  Ver mi plan personalizado →
                </button>
              </div>
            )}

            {/* Banner */}
            {showBanner && (
              <div
                style={{
                  backgroundColor: isExpiredBanner ? '#1a0f00' : '#1a1035',
                  border: `1.5px solid ${isExpiredBanner ? '#fbbf2444' : '#7c3aed55'}`,
                  borderRadius: 20,
                  padding: '20px 16px',
                  marginBottom: 24,
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 17,
                    fontWeight: 900,
                    color: isExpiredBanner ? '#fbbf24' : '#e2d9f3',
                    margin: '0 0 8px',
                    lineHeight: 1.3,
                  }}
                >
                  {isExpiredBanner ? EXPIRED_TITLE : NO_SUB_TITLE}
                </p>
                <p
                  style={{
                    fontSize: 16,
                    color: isExpiredBanner ? '#d97706' : '#a78bfa',
                    margin: '0 0 16px',
                    lineHeight: 1.6,
                  }}
                >
                  {isExpiredBanner ? EXPIRED_BODY : NO_SUB_BODY}
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/planes?plan=estandar')}
                  style={{
                    width: '100%',
                    minHeight: 52,
                    backgroundColor: isExpiredBanner ? '#fbbf24' : '#7c3aed',
                    color: isExpiredBanner ? '#0f0a1e' : '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontFamily: 'var(--font-nunito)',
                    fontSize: 17,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {isExpiredBanner ? 'Renovar mi plan' : 'Ver planes →'}
                </button>
              </div>
            )}

            {/* Continue where you left off (active only, only if there's a last topic) */}
            {subscriptionStatus === 'active' && lastActiveTopic && (
              <div
                style={{
                  backgroundColor: '#1a1035',
                  border: '1.5px solid #7c3aed44',
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: '#a78bfa',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    margin: '0 0 10px',
                  }}
                >
                  Continúa donde lo dejaste
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: '#e2d9f3',
                    margin: '0 0 4px',
                  }}
                >
                  {lastActiveTopic.subjectName}
                </p>
                <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 16px' }}>
                  {lastActiveTopic.topicName}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/guia/${lastActiveTopic.subjectSlug}/${lastActiveTopic.topicSlug}`)
                  }
                  style={{
                    width: '100%',
                    minHeight: 48,
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontFamily: 'var(--font-nunito)',
                    fontSize: 17,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Continuar →
                </button>
              </div>
            )}
          </div>

          {/* Right column: profile summary + subjects grid */}
          <div style={{ flex: 1, maxWidth: 420 }}>
            {/* Profile summary */}
            {showProfileSummary && (
              <div
                style={{
                  backgroundColor: '#1a1035',
                  border: '1.5px solid #2D2048',
                  borderRadius: 16,
                  padding: '16px 18px',
                  marginBottom: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Level row — always shown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600 }}>Nivel</span>
                  <span style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700 }}>
                    {levelMeta.emoji} {levelMeta.label}
                  </span>
                </div>

                {/* Grade row — only for middle_school and high_school */}
                {showGrade && GRADE_LABELS[profile.grade] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600 }}>Año</span>
                    <span style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700 }}>
                      📅 {GRADE_LABELS[profile.grade]}
                    </span>
                  </div>
                )}

                {/* Theme row — only if interests exist */}
                {profile.interests[0] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, color: '#a78bfa', fontWeight: 600 }}>Temática</span>
                    <span style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700 }}>
                      {themeEmoji} {profile.interests[0]}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Subjects grid */}
            <div style={{ marginBottom: 16 }}>
              <p style={{
                fontSize: 13, color: '#a78bfa', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px',
              }}>
                {isPersonalized && subscriptionStatus === 'active' ? 'Mi materia personalizada' : subscriptionStatus === 'active' ? 'Mis materias' : 'Materias disponibles'}
              </p>

              {isPersonalized && subscriptionStatus === 'active' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {userSubjects.map((us) => {
                    const subj = subjects.find(s => s.id === us.subject_id)
                    if (!subj) return null
                    const meta = SUBJECT_ICONS[subj.slug] ?? DEFAULT_SUBJECT
                    const subXp = us.xp ?? 0
                    const subProgress = levelProgress(subXp)
                    return (
                      <div
                        key={subj.slug}
                        onClick={() => router.push(`/guia/personalizado/${subj.slug}`)}
                        style={{
                          background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(236,72,153,0.08))',
                          border: '1.5px solid rgba(124,58,237,0.3)',
                          borderRadius: 20, padding: 16, cursor: 'pointer',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = 'translateY(-2px)'
                          el.style.boxShadow = '0 8px 24px rgba(124,58,237,0.25)'
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = 'translateY(0)'
                          el.style.boxShadow = 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: 'rgba(124,58,237,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, fontWeight: 900, color: meta.color,
                            fontFamily: meta.icon.length <= 2 ? 'var(--font-orbitron)' : undefined,
                          }}>
                            {meta.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, color: '#e2d9f3', marginBottom: 2 }}>
                              {subj.name}
                            </div>
                            <div style={{ fontSize: 13, color: '#ec4899', fontWeight: 700 }}>
                              ✨ Plan personalizado
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: '#a78bfa' }}>→</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>Progreso</span>
                          <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 800 }}>{subXp} XP</span>
                        </div>
                        <div style={{ width: '100%', height: 4, background: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            width: `${subProgress * 100}%`, height: '100%',
                            background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                            borderRadius: 99,
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {subjects.map((subject) => {
                    const meta = SUBJECT_ICONS[subject.slug] ?? DEFAULT_SUBJECT
                    const userSub = userSubjects.find((us) => us.subject_id === subject.id)
                    const subXp = userSub?.xp ?? 0
                    const subProgress = levelProgress(subXp)
                    const isLocked = subscriptionStatus !== 'active'
                    const isExpiredCard = subscriptionStatus === 'expired' && subXp > 0
                    return (
                      <Link
                        key={subject.slug}
                        href={isLocked ? '#' : `/guia/${subject.slug}`}
                        prefetch={!isLocked}
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          position: 'relative', backgroundColor: '#1a1035', borderRadius: 20,
                          padding: 16, cursor: isLocked ? 'default' : 'pointer',
                          opacity: isLocked ? 0.45 : 1,
                          filter: isExpiredCard ? 'grayscale(0.6)' : 'none',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease', overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          if (!isLocked) {
                            const el = e.currentTarget as HTMLAnchorElement
                            el.style.transform = 'translateY(-2px)'
                            el.style.boxShadow = `0 8px 24px ${meta.color}44`
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isLocked) {
                            const el = e.currentTarget as HTMLAnchorElement
                            el.style.transform = 'translateY(0)'
                            el.style.boxShadow = 'none'
                          }
                        }}
                      >
                        {isLocked && (
                          <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 16, zIndex: 1 }}>🔒</div>
                        )}
                        <div style={{
                          width: 32, height: 32, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 18, fontWeight: 900,
                          color: meta.color, marginBottom: 10,
                          fontFamily: meta.icon.length <= 2 ? 'var(--font-orbitron)' : undefined,
                        }}>
                          {meta.icon}
                        </div>
                        <p style={{ fontSize: 17, fontWeight: 800, color: '#e2d9f3', margin: '0 0 3px' }}>
                          {subject.name}
                        </p>
                        <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 10px' }}>
                          {subXp > 0 ? `${subXp} XP` : 'Sin progreso'}
                        </p>
                        <div style={{ width: '100%', height: 4, backgroundColor: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            width: `${subProgress * 100}%`, height: '100%',
                            backgroundColor: meta.color, borderRadius: 99,
                          }} />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          {/* Banner materia faltante */}
          {subscriptionStatus === 'active' && (
            <div style={{
              marginTop: 8,
              background: 'rgba(124,58,237,0.06)',
              border: '1px dashed rgba(124,58,237,0.3)',
              borderRadius: 16, padding: '14px 16px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              marginBottom: 10,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3', marginBottom: 2 }}>
                  ¿No encuentras tu materia?
                </div>
                <div style={{ fontSize: 12, color: '#a78bfa' }}>
                  Dinos cuál falta y la agregamos pronto.
                </div>
              </div>
              <button type="button" onClick={() => setShowSubjectModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                  color: 'white', border: 'none', borderRadius: 10,
                  padding: '8px 16px', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'var(--font-nunito)', whiteSpace: 'nowrap',
                }}>
                📩 Solicitar materia
              </button>
            </div>
          )}

          {/* Banner reportar bug */}
          <div style={{
            marginTop: 4,
            background: 'rgba(239,68,68,0.04)',
            border: '1px dashed rgba(239,68,68,0.2)',
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2d9f3', marginBottom: 2 }}>
                ¿Encontraste algún error?
              </div>
              <div style={{ fontSize: 12, color: '#a78bfa' }}>
                Repórtalo y te damos 15 días gratis.
              </div>
            </div>
            <button type="button" onClick={() => setShowBugModal(true)}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', borderRadius: 10,
                padding: '8px 16px', fontSize: 13, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'var(--font-nunito)', whiteSpace: 'nowrap',
              }}>
              🐛 Reportar error
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>

      {/* Modal materia faltante */}
      {showSubjectModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setShowSubjectModal(false)}>
          <div style={{
            background: '#1a1035', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 20, padding: 24, width: '100%', maxWidth: 440,
          }} onClick={e => e.stopPropagation()}>
            {feedbackSent === 'subject' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#10b981' }}>¡Solicitud enviada!</div>
                <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 8 }}>Lo revisamos y la agregamos pronto.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>
                  📩 Solicitar materia
                </div>
                <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
                  {profile.education_level === 'middle_school' ? 'Secundaria' : 'Preparatoria'} {profile.grade}°
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                      Nombre de la materia *
                    </label>
                    <input value={subjectName} onChange={e => setSubjectName(e.target.value)}
                      placeholder="ej. Física 2°"
                      style={{ width: '100%', background: '#1C1033', border: '1.5px solid #2D2048', borderRadius: 10, color: '#e2d9f3', fontSize: 15, padding: '10px 12px', fontFamily: 'var(--font-nunito)', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                      ¿Algo más que quieras decirnos? (opcional)
                    </label>
                    <textarea value={subjectDesc} onChange={e => setSubjectDesc(e.target.value)}
                      placeholder="ej. La vemos en tercer semestre con el prof. García"
                      rows={3}
                      style={{ width: '100%', background: '#1C1033', border: '1.5px solid #2D2048', borderRadius: 10, color: '#e2d9f3', fontSize: 15, padding: '10px 12px', fontFamily: 'var(--font-nunito)', boxSizing: 'border-box', resize: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowSubjectModal(false)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048', color: '#a78bfa', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleSubjectRequest} disabled={feedbackSending || !subjectName.trim()}
                    style={{ background: subjectName.trim() ? 'linear-gradient(135deg, #7c3aed, #ec4899)' : 'rgba(124,58,237,0.3)', color: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 800, border: 'none', cursor: (feedbackSending || !subjectName.trim()) ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'var(--font-nunito)', opacity: feedbackSending ? 0.7 : 1 }}>
                    {feedbackSending ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal reportar bug */}
      {showBugModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setShowBugModal(false)}>
          <div style={{
            background: '#1a1035', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 20, padding: 24, width: '100%', maxWidth: 440,
          }} onClick={e => e.stopPropagation()}>
            {feedbackSent === 'bug' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#10b981' }}>¡Reporte enviado!</div>
                <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 8 }}>Lo revisamos y si procede te damos 15 días gratis.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>
                  🐛 Reportar error
                </div>
                <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
                  Si encontraste un error, cuéntanos qué pasó. Si el reporte procede, te damos 15 días gratis.
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                    ¿Qué pasó? *
                  </label>
                  <textarea value={bugDesc} onChange={e => setBugDesc(e.target.value)}
                    placeholder="ej. En la materia de Matemáticas 1°, el tema 'Álgebra' no carga el contenido"
                    rows={4}
                    style={{ width: '100%', background: '#1C1033', border: '1.5px solid #2D2048', borderRadius: 10, color: '#e2d9f3', fontSize: 15, padding: '10px 12px', fontFamily: 'var(--font-nunito)', boxSizing: 'border-box', resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowBugModal(false)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048', color: '#a78bfa', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleBugReport} disabled={feedbackSending || !bugDesc.trim()}
                    style={{ background: bugDesc.trim() ? '#ef4444' : 'rgba(239,68,68,0.3)', color: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 800, border: 'none', cursor: (feedbackSending || !bugDesc.trim()) ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'var(--font-nunito)', opacity: feedbackSending ? 0.7 : 1 }}>
                    {feedbackSending ? 'Enviando...' : 'Enviar reporte'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
