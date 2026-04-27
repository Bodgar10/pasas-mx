'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type SubscriptionStatus = 'no_subscription' | 'expired' | 'active'

interface Subject {
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

interface Props {
  profile: Profile
  subscriptionStatus: SubscriptionStatus
  subjects: Subject[]
  userSubjects: UserSubject[]
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

function xpToLevel(xp: number) {
  const level = Math.floor(xp / 500) + 1
  const current = xp % 500
  return { level, current, total: 500 }
}

export default function DashboardClient({ profile, subscriptionStatus, subjects, userSubjects }: Props) {
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

  const levelMeta = LEVEL_LABELS[profile.education_level]
  const showGrade =
    profile.education_level === 'middle_school' || profile.education_level === 'high_school'
  const themeEmoji = profile.interests[0] ? THEME_EMOJIS[profile.interests[0]] ?? '' : ''
  const showProfileSummary = !!levelMeta

  return (
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
                  fontSize: 13,
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
              <p style={{ fontSize: 14, color: '#a78bfa', margin: '0 0 4px', fontWeight: 600 }}>
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

              {/* Avatar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
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
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
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
                  <p style={{ margin: 0, fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>XP Total</p>
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
                  <p style={{ margin: 0, fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>Racha</p>
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fbbf24',
                    letterSpacing: '0.05em',
                  }}
                >
                  NIVEL {level}
                </span>
                <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
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
                    fontSize: 15,
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
                    fontSize: 14,
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
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {isExpiredBanner ? 'Renovar mi plan' : 'Ver planes →'}
                </button>
              </div>
            )}

            {/* Continue where you left off (active only) */}
            {subscriptionStatus === 'active' && (
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
                    fontSize: 11,
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
                  Matemáticas
                </p>
                <p style={{ fontSize: 13, color: '#a78bfa', margin: '0 0 16px' }}>
                  Álgebra · Ecuaciones lineales
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/guia/matematicas')}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontFamily: 'var(--font-nunito)',
                    fontSize: 15,
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
                  <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Nivel</span>
                  <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 700 }}>
                    {levelMeta.emoji} {levelMeta.label}
                  </span>
                </div>

                {/* Grade row — only for middle_school and high_school */}
                {showGrade && GRADE_LABELS[profile.grade] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Año</span>
                    <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 700 }}>
                      📅 {GRADE_LABELS[profile.grade]}
                    </span>
                  </div>
                )}

                {/* Theme row — only if interests exist */}
                {profile.interests[0] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Temática</span>
                    <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 700 }}>
                      {themeEmoji} {profile.interests[0]}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Subjects grid */}
            <div style={{ marginBottom: 16 }}>
              <p
                style={{
                  fontSize: 11,
                  color: '#a78bfa',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  margin: '0 0 12px',
                }}
              >
                {subscriptionStatus === 'active' ? 'Mis materias' : 'Materias disponibles'}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                }}
              >
                {subjects.map((subject) => {
                  const meta = SUBJECT_ICONS[subject.slug] ?? DEFAULT_SUBJECT
                  const userSub = userSubjects.find((us) => us.subject_id === subject.slug)
                  const subXp = userSub?.xp ?? 0
                  const subProgress = Math.min((subXp % 500) / 500, 1)
                  const isLocked = subscriptionStatus !== 'active'
                  const isExpiredCard = subscriptionStatus === 'expired' && subXp > 0

                  return (
                    <div
                      key={subject.slug}
                      onClick={() => {
                        if (!isLocked) router.push(`/guia/${subject.slug}`)
                      }}
                      style={{
                        position: 'relative',
                        backgroundColor: '#1a1035',
                        borderRadius: 20,
                        padding: 16,
                        cursor: isLocked ? 'default' : 'pointer',
                        opacity: isLocked ? 0.45 : 1,
                        filter: isExpiredCard ? 'grayscale(0.6)' : 'none',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        if (!isLocked) {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = 'translateY(-2px)'
                          el.style.boxShadow = `0 8px 24px ${meta.color}44`
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLocked) {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = 'translateY(0)'
                          el.style.boxShadow = 'none'
                        }
                      }}
                    >
                      {/* Lock icon */}
                      {isLocked && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            fontSize: 14,
                            zIndex: 1,
                          }}
                        >
                          🔒
                        </div>
                      )}

                      {/* Subject icon */}
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 900,
                          color: meta.color,
                          marginBottom: 10,
                          fontFamily: meta.icon.length <= 2 ? 'var(--font-orbitron)' : undefined,
                        }}
                      >
                        {meta.icon}
                      </div>

                      {/* Subject name */}
                      <p
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#e2d9f3',
                          margin: '0 0 3px',
                        }}
                      >
                        {subject.name}
                      </p>

                      {/* XP label */}
                      <p
                        style={{
                          fontSize: 12,
                          color: '#a78bfa',
                          margin: '0 0 10px',
                        }}
                      >
                        {subXp > 0 ? `${subXp} XP` : 'Sin progreso'}
                      </p>

                      {/* Progress bar */}
                      <div
                        style={{
                          width: '100%',
                          height: 4,
                          backgroundColor: '#2D2048',
                          borderRadius: 99,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${subProgress * 100}%`,
                            height: '100%',
                            backgroundColor: meta.color,
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
