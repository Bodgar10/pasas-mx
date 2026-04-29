'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

const LEVEL_LABELS = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria',
}

const GRADE_LABELS: Record<number, string> = { 1: '1°', 2: '2°', 3: '3°' }

const LABEL_STYLE = {
  fontFamily: 'var(--font-orbitron)',
  fontSize: 10,
  color: '#a78bfa',
  textTransform: 'uppercase' as const,
  letterSpacing: 2,
  marginBottom: 12,
  display: 'block',
}

export default function AdminHomeClient({ subjects }: Props) {
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<'middle_school' | 'high_school' | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null)

  const filteredSubjects =
    selectedLevel !== null && selectedGrade !== null
      ? subjects.filter(
          (s) => s.education_level === selectedLevel && s.grades.includes(selectedGrade)
        )
      : []

  function handleLevelSelect(level: 'middle_school' | 'high_school') {
    setSelectedLevel(level)
    setSelectedGrade(null)
  }

  return (
    <div
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: 'var(--font-nunito)',
        color: '#e2d9f3',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 22, fontWeight: 900, color: '#e2d9f3' }}>
          ⚙️ Panel Admin
        </div>
        <div style={{ fontSize: 13, color: '#a78bfa', marginLeft: 8 }}>
          Gestión de contenido
        </div>
      </div>

      {/* Level selector */}
      <div style={{ marginBottom: 24 }}>
        <span style={LABEL_STYLE}>Nivel educativo</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {(
            [
              { key: 'middle_school', label: '🏫 Secundaria' },
              { key: 'high_school', label: '🎓 Preparatoria' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleLevelSelect(key)}
              style={{
                flex: 1,
                minHeight: 64,
                borderRadius: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 15,
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

      {/* Grade selector */}
      {selectedLevel !== null && (
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
                  fontSize: 14,
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
      {selectedLevel !== null && selectedGrade !== null && (
        <div>
          <span style={{ ...LABEL_STYLE, marginTop: 24 }}>Materias disponibles</span>
          {filteredSubjects.length === 0 ? (
            <div style={{ color: '#a78bfa', fontSize: 14, marginTop: 12 }}>
              No hay materias para {LEVEL_LABELS[selectedLevel]} — {GRADE_LABELS[selectedGrade]}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 14,
                marginTop: 12,
              }}
            >
              {filteredSubjects.map((subject) => (
                <div
                  key={subject.id}
                  onClick={() =>
                    router.push(
                      `/admin/${subject.slug}?grade=${selectedGrade}&level=${selectedLevel}`
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
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {subject.icon ?? '📚'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#e2d9f3' }}>
                    {subject.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
