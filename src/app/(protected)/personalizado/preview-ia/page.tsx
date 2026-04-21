'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type AIPreview = {
  title: string
  explanation: string
  bullets: string[]
}

function PreviewIAContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const theme = searchParams.get('theme') ?? ''
  const subject = searchParams.get('subject') ?? ''
  const diagnostico = searchParams.get('diagnostico') ?? ''

  const [preview, setPreview] = useState<AIPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dots, setDots] = useState('.')
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current || !subject || !diagnostico) return
    hasFetched.current = true

    fetch('/api/preview-personalizado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, theme, diagnostico, level }),
    })
      .then(async (res) => {
        console.log('API response status:', res.status)
        const data = await res.json() as AIPreview & { error?: string }
        console.log('API response data:', data)
        if (!res.ok) throw new Error(data.error ?? 'Error al generar la vista previa')
        return data
      })
      .then((data) => {
        console.log('Setting preview with data:', data)
        setPreview(data)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('overloaded') || msg.includes('529')) {
          setError('Demasiada demanda en este momento. Intenta de nuevo en unos segundos.')
        } else {
          setError('No pudimos generar tu vista previa. Intenta de nuevo.')
        }
      })
  }, [subject, theme, diagnostico, level])

  useEffect(() => {
    if (preview || error) return
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [preview, error])

  function handleBack() {
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    params.set('subject', subject)
    router.push(`/personalizado/diagnostico?${params.toString()}`)
  }

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
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
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

        {/* Progress bar — 3/3 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                backgroundColor: '#7c3aed',
              }}
            />
          ))}
        </div>

        {/* Loading state */}
        {!preview && !error && (
          <>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes pulse-ring { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
              @keyframes shimmer {
                0% { background-position: -200px 0; }
                100% { background-position: calc(200px + 100%) 0; }
              }
            `}} />
            <div
              style={{
                backgroundColor: '#1a1035',
                border: '1px solid #2D2048',
                borderRadius: 16,
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              {/* Pulsing circle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    border: '2px solid #7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'pulse-ring 1.5s ease-in-out infinite',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    ✨
                  </div>
                </div>
              </div>

              {/* Animated dots */}
              <p
                style={{
                  fontFamily: 'var(--font-nunito)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#e2d9f3',
                  margin: '0 0 20px',
                }}
              >
                Preparando tu ejemplo personalizado{dots}
              </p>

              {/* Skeleton rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([100, 80, 60] as const).map((width, i) => (
                  <div
                    key={i}
                    style={{
                      height: 12,
                      borderRadius: 6,
                      width: `${width}%`,
                      background: 'linear-gradient(90deg, #2D2048 25%, #3d2a6e 50%, #2D2048 75%)',
                      backgroundSize: '200px 100%',
                      animation: 'shimmer 1.5s infinite linear',
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              backgroundColor: '#1a1035',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 20,
              padding: '32px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 14, color: '#f87171', margin: '0 0 16px' }}>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: '12px',
                width: '100%',
                background: '#7c3aed',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontFamily: 'var(--font-nunito)',
                fontSize: '15px',
                fontWeight: 900,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Intentar de nuevo
            </button>
            <button
              type="button"
              onClick={handleBack}
              style={{
                marginTop: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: '#a78bfa',
              }}
            >
              ← Cambiar diagnóstico
            </button>
          </div>
        )}

        {/* Result state */}
        {preview && (
          <div>
            <div
              style={{
                backgroundColor: '#1a1035',
                border: '1.5px solid #2D2048',
                borderRadius: 20,
                padding: '24px 20px',
                marginBottom: 16,
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
                Tu guía personalizada ✨
              </span>

              <h2
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  margin: '0 0 10px',
                  lineHeight: 1.3,
                }}
              >
                {preview.title}
              </h2>

              <p
                style={{
                  fontSize: 14,
                  color: '#a78bfa',
                  margin: '0 0 18px',
                  lineHeight: 1.6,
                }}
              >
                {preview.explanation}
              </p>

              <div style={{ height: 1, backgroundColor: '#2D2048', marginBottom: 16 }} />

              <p
                style={{
                  fontSize: 10,
                  color: '#7c3aed',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  margin: '0 0 12px',
                }}
              >
                LO QUE APRENDERÍAS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {preview.bullets.map((bullet, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: '#0f0a1e',
                      borderLeft: '2px solid #7c3aed',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: '#e2d9f3',
                      fontWeight: 600,
                    }}
                  >
                    {bullet}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => router.push('/planes?plan=personalizado')}
                style={{
                  width: '100%',
                  minHeight: 52,
                  backgroundColor: '#ec4899',
                  borderRadius: 12,
                  border: 'none',
                  fontWeight: 900,
                  fontSize: 16,
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Quiero esto — ver planes →
              </button>
            </div>

            <button
              type="button"
              onClick={handleBack}
              style={{
                marginTop: 12,
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: '#a78bfa',
                textAlign: 'center',
                padding: '4px 0',
              }}
            >
              ← Cambiar diagnóstico
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PreviewIAPage() {
  return (
    <Suspense>
      <PreviewIAContent />
    </Suspense>
  )
}
