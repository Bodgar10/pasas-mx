import type { Metadata } from 'next'
import { Nunito, Orbitron } from 'next/font/google'
import WhatsAppButton from '@/components/global/WhatsAppButton'

/**
 * 🔴 noindex PARA TODO EL GRUPO, Y VA EN EL LAYOUT A PROPÓSITO.
 *
 * Cubre /dashboard, /guia, /perfil, /planes, /onboarding, /onboarding/preview,
 * /generando, /agregar-alumno y /personalizado de una sola vez. Puesto por
 * página serían nueve sitios donde acordarse, y la décima ruta que alguien
 * añada mañana nacería indexable.
 *
 * 🔴 Y HACÍA FALTA DE VERDAD, no es precaución: el middleware solo protege
 * /dashboard, /guia, /perfil y /admin. Todo lo demás de este grupo respondía
 * 200 a un bot anónimo — /planes y /onboarding, que son el embudo de compra,
 * estaban indexables sin que nadie lo decidiera.
 *
 * 🔴 ESTO NO BLOQUEA EL ACCESO. Es una etiqueta en el <head> y nada más: quien
 * tenga sesión entra exactamente igual que antes. Quien controla el acceso es
 * el middleware, y no se ha tocado. No uses esto como si fuera un candado.
 *
 * Va acompañado de un Disallow en src/app/robots.ts. Las dos cosas, porque
 * hacen cosas distintas: noindex saca de resultados lo que ya esté indexado,
 * Disallow evita que se vuelva a rastrear.
 *
 * Las páginas de este grupo que exporten su propia `metadata` heredan este
 * `robots` mientras no declaren uno suyo. La única que lo declara es
 * personalizado/layout.tsx, y dice lo mismo.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
      <WhatsAppButton />
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
