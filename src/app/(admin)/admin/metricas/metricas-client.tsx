'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Period = '24h' | '30d' | '3m' | '6m'

interface User {
  id: string
  email: string
  created_at: string
  onboarding_done: boolean
  education_level: string
  grade: number
  interests: string[]
  xp_total: number
  streak_days: number
  last_active_at: string | null
}

interface Subscription {
  id: string
  user_id: string
  plan: string
  status: string
  price_mxn: number
  current_period_end: string
  cancelled_at: string | null
  created_at: string
}

interface TopicProgress {
  user_id: string
  topic_id: string
  status: string
  best_score: number
  completed_at: string | null
  updated_at: string
}

interface ProgressEvent {
  user_id: string
  event_type: string
  xp_earned: number
  created_at: string
}

interface Topic {
  id: string
  name: string
  subject_id: string
  grade: number
}

interface Subject {
  id: string
  name: string
  slug: string
}

interface UserSubject {
  user_id: string
  subject_id: string
  theme_id: string
  plan_type: string
  xp: number
}

interface Props {
  allUsers: User[]
  allSubscriptions: Subscription[]
  topicProgressData: TopicProgress[]
  progressEvents: ProgressEvent[]
  allTopics: Topic[]
  allSubjects: Subject[]
  userSubjects: UserSubject[]
  timestamps: { last24h: string; last30d: string; last3m: string; last6m: string }
}

const PERIOD_LABELS: Record<Period, string> = {
  '24h': 'Últimas 24h',
  '30d': 'Este mes',
  '3m': 'Este trimestre',
  '6m': 'Este semestre',
}

const THEME_NAMES: Record<string, string> = {
  '8675082b-df0f-4599-b566-38fa13753120': '🎮 Videojuegos',
  '16b89743-e0d7-4fdb-81d6-cf23184d080f': '🎤 K-pop & K-dramas',
  '00ef7bf7-5fce-4dbe-9171-4bd413e59753': '⚽ Fútbol',
  '8c348606-4ea8-4914-83dd-47b8d039e5d1': '⚔️ Anime & Manga',
}

function StatCard({ label, value, sub, color = '#7c3aed' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#1a1035', border: `1px solid ${color}33`,
      borderRadius: 16, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: '#6b5fa0', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 13, fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, marginTop: 32 }}>
      {children}
    </div>
  )
}

