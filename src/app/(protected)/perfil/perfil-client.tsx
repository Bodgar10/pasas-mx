'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'
import {
  updateNameAction,
  updateEmailAction,
  updatePasswordAction,
  type ActionState,
} from './actions'
import { CancellationFlow } from '@/components/perfil/CancellationFlow'

interface Props {
  profile: {
    fullName: string
    email: string
    xpTotal: number
    streakDays: number
  }
  subscription: {
    plan: string
    status: string
    currentPeriodEnd: string
    cancelledAt: string | null
    pausedUntil: string | null
    billingCycle: string | null
  } | null
}

const PLAN_LABELS: Record<string, string> = {
  grade: 'Estándar',
  ai_personalized: 'Personalizado',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: COLORS.success },
  trialing: { label: 'Período de prueba', color: COLORS.cyan },
  past_due: { label: 'Pago pendiente', color: COLORS.yellow },
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    backgroundColor: COLORS.inputBg,
    border: `1.5px solid ${COLORS.inputBorder}`,
    borderRadius: RADIUS.lg,
    padding: '0 16px',
    minHeight: 52,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.nunito,
    boxSizing: 'border-box' as const,
  }
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: COLORS.card,
      border: `1.5px solid ${COLORS.inputBorder}`,
      borderRadius: RADIUS.xxl,
      padding: '20px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <p style={{
        fontFamily: FONTS.orbitron,
        fontSize: 13,
        fontWeight: 900,
        color: COLORS.muted,
        letterSpacing: 2,
        textTransform: 'uppercase' as const,
        margin: 0,
      }}>{title}</p>
    </div>
  )
}

