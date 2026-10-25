'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Pasita from '@/components/mascota/Pasita'
import { track } from '@/lib/analytics/track'
import { TEMATICAS, urlTemaMuestra } from '@/lib/tema-muestra'
import type { MateriaClaseGratis } from '@/lib/tema-muestra-server'

/**
 * Formulario de la clase gratis (s51). Tres preguntas en una sola pantalla,
 * cada una aparece al contestar la anterior: nivel y grado → materia → hobby.
 * El último toque ya es el enlace a la clase.
 *
 * 🔴 No se elige tema: cada materia tiene UNO fijo (clase_gratis). Aquí solo
 * se ve el nombre de la materia, nunca la lista de temas.
 */

type Nivel = 'secundaria' | 'prepa'

const NIVELES: { clave: Nivel; texto: string }[] = [
  { clave: 'secundaria', texto: 'Secundaria' },
  { clave: 'prepa', texto: 'Prepa' },
]

const morado = '#7c3aed'

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 12,
        border: `1.5px solid ${activo ? '#a78bfa' : '#2D2048'}`,
        background: activo ? 'rgba(124,58,237,0.28)' : '#1a1035',
        color: activo ? '#f0e6ff' : '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
        fontSize: 16,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Pregunta({ n, texto }: { n: number; texto: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#0d9488',
          color: 'white',
          fontSize: 13,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 17, fontWeight: 900, color: '#f0e6ff' }}>{texto}</span>
    </div>
  )
}

export default function ClaseGratisClient({ catalogo }: { catalogo: MateriaClaseGratis[] }) {
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [grado, setGrado] = useState<number | null>(null)
  const [materia, setMateria] = useState<MateriaClaseGratis | null>(null)
  const refMateria = useRef<HTMLDivElement>(null)
  const refHobby = useRef<HTMLDivElement>(null)

  const visto = useRef(false)
  useEffect(() => {
    if (visto.current) return
    visto.current = true
    track('clase_gratis_vista', {})
  }, [])

  const materias = useMemo(
    () => (nivel && grado ? catalogo.filter((m) => m.nivel === nivel && m.grado === grado) : []),
    [catalogo, nivel, grado]
  )

  // Al abrirse la siguiente pregunta, se acerca a la vista SOLO si quedó fuera
  // de la pantalla, y lo mínimo ('nearest'). Antes siempre jalaba la página
  // hasta arriba de la sección: si la persona estaba haciendo scroll al mismo
  // tiempo, las dos cosas peleaban y se sentía trabado.
  const bajarA = (ref: React.RefObject<HTMLDivElement | null>) =>
    window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.top > window.innerHeight - 120) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)

  function elegirNivel(n: Nivel) {
    setNivel(n)
    setMateria(null)
    track('clase_gratis_paso', { paso: 'nivel', elemento: n })
  }
  function elegirGrado(g: number) {
    setGrado(g)
    setMateria(null)
    track('clase_gratis_paso', { paso: 'grado', elemento: String(g) })
    bajarA(refMateria)
  }
  function elegirMateria(m: MateriaClaseGratis) {
    setMateria(m)
    track('clase_gratis_paso', { paso: 'materia', elemento: m.subjectSlug })
    bajarA(refHobby)
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0f0a1e',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
        display: 'flex',
        justifyContent: 'center',
        padding: '20px 16px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Link href="/" style={{ color: '#a78bfa', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
          ← Volver
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pasita pose="confiada" size={76} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.2, color: '#f0e6ff' }}>
              Tu primera clase gratis
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: '#c4b5fd', lineHeight: 1.4 }}>
              Explicada con lo que le gusta. Sin registrarte.
            </p>
          </div>
        </div>

        {/* 1 · Nivel y grado */}
        <section>
          <Pregunta n={1} texto="¿En qué grado va?" />
          <div style={{ display: 'flex', gap: 8 }}>
            {NIVELES.map((n) => (
              <Chip key={n.clave} activo={nivel === n.clave} onClick={() => elegirNivel(n.clave)}>
                {n.texto}
              </Chip>
            ))}
          </div>
          {nivel && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[1, 2, 3].map((g) => (
                <Chip key={g} activo={grado === g} onClick={() => elegirGrado(g)}>
                  {g}°
                </Chip>
              ))}
            </div>
          )}
        </section>

        {/* 2 · Materia */}
        {nivel && grado && (
          <section ref={refMateria} style={{ scrollMarginTop: 16 }}>
            <Pregunta n={2} texto="¿Qué materia le cuesta más?" />
            {materias.length === 0 ? (
              <p style={{ color: '#c4b5fd', fontSize: 15 }}>Todavía no hay clases para este grado.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {materias.map((m) => {
                  const activo = materia?.subjectSlug === m.subjectSlug
                  return (
                    <button
                      key={m.subjectSlug}
                      type="button"
                      onClick={() => elegirMateria(m)}
                      aria-pressed={activo}
                      style={{
                        minHeight: 56,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: `1.5px solid ${activo ? '#a78bfa' : '#2D2048'}`,
                        background: activo ? 'rgba(124,58,237,0.28)' : '#1a1035',
                        color: '#e2d9f3',
                        fontFamily: 'var(--font-nunito)',
                        fontSize: 14,
                        fontWeight: 800,
                        lineHeight: 1.25,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Los nombres de prepa traen el nombre largo entre paréntesis. */}
                      {m.nombre.replace(/\s*\(.*\)\s*$/, '')}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* 3 · Hobby: cada botón ya es la clase */}
        {materia && (
          <section ref={refHobby} style={{ scrollMarginTop: 16 }}>
            <Pregunta n={3} texto="¿Con qué se la explicamos?" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TEMATICAS.map((t) => (
                <Link
                  key={t.clave}
                  href={urlTemaMuestra(materia.subjectSlug, materia.topicSlug, { tematica: t.clave, from: 'clase' })}
                  onClick={() => track('clase_gratis_elegida', { elemento: materia.subjectSlug, theme: t.clave })}
                  style={{
                    minHeight: 64,
                    borderRadius: 14,
                    background: morado,
                    color: 'white',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 17,
                    fontWeight: 900,
                    boxShadow: '0 0 24px rgba(124,58,237,0.35)',
                  }}
                >
                  <span aria-hidden="true">{t.emoji}</span> {t.corto}
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: 13, color: '#a78bfa', textAlign: 'center' }}>
              Explicación, minijuegos y quiz · unos 10 minutos
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
