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
      style={{ backgroundColor: '#0f0a1e', fontFamily: 'var(--font-nunito)' }}
    >
      {children}
    </div>
  )
}
