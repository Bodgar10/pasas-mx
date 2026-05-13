'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setPending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/nueva-contrasena`,
      })
      if (resetError) {
        setError('No pudimos enviar el correo. Verifica que el email sea correcto.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: FONTS.nunito,
      }}
    >
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div
          style={{
            backgroundColor: COLORS.card,
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 20,
            padding: '32px 24px',
          }}
        >
          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <span style={{ fontSize: 24 }}>🔑</span>
            </div>
            <h1 style={{
              fontFamily: FONTS.orbitron,
              fontSize: 20, fontWeight: 900,
              color: COLORS.text, margin: '0 0 6px',
            }}>
              Recuperar contraseña
            </h1>
            <p style={{ fontSize: 14, color: COLORS.muted, margin: 0 }}>
              Te enviamos un link para crear una nueva
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{
                  display: 'block', fontSize: 14,
                  fontWeight: 700, color: '#9CA3AF', marginBottom: 6,
                }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  style={{
                    width: '100%',
                    backgroundColor: COLORS.inputBg,
                    border: `1.5px solid ${COLORS.inputBorder}`,
                    borderRadius: RADIUS.lg,
                    padding: '0 16px',
                    minHeight: 52,
                    fontSize: 16,
                    color: COLORS.text,
                    fontFamily: FONTS.nunito,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <p style={{
                  padding: '10px 14px', borderRadius: RADIUS.md,
                  fontSize: 14, fontWeight: 700,
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.2)',
                  margin: 0,
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                style={{
                  width: '100%', minHeight: 52,
                  backgroundColor: pending ? COLORS.inputBorder : COLORS.primary,
                  border: 'none', borderRadius: RADIUS.lg,
                  fontSize: 16, fontWeight: 900,
                  color: '#fff', cursor: pending ? 'not-allowed' : 'pointer',
                  fontFamily: FONTS.nunito,
                }}
              >
                {pending ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
              <h2 style={{
                fontFamily: FONTS.orbitron,
                fontSize: 18, fontWeight: 900,
                color: COLORS.text, margin: '0 0 10px',
              }}>
                ¡Revisa tu correo!
              </h2>
              <p style={{
                fontSize: 15, color: COLORS.muted,
                lineHeight: 1.6, margin: '0 0 24px',
              }}>
                Enviamos un link a <strong style={{ color: COLORS.text }}>{email}</strong>.
                Úsalo para crear tu nueva contraseña. Expira en 1 hora.
              </p>
              <p style={{ fontSize: 13, color: COLORS.muted, opacity: 0.7, margin: 0 }}>
                ¿No llegó? Revisa tu carpeta de spam.
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link
              href="/login"
              style={{
                fontSize: 14, fontWeight: 700,
                color: COLORS.muted, textDecoration: 'none',
              }}
            >
              ← Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
