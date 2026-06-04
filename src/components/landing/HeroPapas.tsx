'use client'

import { useRouter } from 'next/navigation'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

export function HeroPapas() {
  const router = useRouter()

  return (
    <section
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px 80px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 999,
          padding: '6px 16px',
          marginBottom: 28,
        }}
      >
        <span style={{ fontSize: 14 }}>👨‍👩‍👧</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.muted,
            fontFamily: FONTS.nunito,
            letterSpacing: 0.5,
          }}
        >
          Para papás y mamás
        </span>
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: FONTS.orbitron,
          fontSize: 'clamp(28px, 7vw, 48px)',
          fontWeight: 900,
          color: COLORS.text,
          lineHeight: 1.15,
          margin: '0 0 12px',
          maxWidth: 560,
        }}
      >
        Tu hijo no es flojo.
        <br />
        <span style={{ color: COLORS.primary }}>Solo necesita</span>
        <br />
        el método correcto.
      </h1>

      {/* Subheadline */}
      <p
        style={{
          fontSize: 17,
          color: COLORS.muted,
          fontFamily: FONTS.nunito,
          lineHeight: 1.65,
          maxWidth: 400,
          margin: '0 0 36px',
        }}
      >
        Pasas convierte cada materia en una historia que tu hijo{' '}
        <strong style={{ color: COLORS.text }}>entiende y recuerda</strong>.
        Sin regañadas. Sin clases extra.
      </p>

      {/* Social proof */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 36,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex' }}>
          {['👩', '👨', '👩', '👨', '👩'].map((emoji, i) => (
            <span
              key={i}
              style={{
                fontSize: 22,
                marginLeft: i === 0 ? 0 : -6,
                filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))',
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
        <p
          style={{
            fontSize: 13,
            color: COLORS.muted,
            fontFamily: FONTS.nunito,
            margin: 0,
            fontWeight: 600,
          }}
        >
          +260 familias ya lo usan
        </p>
      </div>

      {/* CTA principal */}
      <button
        onClick={() => router.push('/onboarding')}
        style={{
          width: '100%',
          maxWidth: 360,
          minHeight: 56,
          backgroundColor: COLORS.primary,
          border: 'none',
          borderRadius: RADIUS.xl,
          fontSize: 17,
          fontWeight: 900,
          color: '#fff',
          cursor: 'pointer',
          fontFamily: FONTS.nunito,
          marginBottom: 14,
          boxShadow: '0 0 32px rgba(139,92,246,0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)'
          e.currentTarget.style.boxShadow = '0 0 48px rgba(139,92,246,0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 0 32px rgba(139,92,246,0.35)'
        }}
      >
        Pruébalo 7 días gratis →
      </button>

      {/* CTA secundario */}
      <p
        style={{
          fontSize: 13,
          color: COLORS.muted,
          fontFamily: FONTS.nunito,
          margin: 0,
          opacity: 0.7,
        }}
      >
        Sin compromiso · Cancela cuando quieras · $249/mes después
      </p>

      {/* Features rápidas */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          marginTop: 48,
          maxWidth: 480,
        }}
      >
        {[
          { emoji: '📚', text: 'Todas las materias de secundaria' },
          { emoji: '🎮', text: 'Quizzes con puntos y rachas' },
          { emoji: '📊', text: 'Ves el progreso de tu hijo' },
          { emoji: '🤖', text: 'IA que explica a su nivel' },
        ].map(({ emoji, text }) => (
          <div
            key={text}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: RADIUS.lg,
              padding: '8px 14px',
            }}
          >
            <span style={{ fontSize: 16 }}>{emoji}</span>
            <span
              style={{
                fontSize: 13,
                color: COLORS.muted,
                fontFamily: FONTS.nunito,
                fontWeight: 600,
              }}
            >
              {text}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
