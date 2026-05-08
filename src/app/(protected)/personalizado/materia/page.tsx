'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface Subject {
  id: string
  name: string
  icon: string | null
  slug: string
}

const LEVEL_MAP: Record<string, string> = {
  'Secundaria': 'middle_school',
  'Preparatoria / Bachillerato': 'high_school',
  'Examen de Preparatoria': 'high_school',
  'Examen de Universidad': 'high_school',
}

const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }

function MateriaContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const theme = searchParams.get('theme') ?? ''

  const supabase = createClient()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Subject | null>(null)

  const educationLevel = LEVEL_MAP[level] ?? 'middle_school'
  const gradeNumber = grade ? (GRADE_MAP[grade] ?? null) : null

  useEffect(() => {
    async function loadSubjects() {
      setLoading(true)
      let query = supabase
        .from('subjects')
        .select('id, name, icon, slug')
        .eq('education_level', educationLevel)
        .order('display_order', { ascending: true })

      if (gradeNumber) {
        query = query.contains('grades', [gradeNumber])
      }

      const { data, error } = await query
      setLoading(false)
      if (error || !data) return
      setSubjects(data)
    }
    loadSubjects()
  }, [educationLevel, gradeNumber])

  function handleBack() {
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    router.push(`/onboarding/preview?${params.toString()}`)
  }

  function handleNext() {
    if (!selected) return
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    params.set('subject', selected.name)
    params.set('subjectId', selected.id)
    router.push(`/personalizado/diagnostico?${params.toString()}`)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: '#a78bfa', margin: 0 }}>
            PASAS.MX
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3] as const).map((s) => (
            <div key={s} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: s <= 1 ? '#7c3aed' : '#2D2048' }} />
          ))}
        </div>

        <div style={{ backgroundColor: '#1a1035', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: '24px 20px' }}>
          <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 12 }}>📖</div>
          <h2 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 20, fontWeight: 900, color: '#e2d9f3', marginBottom: 20, textAlign: 'center' }}>
            ¿Qué materia te falla?
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#a78bfa', fontSize: 15 }}>
              Cargando materias...
            </div>
          ) : subjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#a78bfa', fontSize: 15 }}>
              No hay materias disponibles para este nivel.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subjects.map((subj) => {
                const isSelected = selected?.id === subj.id
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setSelected(subj)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px',
                      backgroundColor: isSelected ? '#2d1b69' : '#1a1035',
                      border: `1.5px solid ${isSelected ? '#7c3aed' : '#2D2048'}`,
                      borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{subj.icon ?? '📚'}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#e2d9f3', flex: 1 }}>
                      {subj.name}
                    </span>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSelected ? '#7c3aed' : 'transparent',
                      border: `2px solid ${isSelected ? '#7c3aed' : '#2D2048'}`,
                    }}>
                      {isSelected && (
                        <svg width="11" height="9" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!selected}
            style={{
              marginTop: 20, width: '100%', minHeight: 52, borderRadius: 12,
              fontWeight: 900, fontSize: 16, border: 'none',
              cursor: selected ? 'pointer' : 'not-allowed',
              backgroundColor: selected ? '#7c3aed' : '#2D2048',
              color: selected ? '#ffffff' : '#4B3D6E',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Siguiente →
          </button>

          <button
            type="button"
            onClick={handleBack}
            style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#a78bfa', textAlign: 'center', padding: '4px 0' }}
          >
            ← Regresar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MateriaPage() {
  return (
    <Suspense>
      <MateriaContent />
    </Suspense>
  )
}
