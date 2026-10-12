'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Pasita from '@/components/mascota/Pasita'
import { track } from '@/lib/analytics/track'

/**
 * Entrada al tema desde el reto (s42): un toque para elegir con qué se lo
 * explicamos. El contenido de PASAS existe en 4 versiones por hobby y sin
 * cuenta no sabemos cuál le gusta. La pregunta, además, es el gancho: es lo
 * que distingue a PASAS de una guía cualquiera.
 */
export default function ElegirTematica({
  topicName,
  subjectName,
  materia,
  perfecto,
  opciones,
}: {
  topicName: string
  subjectName: string
  materia: string | null
  perfecto: boolean
  opciones: { clave: string; nombre: string; emoji: string; href: string }[]
}) {
  const visto = useRef(false)
  useEffect(() => {
    if (visto.current) return
    visto.current = true
    track('tema_muestra_entrada', { materia: materia ?? undefined, resultado: perfecto ? 'perfecto' : 'fallo' })
  }, [materia, perfecto])

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0f0a1e',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
        display: 'flex',
        justifyContent: 'center',
        padding: '20px 16px 32px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Link href="/arcade" style={{ color: '#a78bfa', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
          ← Volver al reto
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pasita pose={perfecto ? 'celebrando' : 'pensativa'} size={72} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#a78bfa' }}>
              {subjectName}
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 900, lineHeight: 1.2, color: '#f0e6ff' }}>{topicName}</h1>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.16), rgba(236,72,153,0.1))',
            border: '1px solid rgba(167,139,250,0.35)',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 900, color: '#f0e6ff' }}>
            {perfecto ? 'Cinco de cinco en el reto 🔥' : 'Fallaste este tema en el reto 👀'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#c4b5fd', marginTop: 2 }}>
            {perfecto ? 'Ahora el tema completo, de fácil a difícil.' : 'Te lo explicamos y luego lo practicas.'}
          </div>
          <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 10, lineHeight: 1.5 }}>
            Explicación con audio · minijuegos · quiz. Gratis y sin registrarte.
          </div>
        </div>

        <h2 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 900, textAlign: 'center' }}>¿Con qué te lo explicamos?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {opciones.map((o) => (
            <Link
              key={o.clave}
              href={o.href}
              onClick={() => track('tema_muestra_tematica', { materia: materia ?? undefined, theme: o.clave })}
              style={{
                minHeight: 88,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: '#1a1035',
                border: '1.5px solid rgba(124,58,237,0.45)',
                borderRadius: 16,
                color: '#f0e6ff',
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden="true">
                {o.emoji}
              </span>
              {o.nombre}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
