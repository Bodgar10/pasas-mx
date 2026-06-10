'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CancellationReason {
  id: string
  reason_category: string
  reason_detail: string | null
  pause_offered: boolean | null
  pause_accepted: boolean | null
  created_at: string
  users: { full_name: string | null; email: string } | null
  subscriptions: { plan: string | null; billing_cycle: string | null } | null
}

interface PauseRecord {
  id: string
  plan: string
  billing_cycle: string | null
  paused_at: string
  paused_until: string | null
  pause_count_lifetime: number | null
  status: string
  users: { full_name: string | null; email: string } | null
}

interface Props {
  cancellations: CancellationReason[]
  pauses: PauseRecord[]
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  precio:              { label: 'Precio muy alto',       emoji: '💸', color: '#ef4444' },
  no_la_uso:           { label: 'No la uso',             emoji: '😴', color: '#f59e0b' },
  mi_hijo_no_quiso:    { label: 'Mi hijo no quiso',      emoji: '🧒', color: '#ec4899' },
  encontre_algo_mejor: { label: 'Encontré algo mejor',   emoji: '🔄', color: '#06b6d4' },
  falla_tecnica:       { label: 'Falla técnica',         emoji: '🐛', color: '#8b5cf6' },
  vacaciones:          { label: 'Vacaciones',            emoji: '🏖️', color: '#10b981' },
  otro:                { label: 'Otro',                  emoji: '💬', color: '#a78bfa' },
}

const PLAN_LABELS: Record<string, string> = {
  grade: 'Estándar',
  ai_personalized: 'Personalizado',
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  semestral: 'Semestral',
  annual: 'Anual',
}

type TabKey = 'cancellations' | 'pauses'

export default function InsightsClient({ cancellations, pauses }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('cancellations')

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatDateFull(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Stats cancelaciones
  const categoryCounts = cancellations.reduce<Record<string, number>>((acc, c) => {
    acc[c.reason_category] = (acc[c.reason_category] ?? 0) + 1
    return acc
  }, {})
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]
  const pauseAccepted = cancellations.filter(c => c.pause_accepted).length
  const pauseOffered = cancellations.filter(c => c.pause_offered).length

  // Stats pausas
  const activePauses = pauses.filter(p => p.paused_until && new Date(p.paused_until) > new Date()).length
  const totalPauses = pauses.length

  const TABS = [
    { key: 'cancellations' as TabKey, label: '📉 Cancelaciones', count: cancellations.length, color: '#ef4444' },
    { key: 'pauses' as TabKey, label: '⏸ Pausas', count: activePauses, color: '#f59e0b' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--font-nunito)', color: '#e2d9f3' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button type="button" onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1035', border: '1px solid #2D2048', cursor: 'pointer', color: '#a78bfa', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ←
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 20, fontWeight: 900 }}>
            📊 Insights
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 2 }}>
            Cancelaciones y pausas
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#1a1035', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total cancelaciones</div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 28, fontWeight: 900, color: '#ef4444' }}>{cancellations.length}</div>
        </div>
        {topCategory && (
          <div style={{ background: '#1a1035', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Razón #1</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24' }}>
              {CATEGORY_LABELS[topCategory[0]]?.emoji} {CATEGORY_LABELS[topCategory[0]]?.label}
            </div>
            <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>{topCategory[1]} veces</div>
          </div>
        )}
        <div style={{ background: '#1a1035', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Pausas aceptadas</div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 28, fontWeight: 900, color: '#10b981' }}>{pauseAccepted}</div>
          <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>de {pauseOffered} ofrecidas</div>
        </div>
        <div style={{ background: '#1a1035', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Pausas activas</div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{activePauses}</div>
          <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>de {totalPauses} totales</div>
        </div>
      </div>

      {/* Breakdown por categoría */}
      {activeTab === 'cancellations' && cancellations.length > 0 && (
        <div style={{ background: '#1a1035', border: '1px solid #2D2048', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Breakdown por razón</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
              const meta = CATEGORY_LABELS[cat] ?? { label: cat, emoji: '❓', color: '#a78bfa' }
              const pct = Math.round((count / cancellations.length) * 100)
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#e2d9f3', fontWeight: 600 }}>{meta.emoji} {meta.label}</span>
                    <span style={{ fontSize: 13, color: '#a78bfa' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: meta.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? tab.color : '#1a1035',
              border: `1px solid ${activeTab === tab.key ? tab.color : '#2D2048'}`,
              color: activeTab === tab.key ? 'white' : '#a78bfa',
              borderRadius: 50, padding: '8px 16px',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {tab.label}
            {tab.count > 0 && (
              <span style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(251,191,36,0.2)', color: activeTab === tab.key ? 'white' : '#fbbf24', borderRadius: 50, padding: '0 6px', fontSize: 11, fontWeight: 900 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── CANCELACIONES ── */}
      {activeTab === 'cancellations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cancellations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#a78bfa' }}>No hay cancelaciones aún. Buena señal 🎉</div>
          ) : cancellations.map(c => {
            const meta = CATEGORY_LABELS[c.reason_category] ?? { label: c.reason_category, emoji: '❓', color: '#a78bfa' }
            return (
              <div key={c.id} style={{ background: '#1a1035', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: meta.color }}>{meta.emoji} {meta.label}</span>
                      {c.subscriptions?.plan && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', borderRadius: 50, padding: '2px 8px' }}>
                          {PLAN_LABELS[c.subscriptions.plan] ?? c.subscriptions.plan} · {CYCLE_LABELS[c.subscriptions.billing_cycle ?? ''] ?? c.subscriptions.billing_cycle}
                        </span>
                      )}
                    </div>
                    {c.reason_detail && (
                      <div style={{ fontSize: 13, color: '#c4b5fd', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
                        "{c.reason_detail}"
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                      {c.pause_offered !== null && (
                        <span style={{ fontSize: 12, color: c.pause_accepted ? '#10b981' : '#a78bfa' }}>
                          {c.pause_accepted ? '✅ Aceptó pausa' : c.pause_offered ? '❌ Rechazó pausa' : '— No se ofreció pausa'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>
                      {c.users?.full_name ?? 'Usuario'} · {c.users?.email} · {formatDate(c.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── PAUSAS ── */}
      {activeTab === 'pauses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pauses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#a78bfa' }}>No hay pausas registradas aún.</div>
          ) : pauses.map(p => {
            const isActive = p.paused_until && new Date(p.paused_until) > new Date()
            return (
              <div key={p.id} style={{ background: '#1a1035', border: `1px solid ${isActive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: isActive ? '#f59e0b' : '#a78bfa' }}>
                        {isActive ? '⏸ Pausa activa' : '✅ Pausa finalizada'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', borderRadius: 50, padding: '2px 8px' }}>
                        {PLAN_LABELS[p.plan] ?? p.plan} · {CYCLE_LABELS[p.billing_cycle ?? ''] ?? p.billing_cycle}
                      </span>
                      {(p.pause_count_lifetime ?? 0) > 1 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 50, padding: '2px 8px' }}>
                          {p.pause_count_lifetime}x pausas
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 4 }}>
                      Pausado: <strong style={{ color: '#e2d9f3' }}>{formatDateFull(p.paused_at)}</strong>
                      {p.paused_until && (
                        <> → Hasta: <strong style={{ color: isActive ? '#f59e0b' : '#e2d9f3' }}>{formatDateFull(p.paused_until)}</strong></>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>
                      {p.users?.full_name ?? 'Usuario'} · {p.users?.email}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
