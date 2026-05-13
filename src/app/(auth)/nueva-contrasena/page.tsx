'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('No pudimos actualizar la contraseña. El link puede haber expirado.')
      } else {
        setDone(true)
        setTimeout(() => router.push('/dashboard'), 2000)
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
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <span style={{ fontSize: 24 }}>🔒</span>
            </div>
            <h1 style={{
              fontFamily: FONTS.orbitron,
              fontSize: 20, fontWeight: 900,
              color: COLORS.text, margin: '0 0 6px',
            }}>
              Nueva contraseña
            </h1>
            <p style={{ fontSize: 14, color: COLORS.muted, margin: 0 }}>
              Elige una contraseña segura para tu cuenta
            </p>
          </div>

          {!done ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{
                  display: 'block', fontSize: 14,
                  fontWeight: 700, color: '#9CA3AF', marginBottom: 6,
                }}>
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
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

              <div>
                <label style={{
                  display: 'block', fontSize: 14,
                  fontWeight: 700, color: '#9CA3AF', marginBottom: 6,
                }}>
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Repite tu contraseña"
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
                  fontFamily: FONTS.nunito, marginTop: 4,
                }}
              >
                {pending ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h2 style={{
                fontFamily: FONTS.orbitron,
                fontSize: 18, fontWeight: 900,
                color: COLORS.success, margin: '0 0 10px',
              }}>
                ¡Contraseña actualizada!
              </h2>
              <p style={{ fontSize: 15, color: COLORS.muted, margin: 0 }}>
                Redirigiendo a tu dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
