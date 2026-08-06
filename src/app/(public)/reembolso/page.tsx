'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ReembolsoPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkSession() {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user && !user.is_anonymous)
    }
    checkSession()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email.trim() || !motivo.trim()) return
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/refund-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, motivo }),
      })
      if (res.ok) {
        setEnviado(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Error al enviar la solicitud. Intenta de nuevo.')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setEnviando(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-nunito)',
      color: '#e2d9f3',
      padding: '48px 24px 80px',
      maxWidth: 640,
      margin: '0 auto',
    }}>
      {/* Header */}
      <Link href="/" style={{ textDecoration: 'none' }}>
        <p style={{
          fontFamily: 'var(--font-orbitron)',
          fontSize: 14, fontWeight: 900,
          letterSpacing: '0.2em', color: '#a78bfa',
          marginBottom: 32,
        }}>
          PASAS.MX
        </p>
      </Link>

      <h1 style={{
        fontFamily: 'var(--font-orbitron)',
        fontSize: 24, fontWeight: 900,
        color: '#e2d9f3', marginBottom: 8,
      }}>
        Política de Reembolso
      </h1>
      <p style={{ fontSize: 15, color: '#a78bfa', marginBottom: 32, lineHeight: 1.6 }}>
        Versión 1.0 — Vigente desde julio 2026
      </p>

      {/* Política */}
      <div style={{
        background: '#1a1035',
        border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 16,
        padding: '24px 20px',
        marginBottom: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Reembolso automático — 7 días
          </div>
          <p style={{ fontSize: 15, color: '#e2d9f3', lineHeight: 1.7, margin: 0 }}>
            Si no estás satisfecho con Pasas.mx, puedes solicitar un reembolso completo dentro de los <strong>7 días naturales</strong> siguientes a tu primer pago. Sin preguntas, sin penalización.
          </p>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Después de 7 días
          </div>
          <p style={{ fontSize: 15, color: '#e2d9f3', lineHeight: 1.7, margin: 0 }}>
            Fuera del período de 7 días los reembolsos son evaluados de forma manual caso por caso. Puedes solicitarlo usando el formulario de abajo y te respondemos en máximo 5 días hábiles.
          </p>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Cómo cancelar
          </div>
          <p style={{ fontSize: 15, color: '#e2d9f3', lineHeight: 1.7, margin: 0 }}>
            Puedes cancelar tu suscripción en cualquier momento desde{' '}
            <Link href="/perfil" style={{ color: '#a78bfa', fontWeight: 700 }}>Mi perfil</Link>
            {' '}sin necesidad de contactarnos. Seguirás teniendo acceso hasta el final del período pagado.{' '}
            <Link href="/como-cancelar" style={{ color: '#a78bfa', fontWeight: 700 }}>Ver instrucciones →</Link>
          </p>
        </div>

        <div style={{
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 10,
          padding: '12px 16px',
        }}>
          <p style={{ fontSize: 14, color: '#10b981', margin: 0, lineHeight: 1.6, fontWeight: 600 }}>
            ✓ Cumplimos con la Ley Federal de Protección al Consumidor (PROFECO) y la reforma de diciembre 2025 sobre suscripciones digitales.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div style={{
        background: '#1a1035',
        border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 16,
        padding: '24px 20px',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-orbitron)',
          fontSize: 16, fontWeight: 900,
          color: '#e2d9f3', marginBottom: 6,
        }}>
          Solicitar reembolso
        </h2>
        <p style={{ fontSize: 14, color: '#a78bfa', marginBottom: 20, lineHeight: 1.6 }}>
          Llena el formulario y te respondemos en máximo 5 días hábiles.
        </p>

        {isLoggedIn === null ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#a78bfa', fontSize: 14 }}>
            Cargando...
          </div>
        ) : isLoggedIn === false ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15, color: '#a78bfa', marginBottom: 20, lineHeight: 1.6 }}>
              Necesitas iniciar sesión para solicitar un reembolso.
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                background: '#7c3aed',
                color: 'white',
                borderRadius: 12,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 900,
                textDecoration: 'none',
                fontFamily: 'var(--font-nunito)',
              }}
            >
              Iniciar sesión →
            </Link>
          </div>
        ) : null}

        {isLoggedIn === true && (
        <>
        {enviado ? (
          <div style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 12,
            padding: '24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#10b981', marginBottom: 8 }}>
              Solicitud recibida
            </div>
            <p style={{ fontSize: 14, color: '#a78bfa', margin: 0, lineHeight: 1.6 }}>
              Te respondemos en máximo 5 días hábiles al correo que proporcionaste.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                Nombre completo *
              </label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                placeholder="Tu nombre"
                style={{
                  width: '100%', background: '#0f0a1e',
                  border: '1.5px solid #2D2048', borderRadius: 10,
                  color: '#e2d9f3', fontSize: 15, padding: '10px 14px',
                  fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                Correo con el que te registraste *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@correo.com"
                style={{
                  width: '100%', background: '#0f0a1e',
                  border: '1.5px solid #2D2048', borderRadius: 10,
                  color: '#e2d9f3', fontSize: 15, padding: '10px 14px',
                  fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                Motivo de la solicitud *
              </label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                required
                rows={4}
                placeholder="Cuéntanos brevemente por qué solicitas el reembolso"
                style={{
                  width: '100%', background: '#0f0a1e',
                  border: '1.5px solid #2D2048', borderRadius: 10,
                  color: '#e2d9f3', fontSize: 15, padding: '10px 14px',
                  fontFamily: 'var(--font-nunito)', boxSizing: 'border-box',
                  resize: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '10px 14px',
                fontSize: 14, color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || !nombre.trim() || !email.trim() || !motivo.trim()}
              style={{
                width: '100%', minHeight: 52,
                background: (enviando || !nombre.trim() || !email.trim() || !motivo.trim())
                  ? '#2D2048' : '#7c3aed',
                border: 'none', borderRadius: 12,
                color: 'white', fontSize: 16, fontWeight: 900,
                cursor: (enviando || !nombre.trim() || !email.trim() || !motivo.trim())
                  ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-nunito)',
              }}
            >
              {enviando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </form>
        )}
        </>
        )}
      </div>

      {/* Footer mini */}
      <div style={{ marginTop: 40, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { href: '/privacidad', label: 'Privacidad' },
          { href: '/terminos', label: 'Términos' },
          { href: '/como-cancelar', label: 'Cómo cancelar' },
          { href: '/ayuda', label: 'Ayuda' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={{ fontSize: 13, color: 'rgba(167,139,250,0.5)', textDecoration: 'none', fontWeight: 600 }}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
