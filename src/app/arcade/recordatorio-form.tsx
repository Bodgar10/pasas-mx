'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics/track'
import { anonIdJuegos } from '@/lib/arcade'
import { atribucionJuegos } from '@/lib/arcade/canal'
import s from './arcade.module.css'

/**
 * "¿Te aviso cuando salga el reto de mañana?" (s34-F5). Solo se monta con
 * FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO. Doble opt-in: aquí solo se pide
 * el correo; la suscripción vale cuando se confirma desde el correo.
 *
 * 🔴 Sin correo en los eventos de analítica: pueden ser menores.
 */
const LLAVE = 'pasas-arcade:recordatorio-enviado'

export default function RecordatorioForm() {
  const [oculto, setOculto] = useState(true)
  const [email, setEmail] = useState('')
  const [mayor, setMayor] = useState(false)
  const [trampa, setTrampa] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      let enviado = false
      try {
        enviado = !!window.localStorage.getItem(LLAVE)
      } catch {}
      setOculto(enviado)
      if (!enviado) track('arcade_recordatorio_visto', { canal: atribucionJuegos().canal })
    })()
  }, [])

  if (oculto && estado !== 'ok') return null

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (estado === 'enviando') return
    setEstado('enviando')
    setError('')
    let ok = false
    try {
      const res = await fetch('/api/arcade/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mayor, trampa, anonId: anonIdJuegos(), canal: atribucionJuegos().canal }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      ok = res.ok && !!json.ok
      if (!ok) setError(json.error ?? 'No se pudo enviar. Intenta otra vez.')
    } catch {
      setError('No se pudo enviar. Revisa tu conexión.')
    }
    track('arcade_recordatorio_enviado', { ok })
    if (ok) {
      try {
        window.localStorage.setItem(LLAVE, '1')
      } catch {}
      setEstado('ok')
    } else {
      setEstado('error')
    }
  }

  if (estado === 'ok') {
    return (
      <div className={s.card}>
        <h3>Revisa tu correo</h3>
        <p className={s.exampleNote}>Te mandamos un correo para confirmar. Revisa tu bandeja.</p>
      </div>
    )
  }

  return (
    <form className={s.card} onSubmit={enviar} noValidate>
      <h3>¿Te aviso cuando salga el reto de mañana?</h3>
      <label htmlFor="recordatorio-email" className={s.srOnly}>
        Correo
      </label>
      <input
        id="recordatorio-email"
        className={s.input}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {/* Campo trampa: invisible para personas, visible para bots. */}
      <input
        type="text"
        name="sitio_web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={trampa}
        onChange={(e) => setTrampa(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      <label htmlFor="recordatorio-mayor" className={s.check}>
        <input id="recordatorio-mayor" type="checkbox" checked={mayor} onChange={(e) => setMayor(e.target.checked)} />
        <span>Tengo 18 años o más</span>
      </label>
      <p className={s.fine} style={{ textAlign: 'left' }}>
        Si eres estudiante, pídele a tu mamá, papá o maestro que se suscriba.{' '}
        <Link href="/privacidad" className={s.link}>
          Aviso de privacidad
        </Link>
      </p>
      {error && (
        <p role="alert" style={{ color: 'var(--bad)', fontWeight: 800, fontSize: 14 }}>
          {error}
        </p>
      )}
      <button className={`${s.btn} ${s.primary}`} type="submit" disabled={estado === 'enviando' || !email || !mayor}>
        {estado === 'enviando' ? 'Enviando…' : 'Avísame'}
      </button>
    </form>
  )
}
