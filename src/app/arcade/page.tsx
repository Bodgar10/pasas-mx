import type { Metadata } from 'next'
import Link from 'next/link'
import { leerRetoDeHoy } from '@/lib/arcade-server'
import { SITIO } from '@/lib/seo'
import ArcadeClient from './arcade-client'
import s from './arcade.module.css'

/**
 * PASAS Arcade — reto diario público, sin login.
 *
 * 🔴 ISR de 60 s y no estático: el reto cambia a medianoche de la Ciudad de
 * México. En el peor caso alguien ve el de ayer un minuto; la cuenta
 * regresiva del cliente recarga sola al llegar a cero.
 */
export const revalidate = 60

const TITULO = '¿Cuál sobra? · Reto diario de Historia | PASAS'
const DESCRIPCION =
  'Cinco rondas, dos minutos. Tres cosas tienen algo en común y una no. Un reto nuevo de historia cada día, el mismo para todos.'

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: '/arcade' },
  openGraph: {
    title: '¿Cuál sobra? · Reto diario de Historia',
    description: DESCRIPCION,
    url: '/arcade',
    siteName: 'Pasas.mx',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '¿Cuál sobra? · Reto diario de Historia',
    description: DESCRIPCION,
  },
}

export default async function ArcadePage() {
  const reto = await leerRetoDeHoy()

  if (!reto || !reto.rounds || reto.rounds.length === 0) {
    return (
      <main className={s.root}>
        <div className={`${s.wrap} ${s.empty}`}>
          <h2>El reto de hoy se está preparando</h2>
          <p className={s.lead}>Vuelve en unos minutos.</p>
          <Link className={s.link} href="/">
            Ir a PASAS
          </Link>
        </div>
      </main>
    )
  }

  return <ArcadeClient reto={reto} dominio={SITIO} />
}