function FeedbackMessage({ state }: { state: ActionState }) {
  if (!state) return null
  const isError = !!state.error
  return (
    <p style={{
      marginTop: 10,
      padding: '10px 14px',
      borderRadius: RADIUS.md,
      fontSize: 14,
      fontWeight: 700,
      backgroundColor: isError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
      color: isError ? '#f87171' : COLORS.success,
      border: `1px solid ${isError ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
    }}>
      {isError ? state.error : state.success}
    </p>
  )
}

function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        minHeight: 48,
        backgroundColor: pending ? COLORS.inputBorder : COLORS.primary,
        border: 'none',
        borderRadius: RADIUS.lg,
        fontSize: 15,
        fontWeight: 900,
        color: '#fff',
        cursor: pending ? 'not-allowed' : 'pointer',
        fontFamily: FONTS.nunito,
        marginTop: 12,
        transition: 'background-color 0.15s ease',
      }}
    >
      {pending ? (pendingLabel ?? 'Guardando...') : label}
    </button>
  )
}

export default function PerfilClient({ profile, subscription }: Props) {
  const router = useRouter()
  const [nameState, nameAction, namePending] = useActionState<ActionState, FormData>(updateNameAction, null)
  const [emailState, emailAction, emailPending] = useActionState<ActionState, FormData>(updateEmailAction, null)
  const [passwordState, passwordAction, passwordPending] = useActionState<ActionState, FormData>(updatePasswordAction, null)
  const [showCancelFlow, setShowCancelFlow] = useState(false)
  const [wasCancelled, setWasCancelled] = useState(false)

  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const isCancelled = !!subscription?.cancelledAt
  const statusMeta = subscription ? STATUS_LABELS[subscription.status] : null

  return (
    <div style={{
      minHeight: '100vh',
      color: COLORS.text,
      fontFamily: FONTS.nunito,
      padding: '0 16px',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '40px 0 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: 40, height: 40,
              backgroundColor: COLORS.card,
              border: `1.5px solid ${COLORS.inputBorder}`,
              borderRadius: RADIUS.lg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, color: COLORS.muted,
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <div>
            <p style={{ fontFamily: FONTS.orbitron, fontSize: 20, fontWeight: 900, color: COLORS.text, margin: 0 }}>
              Mi perfil
            </p>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
              {profile.email}
            </p>
          </div>
        </div>

        {/* Stats mini */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <div style={{
            flex: 1, backgroundColor: COLORS.card,
            border: `1.5px solid rgba(251,191,36,0.3)`,
            borderRadius: RADIUS.xl, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>XP Total</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.yellow }}>
                {profile.xpTotal.toLocaleString('es-MX')}
              </p>
            </div>
          </div>
          <div style={{
            flex: 1, backgroundColor: COLORS.card,
            border: `1.5px solid rgba(236,72,153,0.3)`,
            borderRadius: RADIUS.xl, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>Racha</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.pink }}>
                {profile.streakDays} días
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nombre */}
          <SectionCard>
            <SectionTitle emoji="👤" title="Nombre" />
            <form action={nameAction}>
              <input
                name="full_name"
                defaultValue={profile.fullName}
                placeholder="Tu nombre o apodo"
                style={inputStyle()}
              />
              <SubmitButton pending={namePending} label="Guardar nombre" />
              <FeedbackMessage state={nameState} />
            </form>
          </SectionCard>

          {/* Correo */}
          <SectionCard>
            <SectionTitle emoji="✉️" title="Correo electrónico" />
            <form action={emailAction}>
              <input
                name="email"
                type="email"
                defaultValue={profile.email}
                placeholder="tu@correo.com"
                style={inputStyle()}
              />
              <SubmitButton pending={emailPending} label="Actualizar correo" />
              <FeedbackMessage state={emailState} />
            </form>
            <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, opacity: 0.7 }}>
              Te enviaremos un correo de confirmación al nuevo email.
            </p>
          </SectionCard>

          {/* Contraseña */}
          <SectionCard>
            <SectionTitle emoji="🔒" title="Contraseña" />
            <form action={passwordAction}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  name="password"
                  type="password"
                  placeholder="Nueva contraseña"
                  minLength={6}
                  style={inputStyle()}
                />
                <input
                  name="confirm"
                  type="password"
                  placeholder="Confirmar contraseña"
                  style={inputStyle()}
                />
              </div>
              <SubmitButton pending={passwordPending} label="Cambiar contraseña" />
              <FeedbackMessage state={passwordState} />
            </form>
          </SectionCard>

          {/* Suscripción */}
          {subscription && (
            <SectionCard>
              <SectionTitle emoji="💳" title="Suscripción" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, color: COLORS.muted, fontWeight: 600 }}>Plan</span>
                  <span style={{ fontSize: 15, color: COLORS.text, fontWeight: 700 }}>
                    {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                  </span>
                </div>
                {subscription.billingCycle && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, color: COLORS.muted, fontWeight: 600 }}>Ciclo</span>
                    <span style={{ fontSize: 15, color: COLORS.text, fontWeight: 700 }}>
                      {subscription.billingCycle === 'monthly' ? '📅 Mensual' : subscription.billingCycle === 'semestral' ? '📅 Semestral' : '📅 Anual'}
                    </span>
                  </div>
                )}
                {statusMeta && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, color: COLORS.muted, fontWeight: 600 }}>Estado</span>
                    <span style={{ fontSize: 15, color: statusMeta.color, fontWeight: 700 }}>
                      {statusMeta.label}
                    </span>
                  </div>
                )}
                {periodEnd && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, color: COLORS.muted, fontWeight: 600 }}>
                      {isCancelled ? 'Acceso hasta' : 'Acceso hasta'}
                    </span>
                    <span style={{ fontSize: 15, color: COLORS.text, fontWeight: 700 }}>
                      {periodEnd}
                    </span>
                  </div>
                )}
              </div>

              {/* Banner pausa activa */}
              {subscription?.status === 'paused' && subscription.pausedUntil && (
                <div style={{
                  backgroundColor: 'rgba(245,158,11,0.08)',
                  border: '1.5px solid rgba(245,158,11,0.3)',
                  borderRadius: RADIUS.lg,
                  padding: '16px',
                  marginBottom: 12,
                }}>
                  <p style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', margin: '0 0 6px' }}>
                    ⏸ Tu cuenta está pausada
                  </p>
                  <p style={{ fontSize: 13, color: '#fbbf24', opacity: 0.85, margin: '0 0 12px', lineHeight: 1.5 }}>
                    Se reactiva automáticamente el{' '}
                    <strong>{new Date(subscription.pausedUntil).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                    Tu XP y progreso están guardados.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      // Reactivar: quitar pausa en Stripe vía endpoint
                      try {
                        await fetch('/api/subscription/pause', {
                          method: 'DELETE',
                        })
                        window.location.reload()
                      } catch {
                        alert('No se pudo reactivar. Escríbenos a soporte@pasas.mx')
                      }
                    }}
                    style={{
                      background: '#f59e0b',
                      border: 'none',
                      borderRadius: RADIUS.md,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 900,
                      color: '#0a0a0f',
                      cursor: 'pointer',
                      fontFamily: FONTS.nunito,
                    }}
                  >
                    Reactivar ahora →
                  </button>
                </div>
              )}

              {isCancelled || wasCancelled ? (
                <div style={{
                  backgroundColor: 'rgba(251,191,36,0.08)',
                  border: `1px solid rgba(251,191,36,0.2)`,
                  borderRadius: RADIUS.md,
                  padding: '12px 14px',
                  fontSize: 14, color: COLORS.yellow, fontWeight: 600,
                }}>
                  ⚠️ Tu suscripción ya está cancelada. Tendrás acceso hasta {periodEnd}.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelFlow(true)}
                  style={{
                    width: '100%', minHeight: 48,
                    backgroundColor: 'transparent',
                    border: `1.5px solid rgba(239,68,68,0.3)`,
                    borderRadius: RADIUS.lg,
                    fontSize: 15, fontWeight: 700,
                    color: '#f87171', cursor: 'pointer',
                    fontFamily: FONTS.nunito,
                  }}
                >
                  Cancelar suscripción
                </button>
              )}

              {showCancelFlow && subscription?.currentPeriodEnd && (
                <CancellationFlow
                  periodEnd={new Date(subscription.currentPeriodEnd)}
                  onClose={() => setShowCancelFlow(false)}
                  onCancelled={() => setWasCancelled(true)}
                />
              )}
            </SectionCard>
          )}

          {/* No subscription */}
          {!subscription && (
            <SectionCard>
              <SectionTitle emoji="💳" title="Suscripción" />
              <p style={{ fontSize: 15, color: COLORS.muted, margin: '0 0 14px' }}>
                No tienes un plan activo.
              </p>
              <button
                type="button"
                onClick={() => router.push('/planes')}
                style={{
                  width: '100%', minHeight: 48,
                  backgroundColor: COLORS.primary,
                  border: 'none', borderRadius: RADIUS.lg,
                  fontSize: 15, fontWeight: 900,
                  color: '#fff', cursor: 'pointer',
                  fontFamily: FONTS.nunito,
                }}
              >
                Ver planes →
              </button>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  )
}
