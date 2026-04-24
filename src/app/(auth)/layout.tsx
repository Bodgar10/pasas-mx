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
 
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${nunito.variable} ${orbitron.variable} min-h-screen flex items-center justify-center px-4 py-12`}
      style={{ fontFamily: 'var(--font-nunito)' }}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
 