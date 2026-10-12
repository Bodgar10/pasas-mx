'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { ConnectBlock, OrderStepsBlock } from '@/components/guia/InteractiveBlocks'
import mate1 from '../../../../scripts/minijuegos/contenido/matematicas-sec-1.json'

/**
 * Taller de minijuegos (s43). Solo desarrollo.
 *
 * Pinta Conecta y Arma los pasos desde los archivos de contenido ANTES de
 * cargarlos a la base, con la misma tarjeta que usa la guía. Sirve para
 * revisar a 360-430px que nada se corte.
 *
 * 🔴 No enlazar esta ruta desde ningún sitio. Se entra escribiendo /dev/minijuegos.
 */

type Archivo = {
  subject: string
  topics: Record<
    string,
    {
      order_steps?: Record<string, unknown> | null
      temas: Record<string, { connect?: Record<string, unknown> | null; order_steps?: Record<string, unknown> | null }>
    }
  >
}

const ARCHIVOS: Archivo[] = [mate1 as Archivo]

function Tarjeta({ label, icon, color, children }: { label: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1a1035', border: `1px solid ${color}40`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${color}40`,
          background: `${color}10`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color }}>{label}</span>
      </div>
      {children}
    </div>
  )
}

export default function TallerMinijuegos() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [archivo, setArchivo] = useState(0)
  const arch = ARCHIVOS[archivo]
  const temas = Object.keys(arch.topics)
  const [tema, setTema] = useState(temas[0])
  const [tematica, setTematica] = useState('Anime & Manga')
  const [clave, setClave] = useState(0)

  const t = arch.topics[tema]
  const bloque = t?.temas[tematica] ?? {}
  const os = bloque.order_steps !== undefined ? bloque.order_steps : t?.order_steps

  const sel: React.CSSProperties = {
    background: '#1a1035',
    color: '#e2d9f3',
    border: '1px solid #7c3aed',
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 13,
    maxWidth: '100%',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2d9f3', fontFamily: 'var(--font-nunito)', padding: 16 }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }} data-testid="controles">
          <select style={sel} value={archivo} onChange={(e) => { setArchivo(Number(e.target.value)); setTema(Object.keys(ARCHIVOS[Number(e.target.value)].topics)[0]) }}>
            {ARCHIVOS.map((a, i) => <option key={a.subject} value={i}>{a.subject}</option>)}
          </select>
          <select style={sel} value={tema} onChange={(e) => setTema(e.target.value)} data-testid="tema">
            {temas.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select style={sel} value={tematica} onChange={(e) => setTematica(e.target.value)} data-testid="tematica">
            {['Anime & Manga', 'Fútbol', 'K-pop & K-dramas', 'Videojuegos'].map((x) => <option key={x}>{x}</option>)}
          </select>
          <button style={sel} onClick={() => setClave((k) => k + 1)}>Reiniciar</button>
        </div>

        <div key={`${archivo}-${tema}-${tematica}-${clave}`}>
          {bloque.connect ? (
            <Tarjeta label="Conecta" icon="🔗" color="#ec4899">
              <div data-testid="conecta"><ConnectBlock data={bloque.connect} /></div>
            </Tarjeta>
          ) : (
            <p style={{ opacity: 0.6 }}>Conecta: no aplica</p>
          )}
          {os ? (
            <Tarjeta label="Arma los pasos" icon="🧩" color="#a78bfa">
              <div data-testid="arma"><OrderStepsBlock data={os} /></div>
            </Tarjeta>
          ) : (
            <p style={{ opacity: 0.6 }}>Arma los pasos: no aplica</p>
          )}
        </div>
      </div>
    </div>
  )
}
