'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

interface Subject {
  id: string
  name: string
  slug: string
  education_level: string
  grades: number[]
  icon: string | null
  display_order: number
}

interface Props {
  subjects: Subject[]
}

type SelectedLevel = 'middle_school' | 'high_school' | 'exam_prepa' | 'exam_uni' | null

const LEVEL_LABELS: Record<string, string> = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria',
  exam_prepa: 'Examen de Prepa',
  exam_uni: 'Examen de Universidad',
}

const GRADE_LABELS: Record<number, string> = { 1: '1°', 2: '2°', 3: '3°' }

const LABEL_STYLE = {
  fontFamily: 'var(--font-orbitron)',
  fontSize: 12,
  color: '#a78bfa',
  textTransform: 'uppercase' as const,
  letterSpacing: 2,
  marginBottom: 12,
  display: 'block',
}

const LEVEL_BUTTONS = [
  { key: 'middle_school', label: '🏫 Secundaria' },
  { key: 'high_school', label: '🎓 Preparatoria' },
  { key: 'exam_prepa', label: '📝 Examen de Prepa' },
  { key: 'exam_uni', label: '🏛️ Examen de Universidad' },
] as const

export default function AdminHomeClient({ subjects }: Props) {
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel>(null)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  // Add subject form
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [hoveredAdd, setHoveredAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)
  const [loadingEmoji, setLoadingEmoji] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
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
        body: JSON.stringify({ name, type: 'subject' }),
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
        body: JSON.stringify({ name, type: 'subject' }),
      })
      const data = await res.json()
      if (data.emoji) setNewIcon(data.emoji)
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

  const isExamLevel = selectedLevel === 'exam_prepa' || selectedLevel === 'exam_uni'

  const filteredSubjects =
    selectedLevel === null
      ? []
      : isExamLevel
      ? subjects.filter((s) => s.education_level === 'high_school')
      : selectedGrade !== null
      ? subjects.filter(
          (s) => s.education_level === selectedLevel && s.grades.includes(selectedGrade)
        )
      : []

  const showSubjectsSection =
    selectedLevel !== null && (isExamLevel || selectedGrade !== null)

  function handleLevelSelect(level: Exclude<SelectedLevel, null>) {
    setSelectedLevel(level)
    setSelectedGrade(null)
    setShowAddSubject(false)
  }

  async function handleEditSubject() {
    if (!editingSubject || !editName || !editSlug) return
    setSavingEdit(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('subjects')
      .update({ name: editName, slug: editSlug, icon: editIcon || null })
      .eq('id', editingSubject.id)
    setSavingEdit(false)
    if (error) {
      alert('Error al guardar: ' + error.message)
      return
    }
    setEditingSubject(null)
    router.refresh()
  }

  async function handleDeleteSubject() {
    if (!confirmDeleteId) return
    setDeletingId(confirmDeleteId)
    const supabase = createClient()

    const { error } = await supabase.from('subjects').delete().eq('id', confirmDeleteId)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }

    router.refresh()
  }

  async function handleAddSubject() {
    if (!newName || !newSlug || selectedLevel === null) return
    setSavingSubject(true)
    const supabase = createClient()
    const educationLevel =
      selectedLevel === 'middle_school' ? 'middle_school' : 'high_school'
    const newGrades = isExamLevel
      ? [1, 2, 3]
      : selectedGrade !== null
      ? [selectedGrade]
      : [1]

    const maxOrder = subjects.reduce((max, s) => Math.max(max, s.display_order ?? 0), 0)
    const { error } = await supabase.from('subjects').insert({
      name: newName,
      slug: newSlug,
      education_level: educationLevel,
      grades: newGrades,
      plan_types: ['grade', 'exam'],
      icon: newIcon || null,
      display_order: maxOrder + 1,
    })
    setSavingSubject(false)
    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('subjects_slug_key')) {
        alert(`Ya existe una materia con el slug "${newSlug}". Usa un slug diferente, por ejemplo: ${newSlug}-2`)
      } else {
        alert('Error al guardar: ' + error.message)
      }
      return
    }

    setNewName('')
    setNewSlug('')
    setNewIcon('')
    setShowAddSubject(false)
    router.refresh()
  }

  const gradeParam = isExamLevel ? 1 : (selectedGrade ?? 1)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 24,
            fontWeight: 900,
            color: '#e2d9f3',
          }}
        >
          ⚙️ Panel Admin
        </div>
        <div style={{ fontSize: 15, color: '#a78bfa', marginLeft: 8 }}>
          Gestión de contenido
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => router.push('/admin/metricas')}
            style={{
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            📊 Métricas
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/notificaciones')}
            style={{
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            📩 Solicitudes
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/promociones')}
            style={{
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            🎟️ Promociones
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/insights')}
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            📉 Insights
          </button>
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Level selector — 2×2 grid */}
      <div style={{ marginBottom: 24 }}>
        <span style={LABEL_STYLE}>Nivel educativo</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {LEVEL_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleLevelSelect(key)}
              style={{
                minHeight: 64,
                borderRadius: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 17,
                fontWeight: 800,
                fontFamily: 'var(--font-nunito)',
                transition: 'all 0.2s',
                background: selectedLevel === key ? '#7c3aed' : '#1a1035',
                border: selectedLevel === key ? '1px solid #7c3aed' : '1px solid #2D2048',
                color: selectedLevel === key ? 'white' : '#a78bfa',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grade selector — only for school levels */}
      {selectedLevel !== null && !isExamLevel && (
        <div style={{ marginBottom: 24 }}>
          <span style={LABEL_STYLE}>Grado</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {[1, 2, 3].map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => setSelectedGrade(grade)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 16,
                  fontWeight: 900,
                  transition: 'all 0.2s',
                  background: selectedGrade === grade ? '#7c3aed' : '#1a1035',
                  color: selectedGrade === grade ? 'white' : '#a78bfa',
                  border: selectedGrade === grade ? '1px solid #7c3aed' : '1px solid #2D2048',
                }}
              >
                {GRADE_LABELS[grade]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subjects grid */}
      {showSubjectsSection && (
        <div>
          <span style={{ ...LABEL_STYLE, marginTop: 24 }}>Materias disponibles</span>
          {filteredSubjects.length === 0 ? (
            <div style={{ color: '#a78bfa', fontSize: 16, marginTop: 12, marginBottom: 16 }}>
              No hay materias para {LEVEL_LABELS[selectedLevel!]}
              {!isExamLevel && selectedGrade !== null ? ` — ${GRADE_LABELS[selectedGrade]}` : ''}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 14,
                marginTop: 12,
                marginBottom: 16,
              }}
            >
              {filteredSubjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/admin/${subject.slug}?grade=${gradeParam}&level=${selectedLevel}`}
                  prefetch={true}
                  onMouseEnter={() => setHoveredSubject(subject.id)}
                  onMouseLeave={() => setHoveredSubject(null)}
                  style={{
                    background: '#1a1035',
                    border: '1px solid rgba(124,58,237,0.2)',
                    borderRadius: 16,
                    padding: '20px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'all 0.2s',
                    transform: hoveredSubject === subject.id ? 'translateY(-2px)' : 'none',
                    boxShadow:
                      hoveredSubject === subject.id
                        ? '0 6px 20px rgba(124,58,237,0.2)'
                        : 'none',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(124,58,237,0.12)',
                      border: '1px solid rgba(124,58,237,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    {subject.icon ?? '📚'}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#e2d9f3', flex: 1 }}>
                    {subject.name}
                  </div>
                  <div
                    style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubject(subject)
                        setEditName(subject.name)
                        setEditSlug(subject.slug)
                        setEditIcon(subject.icon ?? '')
                      }}
                      style={{
                        background: 'rgba(124,58,237,0.15)',
                        border: '1px solid rgba(124,58,237,0.3)',
                        borderRadius: 8,
                        color: '#a78bfa',
                        width: 30,
                        height: 30,
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(subject.id)}
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8,
                        color: '#ef4444',
                        width: 30,
                        height: 30,
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Add subject button */}
          <button
            type="button"
            onClick={() => setShowAddSubject((v) => !v)}
            onMouseEnter={() => setHoveredAdd(true)}
            onMouseLeave={() => setHoveredAdd(false)}
            style={{
              width: '100%',
              minHeight: 52,
              background: hoveredAdd
                ? 'rgba(124,58,237,0.15)'
                : 'rgba(124,58,237,0.08)',
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
            ＋ Añadir materia
          </button>

          {/* Inline add subject form */}
          {showAddSubject && (
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
                <div>
                  <label
                    style={{
                      fontSize: 13,
                      color: '#a78bfa',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Nombre
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim() && !newIcon) {
                        suggestEmoji(e.target.value.trim())
                      }
                    }}
                    placeholder="ej. Física"
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
                  <label
                    style={{
                      fontSize: 13,
                      color: '#a78bfa',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Slug
                  </label>
                  <input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="ej. fisica-sec"
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
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        fontSize: 13,
                        color: '#a78bfa',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        display: 'block',
                        marginBottom: 6,
                      }}
                    >
                      Ícono {loadingEmoji && (
                        <span style={{ color: '#7c3aed', fontSize: 11 }}>buscando...</span>
                      )}
                    </label>
                    <input
                      value={newIcon}
                      onChange={(e) => setNewIcon(e.target.value)}
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
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
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
                  onClick={handleAddSubject}
                  disabled={savingSubject}
                  style={{
                    background: '#7c3aed',
                    color: 'white',
                    borderRadius: 12,
                    padding: '10px 20px',
                    fontWeight: 800,
                    border: 'none',
                    cursor: savingSubject ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontFamily: 'var(--font-nunito)',
                    opacity: savingSubject ? 0.7 : 1,
                  }}
                >
                  {savingSubject ? 'Guardando...' : 'Guardar materia'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit subject modal */}
      {editingSubject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setEditingSubject(null)}
        >
          <div
            style={{
              background: '#1a1035',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: 20,
              padding: 28,
              width: '100%',
              maxWidth: 480,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 16,
                fontWeight: 900,
                color: '#e2d9f3',
                marginBottom: 20,
              }}
            >
              ✏️ Editar materia
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    color: '#a78bfa',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Nombre
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={(e) => {
                    if (e.target.value.trim()) suggestEditEmoji(e.target.value.trim())
                  }}
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
                <label
                  style={{
                    fontSize: 13,
                    color: '#a78bfa',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Slug
                </label>
                <input
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
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
                <label
                  style={{
                    fontSize: 13,
                    color: '#a78bfa',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Ícono{' '}
                  {loadingEditEmoji && (
                    <span style={{ color: '#7c3aed', fontSize: 11 }}>buscando...</span>
                  )}
                </label>
                <input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  placeholder={loadingEditEmoji ? '...' : '📚'}
                  maxLength={2}
                  style={{
                    width: '100%',
                    background: '#1C1033',
                    border: loadingEditEmoji
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
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
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
                onClick={handleEditSubject}
                disabled={savingEdit}
                style={{
                  background: '#7c3aed',
                  color: 'white',
                  borderRadius: 12,
                  padding: '10px 20px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontFamily: 'var(--font-nunito)',
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            style={{
              background: '#1a1035',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 20,
              padding: 28,
              width: '100%',
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 16,
                fontWeight: 900,
                color: '#ef4444',
                marginBottom: 12,
              }}
            >
              🗑️ Eliminar materia
            </div>
            <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 20 }}>
              ¿Seguro que quieres eliminar esta materia? Esta acción no se puede deshacer y eliminará todos los temas y contenido asociado.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
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
                onClick={handleDeleteSubject}
                disabled={deletingId !== null}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: 12,
                  padding: '10px 20px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: deletingId !== null ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontFamily: 'var(--font-nunito)',
                  opacity: deletingId !== null ? 0.7 : 1,
                }}
              >
                {deletingId !== null ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
