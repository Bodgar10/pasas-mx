import Link from 'next/link'
import type { Metadata } from 'next'

// Solo el canonical. El title y la description de esta página son otro trabajo;
// aquí lo único que hace falta es que no compita consigo misma si se sirve por
// más de un host. Relativo: lo resuelve el metadataBase del layout raíz.
export const metadata: Metadata = {
  alternates: { canonical: '/status' },
}

const SERVICES = [
  { name: 'Plataforma web', description: 'pasas.mx y dashboard', status: 'operational' },
  { name: 'Autenticación', description: 'Login y registro', status: 'operational' },
  { name: 'Contenido', description: 'Guías y quizzes', status: 'operational' },
  { name: 'Pagos (Stripe)', description: 'Suscripciones y cobros', status: 'operational' },
  { name: 'Base de datos', description: 'Supabase PostgreSQL', status: 'operational' },
  { name: 'IA (Anthropic)', description: 'Generación de contenido personalizado', status: 'operational' },
]

const STATUS_CONFIG = {
  operational: { label: '✓ Operacional', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  degraded: { label: '⚠ Degradado', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
  down: { label: '✕ Caído', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
}

export default function StatusPage() {
  const allOperational = SERVICES.every(s => s.status === 'operational')

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-nunito)',
      color: '#e2d9f3',
      padding: '48px 24px 80px',
      maxWidth: 640,
      margin: '0 auto',
    }}>
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
        Estado del sistema
      </h1>
      <p style={{ fontSize: 15, color: '#a78bfa', marginBottom: 32, lineHeight: 1.6 }}>
        Estado actual de los servicios de Pasas.mx
      </p>

      {/* Banner general */}
      <div style={{
        background: allOperational ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.1)',
        border: `1px solid ${allOperational ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'}`,
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>{allOperational ? '✅' : '⚠️'}</div>
        <div>
          <div style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 16, fontWeight: 900,
            color: allOperational ? '#10b981' : '#fbbf24',
            marginBottom: 4,
          }}>
            {allOperational ? 'Todos los sistemas operacionales' : 'Algunos sistemas con problemas'}
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa' }}>
            Actualizado manualmente · {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Lista de servicios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
        {SERVICES.map(service => {
          const cfg = STATUS_CONFIG[service.status as keyof typeof STATUS_CONFIG]
          return (
            <div key={service.name} style={{
              background: '#1a1035',
              border: '1px solid rgba(124,58,237,0.15)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#e2d9f3', marginBottom: 2 }}>
                  {service.name}
                </div>
                <div style={{ fontSize: 13, color: '#a78bfa' }}>
                  {service.description}
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 800,
                background: cfg.bg, color: cfg.color,
                border: `1px solid ${cfg.border}`,
                borderRadius: 50, padding: '4px 12px',
                whiteSpace: 'nowrap',
              }}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{
        background: 'rgba(124,58,237,0.06)',
        border: '1px solid rgba(124,58,237,0.15)',
        borderRadius: 12,
        padding: '14px 18px',
        fontSize: 14,
        color: '#a78bfa',
        lineHeight: 1.6,
        marginBottom: 40,
      }}>
        Si experimentas algún problema no reflejado aquí, contáctanos en{' '}
        <a href="mailto:soporte@pasas.mx" style={{ color: '#c4b5fd', fontWeight: 700 }}>
          soporte@pasas.mx
        </a>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { href: '/ayuda', label: 'Ayuda' },
          { href: '/como-cancelar', label: 'Cómo cancelar' },
          { href: '/privacidad', label: 'Privacidad' },
          { href: '/terminos', label: 'Términos' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={{ fontSize: 13, color: 'rgba(167,139,250,0.5)', textDecoration: 'none', fontWeight: 600 }}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
