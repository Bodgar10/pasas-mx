import { Nunito, Orbitron } from 'next/font/google'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  weight: ['700', '900'],
  display: 'swap',
})

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${nunito.variable} ${orbitron.variable} min-h-screen`}
      style={{ fontFamily: 'var(--font-nunito)' }}
    >
      {children}
      <footer style={{
        borderTop: '1px solid rgba(124,58,237,0.15)',
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px 16px',
        marginTop: 'auto',
      }}>
        {[
          { href: '/ayuda', label: '❓ Ayuda' },
          { href: '/como-cancelar', label: '🚪 Cómo cancelar' },
          { href: '/privacidad', label: 'Privacidad' },
          { href: '/terminos', label: 'Términos' },
          { href: '/reembolso', label: 'Reembolsos' },
          { href: '/status', label: '🟢 Status' },
        ].map(({ href, label }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: 'rgba(167,139,250,0.5)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {label}
          </a>
        ))}
        <span style={{ fontSize: 12, color: 'rgba(167,139,250,0.3)', width: '100%', textAlign: 'center' }}>
          © 2026 Pasas.mx · Hecho en México 🇲🇽
        </span>
      </footer>
    </div>
  )
}
