'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface Topic {
  id: string
  name: string
  slug: string
  icon: string | null
  difficulty: number
  published: boolean
  display_order: number
}

interface Theme {
  id: string
  name: string
}

interface SectionCount {
  topic_id: string
  theme_id: string | null
  count: number
}

interface Props {
  subject: { id: string; name: string; slug: string }
  topics: Topic[]
  themes: Theme[]
  sectionCounts: SectionCount[]
  grade: number
  level: string
}

function getSectionCount(
  topicId: string,
  themeId: string,
  sectionCounts: SectionCount[]
): number {
  return sectionCounts.find((s) => s.topic_id === topicId && s.theme_id === themeId)?.count ?? 0
}

const LABEL_STYLE = {
  fontSize: 13,
  color: '#a78bfa',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  display: 'block',
  marginBottom: 6,
}

export default function SubjectAdminClient({
  subject,
  topics,
  themes,
  sectionCounts,
  grade,
  level,
}: Props) {
  const router = useRouter()
  const [isDesktop, setIsDesktop] = useState(false)

  // Add topic form
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [hoveredAdd, setHoveredAdd] = useState(false)
  const [topicName, setTopicName] = useState('')
  const [topicSlug, setTopicSlug] = useState('')
  const [topicDescription, setTopicDescription] = useState('')
  const [topicIcon, setTopicIcon] = useState('')
  const [topicDifficulty, setTopicDifficulty] = useState(1)
  const [topicXp, setTopicXp] = useState(100)
  const [savingTopic, setSavingTopic] = useState(false)
  const [loadingEmoji, setLoadingEmoji] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [loadingEditEmoji, setLoadingEditEmoji] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function suggestEditEmoji(name: string) {
    if (!name.trim()) return
    setLoadingEditEmoji(true)
    try {
      const res = await fetch('/api/suggest-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'topic' }),
      })
      const data = await res.json()
      if (data.emoji) setEditIcon(data.emoji)
    } catch {
    } finally {
      setLoadingEditEmoji(false)
    }
  }

  async function suggestEmoji(name: string) {
    if (!name.trim()) return
    setLoadingEmoji(true)
    try {
      const res = await fetch('/api/suggest-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'topic' }),
      })
      const data = await res.json()
      if (data.emoji) setTopicIcon(data.emoji)
    } catch {
    } finally {
      setLoadingEmoji(false)
    }
  }

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function handleEditTopic() {
    if (!editingTopic || !editName || !editSlug) return
    setSavingEdit(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('topics')
      .update({
        name: editName,
        slug: editSlug,
        icon: editIcon || null,
      })
      .eq('id', editingTopic.id)
    setSavingEdit(false)
    if (error) {
      alert('Error al editar: ' + error.message)
      return
    }
    setEditingTopic(null)
    router.refresh()
  }

  async function handleDeleteTopic(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', id)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    router.refresh()
  }

  async function handleAddTopic() {
    if (!topicName || !topicSlug) return
    setSavingTopic(true)
    const supabase = createClient()
    // Auto-calculate next display_order from existing topics
    const maxOrder = topics.reduce((max, t) => Math.max(max, t.display_order ?? 0), 0)
    const { error } = await supabase.from('topics').insert({
      subject_id: subject.id,
      name: topicName,
      slug: topicSlug,
      description: topicDescription || null,
      icon: topicIcon || null,
      grade,
      display_order: maxOrder + 1,
      difficulty: topicDifficulty,
      xp_reward: topicXp,
      is_diagnostic: false,
      published: false,
    })
    setSavingTopic(false)
    if (error) {
      if (error.message.includes('topics_slug_key') || error.message.includes('duplicate key')) {
        alert(`El tema con slug "${topicSlug}" ya existe en esta materia. Usa un slug diferente, por ejemplo: ${topicSlug}-alt`)
      } else {
        alert('Error al guardar tema: ' + error.message)
      }
      return
    }
    setTopicName('')
    setTopicSlug('')
    setTopicDescription('')
    setTopicIcon('')
    setTopicDifficulty(1)
    setTopicXp(100)
    setShowAddTopic(false)
    router.refresh()
  }

  return (
    <div
      style={{
        maxWidth: isDesktop ? 1100 : '100%',
        margin: '0 auto',
        padding: isDesktop ? '32px 48px' : '32px 16px',
        fontFamily: 'var(--font-nunito)',
        color: '#e2d9f3',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#1a1035',
            border: '1px solid #2D2048',
            cursor: 'pointer',
            color: '#a78bfa',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ←
        </button>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 20,
            fontWeight: 900,
            color: '#e2d9f3',
          }}
        >
          {subject.name}
        </div>
        <div
          style={{
            background: 'rgba(6,182,212,0.1)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 50,
            padding: '4px 10px',
            fontSize: 13,
            fontWeight: 800,
            color: '#06b6d4',
            flexShrink: 0,
          }}
        >
          Grado {grade}°
        </div>
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 15, color: '#a78bfa', marginBottom: 28 }}>
        Selecciona un tema para gestionar su contenido por temática
      </div>

      {/* Topics list */}
      {topics.length === 0 ? (
        <div
          style={{
            background: '#1a1035',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 16,
            padding: '32px 16px',
            textAlign: 'center',
            color: '#a78bfa',
            fontSize: 16,
            marginBottom: 16,
          }}
        >
          No hay temas para este grado.
        </div>
      ) : (
        topics.map((topic) => (
          <div
            key={topic.id}
            style={{
              background: '#1a1035',
              border: '1px solid rgba(124,58,237,0.15)',
              borderRadius: 16,
              padding: '14px 18px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Left: icon + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(124,58,237,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {topic.icon ?? '📚'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#e2d9f3' }}>
                {topic.name}
              </div>
            </div>

            {/* Middle: theme pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {themes.map((theme) => {
                const count = getSectionCount(topic.id, theme.id, sectionCounts)
                const hasContent = count > 0
                return (
                  <span
                    key={theme.id}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 50,
                      padding: '3px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: hasContent
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(255,255,255,0.04)',
                      border: hasContent
                        ? '1px solid rgba(16,185,129,0.3)'
                        : '1px solid rgba(124,58,237,0.15)',
                      color: hasContent ? '#10b981' : 'rgba(167,139,250,0.5)',
                    }}
                  >
                    {theme.name}
                    {hasContent ? ` ✓ ${count}` : ' —'}
                  </span>
                )
              })}
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/${subject.slug}/${topic.slug}?grade=${grade}&level=${level}`
                  )
                }
                style={{
                  background: '#7c3aed', color: 'white', border: 'none',
                  borderRadius: 10, padding: '8px 16px', fontSize: 14,
                  fontWeight: 800, fontFamily: 'var(--font-nunito)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Gestionar →
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTopic(topic)
                  setEditName(topic.name)
                  setEditSlug(topic.slug)
                  setEditIcon(topic.icon ?? '')
                }}
                style={{
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  color: '#a78bfa', borderRadius: 8, padding: '8px 10px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'var(--font-nunito)',
                }}
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(topic.id)}
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444', borderRadius: 8, padding: '8px 10px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'var(--font-nunito)',
                }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add topic button */}
      <button
        type="button"
        onClick={() => setShowAddTopic((v) => !v)}
        onMouseEnter={() => setHoveredAdd(true)}
        onMouseLeave={() => setHoveredAdd(false)}
        style={{
          width: '100%',
          minHeight: 52,
          background: hoveredAdd ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.08)',
          border: hoveredAdd
            ? '2px dashed rgba(124,58,237,0.5)'
            : '2px dashed rgba(124,58,237,0.3)',
          borderRadius: 16,
          color: '#7c3aed',
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'var(--font-nunito)',
          marginTop: 8,
          transition: 'all 0.2s',
        }}
      >
        ＋ Añadir tema
      </button>

      {/* Inline add topic form */}
      {showAddTopic && (
        <div
          style={{
            background: '#1a1035',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 16,
            padding: 20,
            marginTop: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: isDesktop ? 'grid' : 'block', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ marginBottom: isDesktop ? 0 : 12 }}>
                <label style={LABEL_STYLE}>Nombre del tema</label>
                <input
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  onBlur={(e) => {
                    if (e.target.value.trim() && !topicIcon) {
                      suggestEmoji(e.target.value.trim())
                    }
                  }}
                  placeholder="ej. Ecuaciones lineales"
                  style={{
                    width: '100%',
                    background: '#1C1033',
                    border: '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 16,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Slug</label>
                <input
                  value={topicSlug}
                  onChange={(e) => setTopicSlug(e.target.value)}
                  placeholder="ej. ecuaciones-lineales"
                  style={{
                    width: '100%',
                    background: '#1C1033',
                    border: '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 16,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Descripción</label>
              <textarea
                value={topicDescription}
                onChange={(e) => setTopicDescription(e.target.value)}
                placeholder="Breve descripción del tema"
                style={{
                  width: '100%',
                  minHeight: 60,
                  background: '#1C1033',
                  border: '1.5px solid #2D2048',
                  borderRadius: 10,
                  color: '#e2d9f3',
                  fontSize: 16,
                  padding: '8px 12px',
                  fontFamily: 'var(--font-nunito)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>
                  Ícono {loadingEmoji && (
                    <span style={{ color: '#7c3aed', fontSize: 11 }}>buscando...</span>
                  )}
                </label>
                <input
                  value={topicIcon}
                  onChange={(e) => setTopicIcon(e.target.value)}
                  placeholder={loadingEmoji ? '...' : '📚'}
                  maxLength={2}
                  style={{
                    width: '100%',
                    background: '#1C1033',
                    border: loadingEmoji
                      ? '1.5px solid rgba(124,58,237,0.5)'
                      : '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 16,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                  }}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Dificultad</label>
                <select
                  value={topicDifficulty}
                  onChange={(e) => setTopicDifficulty(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#1C1033',
                    border: '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 16,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value={1}>1 — Fácil</option>
                  <option value={2}>2 — Media</option>
                  <option value={3}>3 — Difícil</option>
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>XP reward</label>
                <input
                  type="number"
                  value={topicXp}
                  onChange={(e) => setTopicXp(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#1C1033',
                    border: '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 16,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowAddTopic(false)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid #2D2048',
                color: '#a78bfa',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'var(--font-nunito)',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddTopic}
              disabled={savingTopic}
              style={{
                background: '#7c3aed',
                color: 'white',
                borderRadius: 12,
                padding: '10px 20px',
                fontWeight: 800,
                border: 'none',
                cursor: savingTopic ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontFamily: 'var(--font-nunito)',
                opacity: savingTopic ? 0.7 : 1,
              }}
            >
              {savingTopic ? 'Guardando...' : 'Guardar tema'}
            </button>
          </div>
        </div>
      )}
      {/* Edit topic modal */}
      {editingTopic && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.85)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#1a1035',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 20, padding: 24,
            width: '100%', maxWidth: 480,
          }}>
            <div style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 15, fontWeight: 900,
              color: '#e2d9f3', marginBottom: 20,
            }}>
              ✏️ Editar tema
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{
                  fontSize: 13, color: '#a78bfa', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1,
                  display: 'block', marginBottom: 6,
                }}>Nombre</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== editingTopic.name) {
                      suggestEditEmoji(e.target.value.trim())
                    }
                  }}
                  style={{
                    width: '100%', background: '#1C1033',
                    border: '1.5px solid #2D2048', borderRadius: 10,
                    color: '#e2d9f3', fontSize: 16, padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{
                  fontSize: 13, color: '#a78bfa', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1,
                  display: 'block', marginBottom: 6,
                }}>Slug</label>
                <input
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  style={{
                    width: '100%', background: '#1C1033',
                    border: '1.5px solid #2D2048', borderRadius: 10,
                    color: '#e2d9f3', fontSize: 16, padding: '8px 12px',
                    fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{
                  fontSize: 13, color: '#a78bfa', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1,
                  display: 'block', marginBottom: 6,
                }}>
                  Ícono {loadingEditEmoji && (
                    <span style={{ color: '#7c3aed', fontSize: 11 }}>buscando...</span>
                  )}
                </label>
                <input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  maxLength={2}
                  style={{
                    width: '100%', background: '#1C1033',
                    border: loadingEditEmoji
                      ? '1.5px solid rgba(124,58,237,0.5)'
                      : '1.5px solid #2D2048',
                    borderRadius: 10, color: '#e2d9f3', fontSize: 16,
                    padding: '8px 12px', fontFamily: 'var(--font-nunito)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048',
                  color: '#a78bfa', borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'var(--font-nunito)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEditTopic}
                disabled={savingEdit}
                style={{
                  background: '#7c3aed', color: 'white', borderRadius: 12,
                  padding: '10px 20px', fontWeight: 800, border: 'none',
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontFamily: 'var(--font-nunito)',
                  opacity: savingEdit ? 0.7 : 1,
                }}
              >
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.85)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#1a1035',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 20, padding: 24,
            width: '100%', maxWidth: 400,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <div style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 15, fontWeight: 900,
              color: '#e2d9f3', marginBottom: 8,
            }}>
              ¿Eliminar tema?
            </div>
            <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 20, lineHeight: 1.6 }}>
              Esta acción no se puede deshacer. Se eliminará todo el contenido generado para este tema.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048',
                  color: '#a78bfa', borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'var(--font-nunito)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTopic(confirmDeleteId)}
                disabled={!!deletingId}
                style={{
                  background: '#ef4444', color: 'white', borderRadius: 12,
                  padding: '10px 20px', fontWeight: 800, border: 'none',
                  cursor: deletingId ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontFamily: 'var(--font-nunito)',
                  opacity: deletingId ? 0.7 : 1,
                }}
              >
                {deletingId ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
