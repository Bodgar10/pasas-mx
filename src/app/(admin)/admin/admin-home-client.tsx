'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

  async function suggestEmoji(name: string) {
    if (!name.trim()) return
    setLoadingEmoji(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: `Respond with only a single emoji that best represents this academic subject for Mexican high school students: "${name}". Only one emoji, nothing else.`,
            },
          ],
        }),
      })
      const data = await res.json()
      const emoji = data?.content?.[0]?.text?.trim()
      if (emoji) setNewIcon(emoji)
    } catch {
      // Silent fail — emoji is optional
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

  async function handleAddSubject() {
    if (!newName || !newSlug || selectedLevel === null) return
    setSavingSubject(true)
    const supabase = createClient()
    const educationLevel =
      selectedLevel === 'middle_school' ? 'middle_school' : 'high_school'
    const grades = isExamLevel
      ? [1, 2, 3]
      : selectedGrade !== null
      ? [selectedGrade]
      : [1]
    // Auto-calculate next display_order from existing subjects
    const maxOrder = subjects.reduce((max, s) => Math.max(max, s.display_order ?? 0), 0)
    const { error } = await supabase.from('subjects').insert({
      name: newName,
      slug: newSlug,
      education_level: educationLevel,
      grades,
      plan_types: ['grade', 'exam'],
      icon: newIcon || null,
      display_order: maxOrder + 1,
    })
    setSavingSubject(false)
    if (error) {
      alert('Error al guardar: ' + error.message)
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
        <div style={{ marginLeft: 'auto' }}>
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
                <div
                  key={subject.id}
                  onClick={() =>
                    router.push(
                      `/admin/${subject.slug}?grade=${gradeParam}&level=${selectedLevel}`
                    )
                  }
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
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#e2d9f3' }}>
                    {subject.name}
                  </div>
                </div>
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
    </div>
  )
}