export default function MetricasClient({ allUsers, allSubscriptions, topicProgressData, progressEvents, allTopics, allSubjects, userSubjects, timestamps }: Props) {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('30d')
  const [users, setUsers] = useState(allUsers)
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null)
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string>('')
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteUser(userId: string) {
    setDeletingUserId(userId)
    setDeleteError(null)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'Error al eliminar usuario')
        return
      }
      setUsers(prev => prev.filter(u => u.id !== userId))
      setDeleteSuccess(`Usuario eliminado correctamente`)
      setTimeout(() => setDeleteSuccess(null), 4000)
    } catch (err) {
      setDeleteError('Error de red al eliminar usuario')
    } finally {
      setDeletingUserId(null)
      setConfirmDeleteUserId(null)
      setConfirmDeleteEmail('')
    }
  }
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const periodStart = period === '24h' ? timestamps.last24h : period === '30d' ? timestamps.last30d : period === '3m' ? timestamps.last3m : timestamps.last6m
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Users
  const totalUsers = allUsers.length
  const newUsers = allUsers.filter(u => u.created_at >= periodStart).length
  const activeUsers = allUsers.filter(u => u.last_active_at && u.last_active_at >= sevenDaysAgo).length
  const onboardingDone = allUsers.filter(u => u.onboarding_done).length
  const conversionRate = totalUsers > 0 ? Math.round((onboardingDone / totalUsers) * 100) : 0

  // Subscriptions
  const activeSubs = allSubscriptions.filter(s => s.status === 'active' && new Date(s.current_period_end) > now)
  const expiringSoon = activeSubs.filter(s => {
    const daysLeft = (new Date(s.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysLeft <= 7
  })
  const cancelledSubs = allSubscriptions.filter(s => s.status === 'cancelled' && s.cancelled_at && s.cancelled_at >= periodStart)
  const newSubs = allSubscriptions.filter(s => s.created_at >= periodStart)
  const standardSubs = activeSubs.filter(s => s.plan === 'grade')
  const personalizedSubs = activeSubs.filter(s => s.plan === 'ai_personalized')

  // MRR calculation
  const mrr = activeSubs.reduce((total, sub) => {
    const monthly = sub.price_mxn / 100
    return total + monthly
  }, 0)

  const mrrStandard = standardSubs.reduce((total, sub) => total + sub.price_mxn / 100, 0)
  const mrrPersonalized = personalizedSubs.reduce((total, sub) => total + sub.price_mxn / 100, 0)

  // Topic completions
  const completedTopics = topicProgressData.filter(tp => tp.status === 'completed')
  const completedInPeriod = completedTopics.filter(tp => tp.completed_at && tp.completed_at >= periodStart)
  const perfectQuizzes = completedTopics.filter(tp => tp.best_score === 100)

  // Most completed topics
  const topicCompletionCount: Record<string, number> = {}
  completedTopics.forEach(tp => {
    topicCompletionCount[tp.topic_id] = (topicCompletionCount[tp.topic_id] ?? 0) + 1
  })
  const topTopics = Object.entries(topicCompletionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topicId, count]) => ({
      name: allTopics.find(t => t.id === topicId)?.name ?? 'Desconocido',
      subject: allSubjects.find(s => s.id === allTopics.find(t => t.id === topicId)?.subject_id)?.name ?? '',
      count,
    }))

  // Most popular themes
  const themeCount: Record<string, number> = {}
  userSubjects.forEach(us => {
    if (us.theme_id) themeCount[us.theme_id] = (themeCount[us.theme_id] ?? 0) + 1
  })
  const topThemes = Object.entries(themeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([themeId, count]) => ({ name: THEME_NAMES[themeId] ?? themeId, count }))

  // Education level distribution
  const levelCount: Record<string, number> = {}
  allUsers.forEach(u => {
    if (u.education_level) levelCount[u.education_level] = (levelCount[u.education_level] ?? 0) + 1
  })

  // XP events in period
  const xpEvents = progressEvents.filter(e => e.created_at >= periodStart && e.xp_earned > 0)
  const totalXpAwarded = xpEvents.reduce((sum, e) => sum + e.xp_earned, 0)
  const quizAnswers = progressEvents.filter(e => e.event_type === 'quiz_answered' && e.created_at >= periodStart)
  const correctAnswers = progressEvents.filter(e => e.event_type === 'quiz_answered' && e.xp_earned > 0 && e.created_at >= periodStart)
  const accuracy = quizAnswers.length > 0 ? Math.round((correctAnswers.length / quizAnswers.length) * 100) : 0

  const gridCols = isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)'
  const grid3Cols = isDesktop ? 'repeat(3, 1fr)' : '1fr'

  return (
    <div style={{ maxWidth: isDesktop ? 1100 : '100%', margin: '0 auto', padding: isDesktop ? '32px 48px 80px' : '24px 16px 80px', fontFamily: 'var(--font-nunito)', color: '#e2d9f3' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1035', border: '1px solid #2D2048', cursor: 'pointer', color: '#a78bfa', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>
        <div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 20, fontWeight: 900, color: '#e2d9f3' }}>📊 Métricas</div>
          <div style={{ fontSize: 13, color: '#a78bfa' }}>Datos en tiempo real desde Supabase</div>
        </div>
      </div>

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            style={{
              padding: '8px 16px', borderRadius: 50, fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'var(--font-nunito)',
              background: period === p ? '#7c3aed' : '#1a1035',
              color: period === p ? 'white' : '#a78bfa',
              border: period === p ? 'none' : '1px solid #2D2048',
            }}
          >{PERIOD_LABELS[p]}</button>
        ))}
      </div>

      {/* MRR */}
      <SectionTitle>💰 Ingresos</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="MRR Total" value={`$${Math.round(mrr).toLocaleString('es-MX')}`} sub={`${activeSubs.length} suscriptores activos`} color="#10b981" />
        <StatCard label="MRR Estándar" value={`$${Math.round(mrrStandard).toLocaleString('es-MX')}`} sub={`${standardSubs.length} suscriptores`} color="#06b6d4" />
        <StatCard label="MRR Personalizado" value={`$${Math.round(mrrPersonalized).toLocaleString('es-MX')}`} sub={`${personalizedSubs.length} suscriptores`} color="#ec4899" />
        <StatCard label="Ingresos nuevos" value={`$${Math.round(newSubs.reduce((sum, s) => sum + s.price_mxn / 100, 0)).toLocaleString('es-MX')}`} sub={`${newSubs.length} nuevas · ${PERIOD_LABELS[period]}`} color="#fbbf24" />
      </div>

      {/* Subscriptions */}
      <SectionTitle>💳 Suscripciones</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="Activas total" value={activeSubs.length} color="#10b981" />
        <StatCard label="Por vencer (7 días)" value={expiringSoon.length} sub="Necesitan renovar pronto" color="#fbbf24" />
        <StatCard label="Canceladas" value={cancelledSubs.length} sub={PERIOD_LABELS[period]} color="#ef4444" />
        <StatCard label="Churn rate" value={`${activeSubs.length > 0 ? Math.round((cancelledSubs.length / activeSubs.length) * 100) : 0}%`} sub={PERIOD_LABELS[period]} color="#f87171" />
      </div>

      {/* Plan breakdown table */}
      <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Desglose por plan</div>
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Estándar activos', value: standardSubs.length, color: '#06b6d4' },
            { label: 'Personalizado activos', value: personalizedSubs.length, color: '#ec4899' },
            { label: 'Estándar cancelados', value: allSubscriptions.filter(s => s.status === 'cancelled' && s.plan === 'grade' && s.cancelled_at && s.cancelled_at >= periodStart).length, color: '#6b7280' },
            { label: 'Personalizado cancelados', value: allSubscriptions.filter(s => s.status === 'cancelled' && s.plan === 'ai_personalized' && s.cancelled_at && s.cancelled_at >= periodStart).length, color: '#6b7280' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: '12px', background: '#0f0a1e', borderRadius: 12 }}>
              <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 24, fontWeight: 900, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Users */}
      <SectionTitle>👥 Usuarios</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="Total usuarios" value={totalUsers} color="#7c3aed" />
        <StatCard label="Nuevos" value={newUsers} sub={PERIOD_LABELS[period]} color="#a78bfa" />
        <StatCard label="Activos (7 días)" value={activeUsers} sub="Con actividad reciente" color="#10b981" />
        <StatCard label="Completaron onboarding" value={`${conversionRate}%`} sub={`${onboardingDone} de ${totalUsers}`} color="#fbbf24" />
      </div>

      {/* Education level distribution */}
      <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Distribución por nivel educativo</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(levelCount).map(([level, count]) => {
            const pct = Math.round((count / totalUsers) * 100)
            const labels: Record<string, string> = { middle_school: '📚 Secundaria', high_school: '🎓 Preparatoria', exam_prepa: '📝 Examen Prepa', exam_uni: '🏛️ Examen Universidad' }
            return (
              <div key={level}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: '#e2d9f3', fontWeight: 600 }}>{labels[level] ?? level}</span>
                  <span style={{ fontSize: 14, color: '#a78bfa', fontWeight: 700 }}>{count} ({pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #ec4899)', borderRadius: 99 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Learning */}
      <SectionTitle>📚 Aprendizaje</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="Topics completados" value={completedInPeriod.length} sub={PERIOD_LABELS[period]} color="#10b981" />
        <StatCard label="Quizzes perfectos" value={perfectQuizzes.length} sub="Score 100%" color="#fbbf24" />
        <StatCard label="Precisión quiz" value={`${accuracy}%`} sub={`${correctAnswers.length}/${quizAnswers.length} correctas`} color="#06b6d4" />
        <StatCard label="XP otorgado" value={totalXpAwarded.toLocaleString('es-MX')} sub={PERIOD_LABELS[period]} color="#a78bfa" />
      </div>

      {/* Top topics + themes */}
      <div style={{ display: 'grid', gridTemplateColumns: grid3Cols, gap: 16, marginTop: 8 }}>

        {/* Top topics */}
        <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px', gridColumn: isDesktop ? 'span 2' : 'span 1' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🏆 Topics más completados</div>
          {topTopics.length === 0 ? (
            <div style={{ color: '#6b5fa0', fontSize: 14 }}>Sin datos aún</div>
          ) : topTopics.map((t, i) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topTopics.length - 1 ? '1px solid rgba(124,58,237,0.1)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: '#7c3aed', width: 24, textAlign: 'center' }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2d9f3' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#a78bfa' }}>{t.subject}</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 50, padding: '2px 10px', fontSize: 13, fontWeight: 800, color: '#10b981' }}>{t.count}</div>
            </div>
          ))}
        </div>

        {/* Top themes */}
        <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🎮 Temáticas populares</div>
          {topThemes.length === 0 ? (
            <div style={{ color: '#6b5fa0', fontSize: 14 }}>Sin datos aún</div>
          ) : topThemes.map((t, i) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topThemes.length - 1 ? '1px solid rgba(124,58,237,0.1)' : 'none' }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#e2d9f3' }}>{t.name}</div>
              <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 50, padding: '2px 10px', fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{t.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning Zone */}
      <div style={{ marginTop: 40 }}>
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 16, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 14, fontWeight: 900, color: '#ef4444', letterSpacing: 1 }}>
              WARNING ZONE
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 20, lineHeight: 1.6 }}>
            Eliminar un usuario borra permanentemente todo su contenido — suscripciones, progreso, secciones personalizadas y datos de autenticación. Esta acción no se puede deshacer.
          </div>

          {deleteSuccess && (
            <div style={{
              padding: '10px 14px', background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10,
              color: '#10b981', fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>
              ✓ {deleteSuccess}
            </div>
          )}

          {deleteError && (
            <div style={{
              padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
              color: '#fca5a5', fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: '#1a1035',
                border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2d9f3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email ?? u.id}
                  </div>
                  <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>
                    {u.education_level ?? 'sin nivel'} · {u.onboarding_done ? 'onboarding ✓' : 'sin onboarding'} · creado {new Date(u.created_at).toLocaleDateString('es-MX')}
                  </div>
                  <div style={{ fontSize: 11, color: '#4B3D6E', marginTop: 1, fontFamily: 'monospace' }}>
                    {u.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteUserId(u.id)
                    setConfirmDeleteEmail(u.id)
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', borderRadius: 8, padding: '6px 12px',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)', flexShrink: 0,
                  }}
                >
                  🗑️ Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDeleteUserId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#1a1035', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>
              ¿Eliminar usuario?
            </div>
            <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 8, lineHeight: 1.6 }}>
              UUID: <span style={{ fontFamily: 'monospace', color: '#e2d9f3' }}>{confirmDeleteUserId}</span>
            </div>
            <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 24, lineHeight: 1.6 }}>
              Se borrará todo — suscripciones, progreso, secciones personalizadas y cuenta de autenticación. No hay vuelta atrás.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { setConfirmDeleteUserId(null); setConfirmDeleteEmail('') }}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048',
                  color: '#a78bfa', borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(confirmDeleteUserId)}
                disabled={deletingUserId !== null}
                style={{
                  background: '#ef4444', color: 'white', borderRadius: 12,
                  padding: '10px 20px', fontWeight: 800, border: 'none',
                  cursor: deletingUserId ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontFamily: 'var(--font-nunito)',
                  opacity: deletingUserId ? 0.7 : 1,
                }}
              >
                {deletingUserId ? 'Eliminando...' : 'Sí, eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}
