'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
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

function PreviewContent() {
  const searchParams = useSearchParams()
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
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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

        {/* B) Hook card */}
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
              backgroundColor: 'rgba(124,58,237,0.15)',
              color: '#a78bfa',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 999,
              padding: '3px 12px',
              border: '1px solid rgba(124,58,237,0.3)',
              marginBottom: 14,
            }}
          >
            Vista previa
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 18,
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topics.map((topic) => (
              <p
                key={topic}
                style={{ fontSize: 14, color: '#e2d9f3', fontWeight: 600, margin: 0 }}
              >
                {topic}
              </p>
            ))}
          </div>

          <p style={{ fontSize: 12, color: '#4B3D6E', margin: '14px 0 0' }}>
            Y muchos temas más según tu grado
          </p>
        </div>

        {/* C) CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <Link
              href="/planes?highlight=standard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 52,
                backgroundColor: '#7c3aed',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 16,
                color: '#ffffff',
                textDecoration: 'none',
              }}
            >
              Ver planes →
            </Link>
            <p style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Desde $149/mes · Sin contrato
            </p>
          </div>

          <div>
            <Link
              href="/planes?highlight=personalizado"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 52,
                backgroundColor: 'transparent',
                borderRadius: 12,
                border: '1.5px solid #7c3aed',
                fontWeight: 700,
                fontSize: 15,
                color: '#a78bfa',
                textDecoration: 'none',
              }}
            >
              Quiero guías únicas para mí
            </Link>
            <p style={{ fontSize: 12, color: '#4B3D6E', textAlign: 'center', margin: '6px 0 0' }}>
              ¿Solo te cuesta una materia? Te hacemos una guía solo de eso
            </p>
          </div>
        </div>

        {/* D) Trust line */}
        <p style={{ fontSize: 12, color: '#4B3D6E', textAlign: 'center', margin: 0 }}>
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
