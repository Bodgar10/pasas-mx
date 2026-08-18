import type { Metadata } from 'next'
import { Nunito, Orbitron } from 'next/font/google'
import WhatsAppButton from '@/components/global/WhatsAppButton'

/**
 * 🔴 noindex PARA TODO EL GRUPO DE AUTENTICACIÓN.
 *
 * Cubre /login, /registro, /recuperar, /nueva-contrasena y /bienvenida. Las
 * cinco responden 200 a un bot anónimo y no aportan nada en resultados de
 * búsqueda: son formularios. /bienvenida además es la pantalla de después del
 * cobro, y no tiene ningún sentido que aparezca en Google.
 *
 * 🔴 VA EN EL LAYOUT PORQUE NO PUEDE IR EN LAS PÁGINAS. Las cinco son
 * `'use client'`, y un componente de cliente no puede exportar `metadata`:
 * Next solo la lee de componentes de servidor. Este layout sí lo es.
 *
 * 🔴 ESTO NO BLOQUEA NADA. Es una etiqueta en el <head>: cualquiera entra a
 * /login y se registra exactamente igual que antes.
 *
 * Va acompañado de un Disallow en src/app/robots.ts. Ver la nota del layout de
 * (protected) para por qué las dos cosas y no una.
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
      <WhatsAppButton />
    </div>
  )
}
 