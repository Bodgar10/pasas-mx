'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { saveOnboardingData } from '../actions'

const THEME_EXAMPLES: Record<string, string> = {
  Videojuegos: 'Las derivadas explicadas con mecánicas de Minecraft',
  'K-pop': 'Factorización usando los ensayos de BTS',
  Fútbol: 'El teorema de Pitágoras con tiros libres de la Liga MX',
  Anime: 'Ecuaciones lineales con el entrenamiento de Naruto',
}

const SCHOOL_TOPICS = [
  '📐 Álgebra y ecuaciones',
  '📊 Estadística básica',
  '🔬 Ciencias naturales',
]

const EXAM_TOPICS = [
  '🧮 Matemáticas COMIPEMS',
  '📝 Comprensión lectora',
  '🗺️ Historia de México',
]

function getExampleTitle(theme: string): string {
  const key = Object.keys(THEME_EXAMPLES).find((k) => theme.includes(k))
  return key ? THEME_EXAMPLES[key]! : `Aprende con ejemplos de ${theme}`
}

function getSubject(level: string): string {
  if (level === 'Examen de Preparatoria') return 'Matemáticas COMIPEMS'
  if (level === 'Examen de Universidad') return 'Cálculo'
  return 'Matemáticas'
}

function PreviewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const theme = searchParams.get('theme') ?? ''

  const hasSaved = useRef(false)
  useEffect(() => {
    if (hasSaved.current || !level || !theme) return
    hasSaved.current = true
    saveOnboardingData({ level, grade, theme })
  }, [level, grade, theme])

  const exampleTitle = getExampleTitle(theme)
  const isExam = level.startsWith('Examen')
  const topics = isExam ? EXAM_TOPICS : SCHOOL_TOPICS
  const subject = getSubject(level)

  const personalizedParams = new URLSearchParams({ level })
  if (grade) personalizedParams.set('grade', grade)
  personalizedParams.set('theme', theme)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px 40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 390 }}>

        {/* A) Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#a78bfa',
              margin: 0,
            }}
          >
            PASAS.MX
          </p>
        </div>

        {/* B) Context pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <span
            style={{
              backgroundColor: '#2d1b69',
              color: '#a78bfa',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {level}
          </span>
          {grade && (
            <span
              style={{
                backgroundColor: '#2d1b69',
                color: '#a78bfa',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                padding: '4px 12px',
              }}
            >
              {grade}
            </span>
          )}
          <span
            style={{
              backgroundColor: '#1a0f00',
              color: '#fbbf24',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {theme}
          </span>
        </div>

        {/* C) Main preview card */}
        <div
          style={{
            backgroundColor: '#1a1035',
            border: '1.5px solid #2D2048',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 999,
              padding: '3px 12px',
              marginBottom: 14,
            }}
          >
            Vista previa
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 22,
              fontWeight: 900,
              color: '#e2d9f3',
              margin: '0 0 8px',
            }}
          >
            Así aprenderías tú
          </h2>

          <p
            style={{
              fontSize: 14,
              color: '#a78bfa',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            {exampleTitle}
          </p>

          <div style={{ height: 1, backgroundColor: '#2D2048', marginBottom: 16 }} />

          {/* Inner dark card */}
          <div
            style={{
              backgroundColor: '#0f0a1e',
              border: '1px solid #2D2048',
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: '#7c3aed',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin: '0 0 10px',
              }}
            >
              LO QUE VERÍAS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topics.map((topic) => (
                <div
                  key={topic}
                  style={{
                    backgroundColor: '#1a1035',
                    borderLeft: '2px solid #7c3aed',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    color: '#e2d9f3',
                    fontWeight: 600,
                  }}
                >
                  {topic}
                </div>
              ))}
            </div>
          </div>

          {/* Lock row */}
          <div
            style={{
              backgroundColor: '#0d1f0d',
              border: '1px solid rgba(16,185,129,0.19)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#10b981',
            }}
          >
            🔒 Desbloquea todos los temas con tu plan
          </div>
        </div>

        {/* D) CTA section */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => router.push('/planes?plan=estandar')}
              style={{
                width: '100%',
                minHeight: 52,
                backgroundColor: '#7c3aed',
                borderRadius: 12,
                border: 'none',
                fontWeight: 900,
                fontSize: 16,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Ver planes — todas las materias →
            </button>
            <p style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Matemáticas, Español, Historia, Ciencias y más · Desde $199/mes
            </p>
          </div>

          <p style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', margin: '16px 0' }}>
            ¿Te falla solo una materia?
          </p>

          <div>
            <button
              type="button"
              onClick={() => router.push(`/personalizado/materia?${personalizedParams.toString()}`)}
              style={{
                width: '100%',
                minHeight: 52,
                backgroundColor: 'transparent',
                borderRadius: 12,
                border: '1.5px solid #ec4899',
                fontWeight: 800,
                fontSize: 15,
                color: '#ec4899',
                cursor: 'pointer',
              }}
            >
              Quiero guías solo de {subject} →
            </button>
            <p style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Una sola materia, adaptada exactamente a lo que te falla · Desde $499/mes
            </p>
          </div>
        </div>

        {/* E) Trust line */}
        <p style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
          Sin tarjeta para empezar · Cancela cuando quieras
        </p>

      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense>
      <PreviewContent />
    </Suspense>
  )
}
