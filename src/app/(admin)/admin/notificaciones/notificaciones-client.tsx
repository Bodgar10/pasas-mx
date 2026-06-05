'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface Request {
  id: string
  topic_name: string
  description: string | null
  subject_name: string
  grade: number
  education_level: string
  status: string
  admin_notes: string | null
  created_at: string
  users: { full_name: string | null; email: string } | null
}

const LEVEL_LABELS: Record<string, string> = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria',
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.3)',  label: '⏳ Pendiente' },
  reviewed: { bg: 'rgba(6,182,212,0.1)',   color: '#06b6d4', border: 'rgba(6,182,212,0.3)',   label: '👀 Revisado' },
  added:    { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.3)',  label: '✅ Agregado' },
  rejected: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)',   label: '❌ Rechazado' },
}

export default function NotificacionesClient({ requests }: { requests: Request[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    const supabase = createClient()
    await supabase.from('topic_requests').update({ status }).eq('id', id)
    setUpdatingId(null)
    router.refresh()
  }

  return (
    <div style={{
      maxWidth: 900, margin: '0 auto',
      padding: '32px 24px', fontFamily: 'var(--font-nunito)', color: '#e2d9f3',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#1a1035', border: '1px solid #2D2048',
            cursor: 'pointer', color: '#a78bfa', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >←</button>
        <div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 20, fontWeight: 900 }}>
            📩 Solicitudes de temas
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 2 }}>
            {requests.length} solicitudes totales
            {pendingCount > 0 && (
              <span style={{
                marginLeft: 8, background: 'rgba(251,191,36,0.15)',
                border: '1px solid rgba(251,191,36,0.3)',
                color: '#fbbf24', borderRadius: 50, padding: '1px 8px',
                fontSize: 12, fontWeight: 800,
              }}>
                {pendingCount} pendientes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all', 'Todas'], ['pending', '⏳ Pendientes'], ['reviewed', '👀 Revisadas'], ['added', '✅ Agregadas'], ['rejected', '❌ Rechazadas']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              background: filter === key ? '#7c3aed' : '#1a1035',
              border: `1px solid ${filter === key ? '#7c3aed' : '#2D2048'}`,
              color: filter === key ? 'white' : '#a78bfa',
              borderRadius: 50, padding: '6px 14px',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a78bfa', fontSize: 15 }}>
          No hay solicitudes {filter !== 'all' ? 'con este filtro' : 'aún'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((req) => {
            const s = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending
            return (
              <div key={req.id} style={{
                background: '#1a1035',
                border: '1px solid rgba(124,58,237,0.2)',
                borderRadius: 16, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>
                      {req.topic_name}
                    </div>
                    <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 6 }}>
                      {LEVEL_LABELS[req.education_level] ?? req.education_level} {req.grade}° — <strong style={{ color: '#e2d9f3' }}>{req.subject_name}</strong>
                    </div>
                    {req.description && (
                      <div style={{
                        fontSize: 13, color: '#c4b5fd', lineHeight: 1.5,
                        background: 'rgba(124,58,237,0.06)',
                        border: '1px solid rgba(124,58,237,0.15)',
                        borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                      }}>
                        {req.description}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>
                      {req.users?.full_name ?? 'Usuario'} · {req.users?.email} · {new Date(req.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 800, borderRadius: 50,
                      padding: '3px 10px', border: `1px solid ${s.border}`,
                      background: s.bg, color: s.color,
                    }}>{s.label}</span>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {req.status !== 'added' && (
                        <button type="button"
                          onClick={() => updateStatus(req.id, 'added')}
                          disabled={updatingId === req.id}
                          style={{
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                            color: '#10b981', borderRadius: 8, padding: '6px 12px',
                            fontSize: 12, fontWeight: 800, cursor: 'pointer',
                            fontFamily: 'var(--font-nunito)',
                          }}>✅ Marcar agregado</button>
                      )}
                      {req.status !== 'reviewed' && req.status !== 'added' && (
                        <button type="button"
                          onClick={() => updateStatus(req.id, 'reviewed')}
                          disabled={updatingId === req.id}
                          style={{
                            background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
                            color: '#06b6d4', borderRadius: 8, padding: '6px 12px',
                            fontSize: 12, fontWeight: 800, cursor: 'pointer',
                            fontFamily: 'var(--font-nunito)',
                          }}>👀 Marcar revisado</button>
                      )}
                      {req.status !== 'rejected' && req.status !== 'added' && (
                        <button type="button"
                          onClick={() => updateStatus(req.id, 'rejected')}
                          disabled={updatingId === req.id}
                          style={{
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', borderRadius: 8, padding: '6px 12px',
                            fontSize: 12, fontWeight: 800, cursor: 'pointer',
                            fontFamily: 'var(--font-nunito)',
                          }}>❌ Rechazar</button>
                      )}
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
