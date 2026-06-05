'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface TopicRequest {
  id: string
  topic_name: string
  description: string | null
  subject_name: string
  grade: number
  education_level: string
  status: string
  created_at: string
  users: { full_name: string | null; email: string } | null
}

interface SubjectRequest {
  id: string
  subject_name: string
  grade: number
  education_level: string
  description: string | null
  status: string
  created_at: string
  users: { full_name: string | null; email: string } | null
}

interface BugReport {
  id: string
  page_url: string | null
  description: string
  status: string
  created_at: string
  users: { full_name: string | null; email: string } | null
}

interface Props {
  topicRequests: TopicRequest[]
  subjectRequests: SubjectRequest[]
  bugReports: BugReport[]
}

const LEVEL_LABELS: Record<string, string> = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria',
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)', label: '⏳ Pendiente' },
  reviewed: { bg: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: 'rgba(6,182,212,0.3)', label: '👀 Revisado' },
  added: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: '✅ Agregado' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.3)', label: '❌ Rechazado' },
  new: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)', label: '🆕 Nuevo' },
  reviewing: { bg: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: 'rgba(6,182,212,0.3)', label: '👀 Revisando' },
  resolved: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: '✅ Resuelto' },
}

type TabKey = 'topics' | 'subjects' | 'bugs'

export default function NotificacionesClient({ topicRequests, subjectRequests, bugReports }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('topics')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const pendingTopics = topicRequests.filter(r => r.status === 'pending').length
  const pendingSubjects = subjectRequests.filter(r => r.status === 'pending').length
  const newBugs = bugReports.filter(r => r.status === 'new').length
  const totalPending = pendingTopics + pendingSubjects + newBugs

  async function updateStatus(table: string, id: string, status: string) {
    setUpdatingId(id)
    const supabase = createClient()
    await supabase.from(table).update({ status }).eq('id', id)
    setUpdatingId(null)
    router.refresh()
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const TABS: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: 'topics', label: '📖 Temas', count: pendingTopics, color: '#7c3aed' },
    { key: 'subjects', label: '📚 Materias', count: pendingSubjects, color: '#ec4899' },
    { key: 'bugs', label: '🐛 Errores', count: newBugs, color: '#ef4444' },
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
            📩 Notificaciones
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 2 }}>
            {topicRequests.length + subjectRequests.length + bugReports.length} total
            {totalPending > 0 && (
              <span style={{ marginLeft: 8, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', borderRadius: 50, padding: '1px 8px', fontSize: 12, fontWeight: 800 }}>
                {totalPending} pendientes
              </span>
            )}
          </div>
        </div>
      </div>

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

      {/* ── TEMAS ── */}
      {activeTab === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {topicRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#a78bfa' }}>No hay solicitudes de temas aún.</div>
          ) : topicRequests.map(req => {
            const s = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending
            return (
              <div key={req.id} style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                      📖 Tema solicitado
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>{req.topic_name}</div>
                    <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 6 }}>
                      {LEVEL_LABELS[req.education_level] ?? req.education_level} {req.grade}° — <strong style={{ color: '#e2d9f3' }}>{req.subject_name}</strong>
                    </div>
                    {req.description && (
                      <div style={{ fontSize: 13, color: '#c4b5fd', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        {req.description}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>
                      {req.users?.full_name ?? 'Usuario'} · {req.users?.email} · {formatDate(req.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 50, padding: '3px 10px', border: `1px solid ${s.border}`, background: s.bg, color: s.color }}>{s.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {req.status !== 'added' && (
                        <button type="button" onClick={() => updateStatus('topic_requests', req.id, 'added')} disabled={updatingId === req.id}
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                          ✅ Agregado
                        </button>
                      )}
                      {req.status === 'pending' && (
                        <button type="button" onClick={() => updateStatus('topic_requests', req.id, 'rejected')} disabled={updatingId === req.id}
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                          ❌ Rechazar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MATERIAS ── */}
      {activeTab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subjectRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#a78bfa' }}>No hay solicitudes de materias aún.</div>
          ) : subjectRequests.map(req => {
            const s = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending
            return (
              <div key={req.id} style={{ background: '#1a1035', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ec4899', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                      📚 Materia solicitada
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>{req.subject_name}</div>
                    <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 6 }}>
                      {LEVEL_LABELS[req.education_level] ?? req.education_level} {req.grade}°
                    </div>
                    {req.description && (
                      <div style={{ fontSize: 13, color: '#c4b5fd', background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        {req.description}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>
                      {req.users?.full_name ?? 'Usuario'} · {req.users?.email} · {formatDate(req.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 50, padding: '3px 10px', border: `1px solid ${s.border}`, background: s.bg, color: s.color }}>{s.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {req.status !== 'added' && (
                        <button type="button" onClick={() => updateStatus('subject_requests', req.id, 'added')} disabled={updatingId === req.id}
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                          ✅ Agregada
                        </button>
                      )}
                      {req.status === 'pending' && (
                        <button type="button" onClick={() => updateStatus('subject_requests', req.id, 'rejected')} disabled={updatingId === req.id}
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                          ❌ Rechazar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── BUGS ── */}
      {activeTab === 'bugs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bugReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#a78bfa' }}>No hay reportes de errores aún.</div>
          ) : bugReports.map(req => {
            const s = STATUS_STYLES[req.status] ?? STATUS_STYLES.new
            return (
              <div key={req.id} style={{ background: '#1a1035', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                      🐛 Reporte de error
                    </div>
                    <div style={{ fontSize: 15, color: '#e2d9f3', marginBottom: 6, lineHeight: 1.5 }}>{req.description}</div>
                    {req.page_url && (
                      <div style={{ fontSize: 12, color: '#a78bfa', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 8px', marginBottom: 8, wordBreak: 'break-all' }}>
                        🔗 {req.page_url}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>
                      {req.users?.full_name ?? 'Usuario'} · {req.users?.email} · {formatDate(req.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 50, padding: '3px 10px', border: `1px solid ${s.border}`, background: s.bg, color: s.color }}>{s.label}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {req.status !== 'resolved' && (
                        <button type="button" onClick={() => updateStatus('bug_reports', req.id, 'resolved')} disabled={updatingId === req.id}
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                          ✅ Resuelto
                        </button>
                      )}
                      {req.status === 'new' && (
                        <button type="button" onClick={() => updateStatus('bug_reports', req.id, 'reviewing')} disabled={updatingId === req.id}
                          style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#06b6d4', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                          👀 Revisando
                        </button>
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
