'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PLAN_DISPLAY } from '@/lib/payments/config'
import Logo from '@/components/global/Logo'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

type Stats = {
  materias: number
  temas: number
  bloques_leccion: number
  interactivos: number
  papel_lapiz: number
  audios: number
  horda_temas: number
  horda_preguntas: number
}

// Los mismos mapeos que usa registro/actions.ts para traducir las etiquetas
// del onboarding a los valores del enum de la base.
const NIVEL_DB: Record<string, string> = {
  Secundaria: 'middle_school',
  'Preparatoria / Bachillerato': 'high_school',
  'Examen de Preparatoria': 'high_school',
  'Examen de Universidad': 'high_school',
}
const GRADO_DB: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }

const THEME_EXAMPLES: Record<string, string> = {
  Videojuegos: 'Las derivadas explicadas con mecánicas de Minecraft',
  'K-pop': 'Factorización usando los ensayos de BTS',
  Fútbol: 'El teorema de Pitágoras con tiros libres de la Liga MX',
  Anime: 'Ecuaciones lineales con el entrenamiento de Naruto',
}

function getExampleTitle(theme: string): string {
  const key = Object.keys(THEME_EXAMPLES).find((k) => theme.includes(k))
  return key ? THEME_EXAMPLES[key]! : `Aprende con ejemplos de ${theme}`
}

function Fila({
  emoji,
  titulo,
  detalle,
}: {
  emoji: string
  titulo: string
  detalle: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        backgroundColor: '#1a1035',
        borderLeft: '2px solid #7c3aed',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1.2 }}>{emoji}</span>
      <div>
        <p style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700, margin: 0 }}>
          {titulo}
        </p>
        <p style={{ fontSize: 13, color: '#a78bfa', margin: '2px 0 0', lineHeight: 1.4 }}>
          {detalle}
        </p>
      </div>
    </div>
  )
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
  const esTutor = searchParams.get('registrante') === 'tutor'

  const exampleTitle = getExampleTitle(theme)
  const subject = getSubject(level)

  const [stats, setStats] = useState<Stats | null>(null)

  const nivelDb = NIVEL_DB[level]
  const gradoDb = grade ? GRADO_DB[grade] : null

  useEffect(() => {
    if (!nivelDb || !gradoDb) return
    let vivo = true
    fetch(`/api/preview-stats?nivel=${nivelDb}&grado=${gradoDb}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d && !d.error) setStats(d) })
      .catch(() => { /* la pantalla funciona sin números */ })
    return () => { vivo = false }
  }, [nivelDb, gradoDb])

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, color: '#a78bfa' }}>
          <Logo size={22} />
          <p
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.2em',
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
              fontSize: 14,
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
                fontSize: 14,
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
              fontSize: 14,
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
              fontSize: 13,
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
              fontSize: 24,
              fontWeight: 900,
              color: '#e2d9f3',
              margin: '0 0 8px',
            }}
          >
            {esTutor ? 'Así aprendería' : 'Así aprenderías tú'}
          </h2>

          <p
            style={{
              fontSize: 16,
              color: '#a78bfa',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            {exampleTitle}
          </p>

          <div style={{ height: 1, backgroundColor: '#2D2048', marginBottom: 16 }} />

          {/* Lo que incluye — números reales de la base */}
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
                fontSize: 12,
                color: '#7c3aed',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin: '0 0 12px',
              }}
            >
              {esTutor ? 'LO QUE VA A ENCONTRAR' : 'LO QUE VAS A ENCONTRAR'}
            </p>

            {!stats ? (
              /* Mientras cargan: espacio reservado del mismo alto, para que la
                 tarjeta no dé un salto cuando llegan los datos. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: 46,
                      backgroundColor: '#1a1035',
                      borderRadius: 8,
                      opacity: 0.5,
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* Cabecera con el alcance del grado */}
                <div
                  style={{
                    backgroundColor: '#1a1035',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 10,
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-orbitron)',
                      fontSize: 22,
                      fontWeight: 900,
                      color: '#e2d9f3',
                      margin: 0,
                    }}
                  >
                    {stats.materias} materias · {stats.temas} temas
                  </p>
                  <p style={{ fontSize: 13, color: '#a78bfa', margin: '4px 0 0' }}>
                    para {grade ? `${grade} de ` : ''}
                    {level.startsWith('Examen') ? 'tu examen' : level.split(' / ')[0]}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Fila
                    emoji="⚡"
                    titulo="Lecciones interactivas"
                    detalle={`${stats.interactivos.toLocaleString('es-MX')} ejercicios para arrastrar, ordenar y resolver`}
                  />
                  {stats.horda_preguntas > 0 && (
                    <Fila
                      emoji="🧟"
                      titulo="Modo Horda"
                      detalle={`${stats.horda_preguntas.toLocaleString('es-MX')} preguntas por oleadas en ${stats.horda_temas} temas`}
                    />
                  )}
                  {stats.papel_lapiz > 0 && (
                    <Fila
                      emoji="✏️"
                      titulo="Papel y Lápiz"
                      detalle={`${stats.papel_lapiz.toLocaleString('es-MX')} ejercicios con pistas paso a paso`}
                    />
                  )}
                  {stats.audios > 0 && (
                    <Fila
                      emoji="🎧"
                      titulo="Audio"
                      detalle={`${stats.audios.toLocaleString('es-MX')} lecciones narradas para escuchar`}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Lock row */}
          <div
            style={{
              backgroundColor: '#0d1f0d',
              border: '1px solid rgba(16,185,129,0.19)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              fontWeight: 700,
              color: '#10b981',
            }}
          >
            🔒 Desbloquea todos los temas con el plan
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
            <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Matemáticas, Español, Historia, Ciencias y más · Desde ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount}/mes
            </p>
          </div>

          {FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && (
          <>
          <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', margin: '16px 0' }}>
            {esTutor ? '¿Le falla solo una materia?' : '¿Te falla solo una materia?'}
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
                fontSize: 17,
                color: '#ec4899',
                cursor: 'pointer',
              }}
            >
              Quiero guías solo de {subject} →
            </button>
            <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Una sola materia, adaptada exactamente a lo que {esTutor ? 'le' : 'te'} falla · Desde ${PLAN_DISPLAY.personalizado_v2.prices.mensual.amount}/mes
            </p>
          </div>
          </>
          )}
        </div>

        {/* E) Trust line */}
        <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
          7 días gratis · No se cobra hasta el día 8 · Cancela cuando quieras
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
