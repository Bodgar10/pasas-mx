'use client'

import Pasita from '@/components/mascota/Pasita'

import React, { useState, useEffect, useRef } from 'react'
import {
  permutacionSinFijos,
  primerError,
  semillaDe,
  validarConnect,
  validarOrderSteps,
  type ConnectData,
  type OrderStepsData,
} from '@/lib/minijuegos'

// Tipos de sección que llevan audio narrado (bloques de texto).
export const AUDIO_TEXT_TYPES = new Set<string>(['explanation', 'analogy', 'example', 'key_fact', 'tip'])

// Registro global para que solo un audio suene a la vez en toda la página.
const audioRegistry = new Set<HTMLAudioElement>()

/**
 * Callback de ANALITICA comun a los cinco bloques interactivos.
 *
 * 🔴 Solo informa. Ningun bloque cambia su mecanica, su XP ni su condicion
 * de completado por esto: si `onProgreso` es undefined el bloque se comporta
 * exactamente igual.
 *
 * Existe porque ninguno de los cinco se desmonta —viven dentro de la pestaña
 * `guia` de topic-client, que se oculta con display:none— asi que el padre no
 * tiene forma de saber por donde se quedo alguien que abandono. `paso` es lo
 * que hace util a `interactivo_abandonado`.
 */
export type ProgresoInteractivo = {
  /** Descripcion corta del punto alcanzado. Ej: 'paso_3', 'ejercicio_2'. */
  paso: string
  /** Intentos consumidos hasta aqui, cuando el bloque lleva la cuenta. */
  intentos?: number
}

export type OnProgreso = (p: ProgresoInteractivo) => void

export function RevealOnScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true)
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {children}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // pre-line respeta los saltos de línea del contenido (los ejemplos traen
  // "**Paso 1:** …" en renglones separados) y sigue juntando espacios.
  const parts = text.split('**')
  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ fontWeight: 800, color: '#e2d9f3' }}>{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

export function CollapsibleText({ text, collapsedHeight = 78 }: { text: string; collapsedHeight?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            maxHeight: open ? 9999 : collapsedHeight,
            overflow: 'hidden',
            fontSize: 15,
            lineHeight: 1.75,
            color: '#e2d9f3',
            transition: 'max-height 0.3s ease',
          }}
        >
          {renderInline(text)}
        </div>
        {!open && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 40,
              background: 'linear-gradient(to bottom, rgba(26,16,53,0), #1a1035)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          marginTop: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#a78bfa',
          fontSize: 13,
          fontWeight: 800,
          fontFamily: 'var(--font-nunito)',
          padding: 0,
        }}
      >
        {open ? 'Leer menos ↑' : 'Leer más ↓'}
      </button>
    </div>
  )
}

interface ScrubberData {
  intro?: string
  unit: string
  min: number
  max: number
  start: number
  points: { v: number; l: string }[]
  question?: string
}

export function ScrubberBlock({
  data,
  onComplete,
  onProgreso,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
}) {
  const sc = data as unknown as ScrubberData | null
  const [val, setVal] = useState<number>(() => sc?.start ?? 0)
  const [moved, setMoved] = useState(false)

  if (!sc || !Array.isArray(sc.points) || typeof sc.min !== 'number' || typeof sc.max !== 'number') {
    return null
  }

  const closest = sc.points.reduce((p, q) =>
    Math.abs(q.v - val) < Math.abs(p.v - val) ? q : p
  )

  return (
    <div style={{ padding: '14px 16px' }}>
      {sc.intro && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sc.intro}
        </div>
      )}
      <div style={{
        background: '#0f0a1e',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 12,
        padding: '16px 14px',
        textAlign: 'center',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {sc.unit}
        </div>
        <div style={{
          fontFamily: 'var(--font-orbitron)',
          fontSize: 32,
          fontWeight: 900,
          color: val >= 0 ? '#06b6d4' : '#ec4899',
        }}>
          {val > 0 ? `+${val}` : val}
        </div>
        <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 2 }}>
          {closest.l}
        </div>
      </div>
      <input
        type="range"
        min={sc.min}
        max={sc.max}
        value={val}
        onChange={(e) => {
          setVal(Number(e.target.value))
          if (!moved) {
            setMoved(true)
            // 🔴 El scrubber se completa al PRIMER movimiento: no tiene
            // estado intermedio ni condicion de acierto. Por eso `inicio` y
            // `completado` ocurren a la vez, y por eso este bloque no puede
            // abandonarse — o no lo tocaste, o lo completaste.
            onProgreso?.({ paso: 'movido' })
            onComplete?.()
          }
        }}
        style={{ width: '100%', accentColor: '#ec4899' }}
      />
      {sc.question && (
        <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 8, lineHeight: 1.6 }}>
          {sc.question}
        </div>
      )}
    </div>
  )
}

interface StepsData {
  intro?: string
  visual?: 'bar' | 'chain'
  start?: number
  steps: { text: string; delta?: number }[]
}

export function StepsBlock({
  data,
  onComplete,
  onProgreso,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
}) {
  const sd = data as unknown as StepsData | null
  const [step, setStep] = useState(0)

  if (!sd || !Array.isArray(sd.steps) || sd.steps.length === 0) {
    return null
  }

  const isBar = sd.visual === 'bar'
  const start = sd.start ?? 0
  const value = isBar
    ? start + sd.steps.slice(0, step).reduce((a, s) => a + (s.delta ?? 0), 0)
    : 0
  const barColor = value > 50 ? '#10b981' : value > 25 ? '#fbbf24' : '#ec4899'
  const done = step >= sd.steps.length

  return (
    <div style={{ padding: '14px 16px' }}>
      {sd.intro && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sd.intro}
        </div>
      )}

      {isBar && (
        <>
          <div style={{
            position: 'relative', height: 34, borderRadius: 50,
            background: '#000', border: `1px solid ${barColor}`,
            overflow: 'hidden', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.max(0, Math.min(100, value))}%`,
              background: barColor, transition: 'width 0.5s ease, background 0.5s ease',
            }} />
            <span style={{
              position: 'relative', zIndex: 1,
              fontFamily: 'var(--font-orbitron)', fontWeight: 900,
              fontSize: 14, color: '#0f0a1e',
            }}>
              {value}
            </span>
          </div>
          <div style={{
            textAlign: 'center', fontSize: 14, marginBottom: 14,
            fontFamily: 'var(--font-orbitron)', color: '#a78bfa',
          }}>
            {start}
            {sd.steps.slice(0, step).map((s, i) => (
              <span key={i} style={{ color: (s.delta ?? 0) < 0 ? '#ec4899' : '#10b981' }}>
                {' '}{(s.delta ?? 0) < 0 ? '−' : '+'} {Math.abs(s.delta ?? 0)}
              </span>
            ))}
            {step > 0 && <span style={{ color: barColor }}> = {value}</span>}
          </div>
        </>
      )}

      {!isBar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {sd.steps.slice(0, step).map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: 10, padding: '10px 14px', fontSize: 15, color: '#e2d9f3',
            }}>
              <span style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 900, color: '#06b6d4', marginRight: 8 }}>
                {i + 1}.
              </span>
              {s.text}
            </div>
          ))}
        </div>
      )}

      {!done ? (
        <button
          type="button"
          onClick={() => {
            const next = step + 1
            setStep(next)
            // Cada avance deja constancia de por donde va. Es lo unico que
            // permite saber en que paso se atasco quien no llego al final.
            onProgreso?.({ paso: `paso_${next}` })
            if (next >= sd.steps.length) onComplete?.()
          }}
          style={{
            width: '100%', minHeight: 52,
            background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', color: '#fff',
            border: 'none', borderRadius: 12,
            fontFamily: 'var(--font-nunito)', fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(6,182,212,0.3)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          }}
        >
          <span>
            {isBar
              ? `${sd.steps[step].text} ${(sd.steps[step].delta ?? 0) < 0 ? '−' : '+'}${Math.abs(sd.steps[step].delta ?? 0)}`
              : 'Siguiente paso'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
            {step === 0 ? '👆 Toca para empezar' : `Paso ${step + 1} de ${sd.steps.length} · toca →`}
          </span>
        </button>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#6ee7b7' }}>
          ✓ ¡Completado!
        </div>
      )}
    </div>
  )
}

interface SortData {
  prompt?: string
  buckets: string[]
  items: { t: string; b: number }[]
}

export function SortBlock({
  data,
  onComplete,
  onProgreso,
  onFallo,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
  /** Comprobo y NO acerto. Ver la nota de `check` mas abajo. */
  onFallo?: (d: { intentos: number }) => void
}) {
  const sort = data as unknown as SortData | null
  // Solo para analitica: no entra en ningun render ni en la condicion de
  // completado.
  const intentosRef = useRef(0)
  const [assign, setAssign] = useState<number[]>(
    () => (sort?.items ?? []).map(() => -1)
  )
  const [checked, setChecked] = useState(false)
  const downRef = useRef<{ x: number; y: number } | null>(null)

  if (!sort || !Array.isArray(sort.items) || !Array.isArray(sort.buckets)) {
    return null
  }

  const nb = sort.buckets.length
  if (nb < 2 || nb > 4) return null
  if (sort.items.length === 0) return null
  if (assign.length !== sort.items.length) return null
  const dataOk = sort.items.every(
    (it) =>
      it &&
      typeof it.t === 'string' &&
      typeof it.b === 'number' &&
      it.b >= 0 &&
      it.b < nb
  )
  if (!dataOk) return null

  const allDone = assign.every((a) => a !== -1)
  const correct = assign.every((a, i) => a === sort.items[i].b)
  const pendingCount = assign.filter((a) => a === -1).length

  const parts = sort.buckets.map((b) => {
    const s = String(b ?? '').trim()
    const m = s.match(/^(.+?)\s*\(([^)]*)\)\s*$/)
    return m ? { main: m[1].trim(), hint: m[2].trim() } : { main: s, hint: '' }
  })
  const maxMain = Math.max(...parts.map((p) => p.main.length))
  const stacked = nb >= 4 || (nb === 3 ? maxMain > 12 : maxMain > 20)

  return (
    <div style={{ padding: '14px 16px' }}>
      {!checked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }} aria-hidden="true">👆</span>
          <span
            style={{
              fontSize: 11,
              color: '#fbbf24',
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            Toca dónde va cada uno, luego revisa
          </span>
        </div>
      )}
      {sort.prompt && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sort.prompt}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {sort.items.map((it, i) => {
          const bk = assign[i]
          const ok = checked && bk === it.b
          const bad = checked && bk !== it.b
          const borderC = ok ? '#10b981' : bad ? '#ef4444' : 'rgba(124,58,237,0.25)'
          return (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${borderC}`,
                borderRadius: 10,
                padding: '11px 12px 12px',
              }}
            >
              <div
                style={{
                  fontSize: 15, color: '#e2d9f3', marginBottom: 9,
                  fontFamily: 'var(--font-nunito)', fontWeight: 600, lineHeight: 1.4,
                }}
              >
                {it.t}
              </div>
              <div
                role="radiogroup"
                aria-label={it.t}
                style={{
                  display: 'grid',
                  gridTemplateColumns: stacked ? '1fr' : `repeat(${nb}, 1fr)`,
                  gap: 6,
                }}
              >
                {sort.buckets.map((_, bi) => {
                  const sel = bk === bi
                  const isAnswer = checked && bad && it.b === bi
                  return (
                    <button
                      key={bi}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      disabled={checked}
                      onPointerDown={(e) => {
                        downRef.current = { x: e.clientX, y: e.clientY }
                      }}
                      onClick={(e) => {
                        const d = downRef.current
                        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return
                        setAssign((arr) => arr.map((a, j) => (j === i ? bi : a)))
                      }}
                      style={{
                        minHeight: 42,
                        padding: '8px 8px',
                        borderRadius: 8,
                        background: sel ? '#7c3aed' : 'rgba(255,255,255,0.03)',
                        border: sel
                          ? '1.5px solid #7c3aed'
                          : isAnswer
                            ? '1.5px dashed #10b981'
                            : '1px solid rgba(255,255,255,0.10)',
                        color: sel ? '#ffffff' : isAnswer ? '#6ee7b7' : '#b9aed4',
                        fontFamily: 'var(--font-nunito)',
                        fontSize: 13,
                        fontWeight: sel ? 800 : 600,
                        lineHeight: 1.25,
                        cursor: checked ? 'default' : 'pointer',
                        transition: 'background 120ms, border-color 120ms',
                      }}
                    >
                      <span style={{ display: 'block' }}>{parts[bi].main}</span>
                      {parts[bi].hint && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11,
                            fontWeight: 600,
                            opacity: 0.72,
                            marginTop: 2,
                            lineHeight: 1.25,
                          }}
                        >
                          {parts[bi].hint}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {!checked ? (
        <button
          type="button"
          disabled={!allDone}
          onClick={() => {
            setChecked(true)
            intentosRef.current += 1

            /**
             * 🔴 `onComplete` SOLO SI ACIERTA. Es la mecanica existente y no
             * se toca — pero tiene una consecuencia que hay que medir:
             *
             * `interactivo_completado` de `sort` mide "ACERTO", no
             * "TERMINO". Quien comprueba y falla no completa, y como el
             * IntersectionObserver de topic-client excluye los tipos
             * interactivos, esa seccion NO se marca como leida y NO da XP.
             *
             * Sin `onFallo`, un alumno atascado en un sort es invisible: no
             * completa, no gana XP, y no deja rastro de haberlo intentado.
             */
            if (correct) {
              onProgreso?.({ paso: 'correcto', intentos: intentosRef.current })
              onComplete?.()
            } else {
              onProgreso?.({ paso: 'fallo', intentos: intentosRef.current })
              onFallo?.({ intentos: intentosRef.current })
            }
          }}
          style={{
            width: '100%', minHeight: 44,
            background: allDone ? '#7c3aed' : 'rgba(124,58,237,0.2)',
            color: allDone ? 'white' : '#a78bfa', border: 'none', borderRadius: 12,
            fontFamily: 'var(--font-nunito)', fontSize: 15, fontWeight: 800,
            cursor: allDone ? 'pointer' : 'default',
          }}
        >
          {allDone
            ? 'Revisar respuestas'
            : `Falta${pendingCount === 1 ? '' : 'n'} ${pendingCount} por clasificar`}
        </button>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 700, color: correct ? '#6ee7b7' : '#fca5a5' }}>
          {correct
            ? '¡Todo bien clasificado!'
            : 'Revisa los marcados en rojo — la respuesta correcta va con borde verde.'}
        </div>
      )}
    </div>
  )
}

interface MatchData {
  prompt?: string
  pairs: { a: string; b: string }[]
}

export function MatchBlock({
  data,
  onComplete,
  onProgreso,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
}) {
  const md = data as unknown as MatchData | null

  const [cards] = useState(() => {
    if (!md || !Array.isArray(md.pairs)) return [] as { id: number; pairId: number; text: string }[]
    const built: { id: number; pairId: number; text: string }[] = []
    md.pairs.forEach((p, i) => {
      built.push({ id: i * 2, pairId: i, text: p.a })
      built.push({ id: i * 2 + 1, pairId: i, text: p.b })
    })
    for (let i = built.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[built[i], built[j]] = [built[j], built[i]]
    }
    return built
  })

  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const busyRef = useRef(false)
  const flippedRef = useRef<number[]>([])
  // Volteos totales, solo para analitica. Mide cuanto costo el memorama:
  // el minimo posible es 2 por pareja.
  const volteosRef = useRef(0)

  if (!md || !Array.isArray(md.pairs) || md.pairs.length < 2) return null

  const totalPairs = md.pairs.length

  function tap(card: { id: number; pairId: number; text: string }) {
    if (busyRef.current || matched.includes(card.pairId) || flippedRef.current.includes(card.id)) return
    volteosRef.current += 1
    const next = [...flippedRef.current, card.id]
    flippedRef.current = next
    setFlipped(next)
    if (next.length === 2) {
      busyRef.current = true
      const c1 = cards.find((c) => c.id === next[0])!
      const c2 = cards.find((c) => c.id === next[1])!
      if (c1.pairId === c2.pairId) {
        setTimeout(() => {
          const nm = [...matched, c1.pairId]
          setMatched(nm)
          flippedRef.current = []
          setFlipped([])
          busyRef.current = false
          // `paso` es cuantas parejas lleva: es lo que dice donde se
          // quedo quien abandona a medias.
          onProgreso?.({ paso: `parejas_${nm.length}_de_${totalPairs}`, intentos: volteosRef.current })
          if (nm.length === totalPairs) onComplete?.()
        }, 450)
      } else {
        setTimeout(() => {
          flippedRef.current = []
          setFlipped([])
          busyRef.current = false
        }, 900)
      }
    }
  }

  const allMatched = matched.length === md.pairs.length

  return (
    <div style={{ padding: '14px 16px' }}>
      {md.prompt && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {md.prompt}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {cards.map((card) => {
          const isMatched = matched.includes(card.pairId)
          const isUp = isMatched || flipped.includes(card.id)
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => tap(card)}
              disabled={isMatched}
              style={{
                minHeight: 64,
                borderRadius: 12,
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-nunito)',
                lineHeight: 1.3,
                cursor: isMatched ? 'default' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                background: isMatched
                  ? 'rgba(16,185,129,0.18)'
                  : isUp
                    ? 'rgba(124,58,237,0.18)'
                    : 'linear-gradient(135deg, #2a1b4d 0%, #1C1033 100%)',
                border: `1.5px solid ${isMatched ? '#10b981' : isUp ? '#7c3aed' : 'rgba(124,58,237,0.35)'}`,
                color: isMatched ? '#6ee7b7' : isUp ? '#e2d9f3' : '#a78bfa',
                boxShadow: isUp || isMatched ? 'none' : 'inset 0 0 0 4px rgba(124,58,237,0.10)',
              }}
            >
              {isUp ? (
                card.text
              ) : (
                <span style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'rgba(167,139,250,0.6)',
                  textShadow: '0 0 12px rgba(124,58,237,0.4)',
                }}>
                  ?
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', color: allMatched ? '#6ee7b7' : '#a78bfa' }}>
        {allMatched ? '✓ ¡Todas las parejas!' : `${matched.length} / ${md.pairs.length} parejas`}
      </div>
    </div>
  )
}

interface SolveQuestion {
  q: string
  answer: number
  unit?: string
  tolerance?: number
  /** Pistas progresivas. Cantidad variable (2 a 5) segun la dificultad
   *  del ejercicio. NUNCA contienen el resultado final: la ultima deja al
   *  alumno a una sola operacion de la respuesta. */
  hints: string[]
  /** Solucion completa, la unica que si cierra la cuenta. Solo se muestra
   *  si el alumno agota las pistas y pide verla. */
  solution: string[]
}

interface SolveData {
  intro?: string
  questions: SolveQuestion[]
}

/**
 * Interpreta lo que el alumno escribio como numero.
 *
 * Devuelve TODAS las lecturas posibles porque la coma es ambigua: en Mexico
 * se usa como separador de miles (1,234) pero muchos alumnos la escriben
 * como decimal (0,5). En vez de adivinar, se aceptan las dos y basta con
 * que una coincida. Un falso negativo — que resuelva bien y la app le diga
 * que fallo — es mucho peor que aceptar de mas.
 *
 * Maneja: "0.5", "0,5", ".5", "1/2", "x = 12", "12 cm", "12cm", "-7".
 */
function parseAnswers(raw: string): number[] {
  let s = String(raw ?? '').trim().toLowerCase()
  if (!s) return []

  s = s.replace(/^[a-z]?\s*=\s*/, '')
  s = s.replace(/\s+/g, '')
  s = s.replace(/[a-z°º²³%]+$/i, '')
  if (!s) return []

  const frac = s.replace(/,/g, '.').match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/)
  if (frac) {
    const den = parseFloat(frac[2])
    if (den === 0) return []
    const v = parseFloat(frac[1]) / den
    return Number.isFinite(v) ? [v] : []
  }

  const out: number[] = []
  const asDecimal = parseFloat(s.replace(/,/g, '.'))
  if (Number.isFinite(asDecimal)) out.push(asDecimal)
  const asThousands = parseFloat(s.replace(/,/g, ''))
  if (Number.isFinite(asThousands) && !out.includes(asThousands)) out.push(asThousands)

  return out
}

function isRightAnswer(raw: string, expected: number, tolerance = 0): boolean {
  const tol = Math.max(tolerance ?? 0, 1e-9)
  return parseAnswers(raw).some((v) => Math.abs(v - expected) <= tol)
}

/** Eventos de analitica de SolveBlock (Papel y Lapiz). */
export type EventosSolve = {
  /**
   * 🔴 SOLO el clic del boton de pista. NUNCA la pista que se revela al
   * fallar: `check()` incrementa el MISMO contador `shown`, asi que contar
   * esas como pedidas inflaria la metrica que valida el diferenciador —
   * "cuanta gente usa las pistas" pasaria a ser "cuanta gente falla".
   */
  onPistaPedida?: (d: { ejercicioOrden: number; nPista: number; trasFallar: boolean }) => void
  /** Acerto. `nPistasUsadas` incluye las reveladas por fallo. */
  onResuelto?: (d: { ejercicioOrden: number; nPistasUsadas: number; intentos: number }) => void
  /** Se rindio y pidio ver el paso a paso. Solo posible sin pistas restantes. */
  onRevelada?: (d: { ejercicioOrden: number; nPistasUsadas: number }) => void
}

export function SolveBlock({
  data,
  onComplete,
  onProgreso,
  onPistaPedida,
  onResuelto,
  onRevelada,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
} & EventosSolve) {
  const sv = data as unknown as SolveData | null
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [state, setState] = useState<'typing' | 'right' | 'wrong' | 'solution'>('typing')
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(false)
  // Intentos y fallos del ejercicio ACTUAL. Se reinician en next(), igual
  // que `shown`. Solo analitica.
  const intentosRef = useRef(0)
  const falloRef = useRef(false)

  if (!sv || !Array.isArray(sv.questions) || sv.questions.length === 0) return null
  const valid = sv.questions.every(
    (q) =>
      q &&
      typeof q.q === 'string' &&
      typeof q.answer === 'number' &&
      Array.isArray(q.hints) &&
      q.hints.length > 0 &&
      Array.isArray(q.solution) &&
      q.solution.length > 0
  )
  if (!valid) return null

  const total = sv.questions.length
  const current = sv.questions[index]
  if (!current) return null

  const hintsLeft = current.hints.length - shown

  function check() {
    if (!value.trim()) return
    intentosRef.current += 1

    if (isRightAnswer(value, current.answer, current.tolerance)) {
      setState('right')
      // El momento que valida el producto: resolvio, y se sabe con cuantas
      // pistas encima. `nPistasUsadas: 0` es "lo saco solo".
      onResuelto?.({
        ejercicioOrden: index,
        nPistasUsadas: shown,
        intentos: intentosRef.current,
      })
      onProgreso?.({ paso: `ejercicio_${index}_resuelto`, intentos: intentosRef.current })
      return
    }
    // Fallar revela la siguiente pista. Resolver con pistas cuenta igual
    // que resolver solo: penalizar la ayuda ensena a no pedirla.
    setState('wrong')
    falloRef.current = true
    setShown((n) => Math.min(n + 1, current.hints.length))
    onProgreso?.({ paso: `ejercicio_${index}_fallo`, intentos: intentosRef.current })
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true)
      onComplete?.()
      return
    }
    setIndex((i) => i + 1)
    setValue('')
    setState('typing')
    setShown(0)
    intentosRef.current = 0
    falloRef.current = false
  }

  if (done) {
    return (
      <div style={{ padding: '18px 16px', textAlign: 'center' }}>
        {/* Terminar todos los ejercicios es el logro del bloque.
            80px y no más: esto vive dentro de un contenedor estrecho, no en
            una página completa. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Pasita pose="celebrando" size={80} animacion="saltar" />
        </div>
        <div style={{ fontSize: 16, color: '#6ee7b7', fontWeight: 800, fontFamily: 'var(--font-nunito)' }}>
          Terminaste los {total} ejercicios
        </div>
      </div>
    )
  }

  const locked = state === 'right' || state === 'solution'

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }} aria-hidden="true">📝</span>
        <span
          style={{
            fontSize: 11,
            color: '#fbbf24',
            fontWeight: 700,
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-nunito)',
          }}
        >
          {sv.intro ?? 'Resuélvelo en tu cuaderno y escribe el resultado'}
        </span>
      </div>

      <div
        style={{
          fontSize: 12,
          color: '#a78bfa',
          fontWeight: 700,
          marginBottom: 6,
          fontFamily: 'var(--font-nunito)',
        }}
      >
        Ejercicio {index + 1} de {total}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {sv.questions.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              background: i < index ? '#7c3aed' : i === index ? '#ec4899' : '#2D2048',
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontSize: 15,
          color: '#e2d9f3',
          lineHeight: 1.6,
          marginBottom: 14,
          fontFamily: 'var(--font-nunito)',
          fontWeight: 600,
        }}
      >
        {current.q}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          disabled={locked}
          onChange={(e) => {
            setValue(e.target.value)
            if (state === 'wrong') setState('typing')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check()
          }}
          placeholder="Tu respuesta"
          aria-label="Escribe tu respuesta"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            background: 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${
              state === 'right' ? '#10b981' : state === 'wrong' ? '#ef4444' : 'rgba(124,58,237,0.35)'
            }`,
            borderRadius: 12,
            padding: '0 14px',
            fontSize: 18,
            color: '#e2d9f3',
            fontFamily: 'var(--font-nunito)',
            fontWeight: 700,
            outline: 'none',
          }}
        />
        {current.unit && (
          <span style={{ fontSize: 16, color: '#a78bfa', fontWeight: 700, flexShrink: 0 }}>
            {current.unit}
          </span>
        )}
      </div>

      {state === 'typing' && (
        <>
          <button
            type="button"
            onClick={check}
            disabled={!value.trim()}
            style={{
              width: '100%',
              minHeight: 46,
              background: value.trim() ? '#7c3aed' : 'rgba(124,58,237,0.2)',
              color: value.trim() ? '#fff' : '#a78bfa',
              border: 'none',
              borderRadius: 12,
              fontFamily: 'var(--font-nunito)',
              fontSize: 15,
              fontWeight: 800,
              cursor: value.trim() ? 'pointer' : 'default',
            }}
          >
            Revisar
          </button>
          {hintsLeft > 0 && (
            <button
              type="button"
              onClick={() => {
                const siguiente = Math.min(shown + 1, current.hints.length)
                setShown(siguiente)
                // `trasFallar` distingue al que pide ayuda de entrada del que
                // la pide despues de estrellarse: son dos alumnos distintos.
                onPistaPedida?.({
                  ejercicioOrden: index,
                  nPista: siguiente,
                  trasFallar: falloRef.current,
                })
              }}
              style={{
                width: '100%',
                minHeight: 40,
                marginTop: 8,
                background: 'transparent',
                border: 'none',
                color: '#fbbf24',
                fontFamily: 'var(--font-nunito)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              💡 {shown === 0 ? 'Necesito una pista' : 'Dame otra pista'}
            </button>
          )}
        </>
      )}

      {state === 'right' && (
        <>
          {/* Pulgar arriba al acertar. A 64px y en fila con el texto: el
              alumno está en mitad de una tanda de ejercicios y una
              celebración a pantalla completa cada vez que acierta cansa. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              borderRadius: 10,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#6ee7b7',
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 10,
              fontFamily: 'var(--font-nunito)',
            }}
          >
            <Pasita pose="aprobando" size={64} parpadea={false} />
            ✓ ¡Correcto!
          </div>
          <button type="button" onClick={next} style={nextBtnStyle}>
            {index + 1 >= total ? 'Terminar' : 'Siguiente ejercicio'}
          </button>
        </>
      )}

      {shown > 0 && state !== 'right' && state !== 'solution' && (
        <div style={{ marginBottom: 10 }}>
          {current.hints.slice(0, shown).map((h, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.25)',
                marginBottom: 6,
                fontFamily: 'var(--font-nunito)',
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">💡</span>
              <span style={{ fontSize: 14, color: '#fbbf24', fontWeight: 600, lineHeight: 1.5 }}>{h}</span>
            </div>
          ))}
        </div>
      )}

      {state === 'wrong' && (
        <>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 10,
              fontFamily: 'var(--font-nunito)',
            }}
          >
            {hintsLeft > 0
              ? '✗ Todavía no. Te dejé una pista arriba — inténtalo otra vez.'
              : '✗ No es esa. Ya viste todas las pistas.'}
          </div>
          <button
            type="button"
            onClick={check}
            disabled={!value.trim()}
            style={{
              ...nextBtnStyle,
              background: value.trim() ? '#7c3aed' : 'rgba(124,58,237,0.2)',
              color: value.trim() ? '#fff' : '#a78bfa',
              cursor: value.trim() ? 'pointer' : 'default',
            }}
          >
            Volver a intentar
          </button>
          {hintsLeft === 0 && (
            <button
              type="button"
              onClick={() => {
                setState('solution')
                onRevelada?.({ ejercicioOrden: index, nPistasUsadas: shown })
                onProgreso?.({ paso: `ejercicio_${index}_revelado`, intentos: intentosRef.current })
              }}
              style={{ ...nextBtnStyle, background: 'transparent', color: '#a78bfa', minHeight: 40, marginTop: 6 }}
            >
              Ver la respuesta completa
            </button>
          )}
        </>
      )}

      {state === 'solution' && (
        <>
          <div
            style={{
              padding: '14px',
              borderRadius: 10,
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              marginBottom: 10,
              fontFamily: 'var(--font-nunito)',
            }}
          >
            <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 10 }}>
              PASO A PASO
            </div>
            {current.solution.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <div
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(124,58,237,0.3)',
                    color: '#c4b5fd',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-orbitron)',
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ fontSize: 14, color: '#e2d9f3', lineHeight: 1.5, fontWeight: 600 }}>{s}</span>
              </div>
            ))}
            <div style={{ fontSize: 14, color: '#6ee7b7', fontWeight: 800, marginTop: 10 }}>
              Resultado: {current.answer}{current.unit ? ` ${current.unit}` : ''}
            </div>
          </div>
          <button type="button" onClick={next} style={nextBtnStyle}>
            {index + 1 >= total ? 'Terminar' : 'Siguiente ejercicio'}
          </button>
        </>
      )}
    </div>
  )
}

const nextBtnStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  fontFamily: 'var(--font-nunito)',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
}

// ═════════════════════════════════════════════════════════════════════════
// s43 — CONECTA 🔗 y ARMA LOS PASOS 🧩
//
// Contratos, límites y barajado viven en lib/minijuegos.ts (lógica pura que
// también usa el cargador). Aquí solo la mecánica y el pintado.
//
// Reglas del documento de producto que este código respeta:
//   - Sin drag & drop. Todo es tap.
//   - Conecta: la línea se dibuja SOLO tras validar que el par es correcto.
//     El error no deja línea: sacude la tarjeta y conserva la primera
//     selección para probar otra pareja.
//   - Arma los pasos: cada tap ocupa el siguiente número; tocar un paso
//     colocado lo regresa; al revisar se señala SOLO el primer error.
//   - Datos inválidos → el bloque no se pinta (return null), igual que los
//     otros cinco. Nunca tumba la lección.
// ═════════════════════════════════════════════════════════════════════════

/** Sacudida y trazo. Un solo <style> por bloque; respeta reduced-motion. */
const MINIJUEGO_CSS = `
@keyframes pasas-mj-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
@keyframes pasas-mj-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes pasas-mj-pop { 0%{transform:scale(1)} 45%{transform:scale(1.035)} 100%{transform:scale(1)} }
.pasas-mj-shake { animation: pasas-mj-shake 0.42s ease; }
.pasas-mj-pop { animation: pasas-mj-pop 0.32s ease; }
.pasas-mj-line { stroke-dasharray: 1; stroke-dashoffset: 0; animation: pasas-mj-draw 0.38s ease-out; }
@media (prefers-reduced-motion: reduce) {
  .pasas-mj-shake, .pasas-mj-pop, .pasas-mj-line { animation: none !important; }
}
`

/** Vibración corta al fallar, donde exista (Android). iOS la ignora. */
function vibrar() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(35)
  } catch {
    /* sin vibración no pasa nada */
  }
}

function InstruccionMinijuego({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 14, lineHeight: 1.2 }} aria-hidden="true">👆</span>
      <span
        style={{
          fontSize: 11.5,
          color: '#fbbf24',
          fontWeight: 700,
          letterSpacing: '0.03em',
          lineHeight: 1.35,
          fontFamily: 'var(--font-nunito)',
        }}
      >
        {children}
      </span>
    </div>
  )
}

function CierreMinijuego({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div
      role="status"
      className="pasas-mj-pop"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(16,185,129,0.12)',
        border: '1px solid rgba(16,185,129,0.32)',
        fontFamily: 'var(--font-nunito)',
      }}
    >
      {/* 56px: misma lógica que el acierto de Papel y lápiz — celebra sin
          tapar la lección. */}
      <div style={{ flexShrink: 0 }}>
        <Pasita pose="aprobando" size={56} parpadea={false} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#6ee7b7' }}>{titulo}</div>
        {texto && (
          <div style={{ fontSize: 13.5, color: '#d1fae5', lineHeight: 1.5, marginTop: 2, fontWeight: 600 }}>
            {renderInline(texto)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CONECTA 🔗 ───────────────────────────────────────────────────────────

/**
 * Un color por par, en el orden en que se aciertan. Con 3-4 pares las líneas
 * se cruzan (el barajado no deja ninguna alineada): si todas fueran verdes el
 * final sería una maraña. Así cada línea se sigue por su color y casa con el
 * borde de sus dos tarjetas.
 */
const COLORES_PAR = ['#10b981', '#06b6d4', '#fbbf24', '#f472b6'] as const

/** Para analítica: qué par costó. Se manda el texto de la izquierda. */
export type OnFalloConecta = (d: { intentos: number; par: string }) => void

export function ConnectBlock({
  data,
  onComplete,
  onProgreso,
  onFallo,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
  onFallo?: OnFalloConecta
}) {
  const valido = validarConnect(data).errores.length === 0
  const cd = (valido ? data : null) as unknown as ConnectData | null
  const pairs = cd?.pairs ?? []
  const n = pairs.length

  // Fila k de la columna derecha muestra el par `derecha[k]`.
  // La semilla es un string: comparar por valor basta para memoizar.
  const semillaC = semillaDe(pairs.map((p) => `${p.left}|${p.right}`))
  const derecha = React.useMemo(() => permutacionSinFijos(n, semillaC), [n, semillaC])

  const [sel, setSel] = useState<{ lado: 'L' | 'R'; par: number } | null>(null)
  const [hechos, setHechos] = useState<number[]>([])
  const [error, setError] = useState<{ lado: 'L' | 'R'; par: number; k: number } | null>(null)
  const [aviso, setAviso] = useState<'ok' | 'mal' | null>(null)
  const intentosRef = useRef(0)

  const contRef = useRef<HTMLDivElement>(null)
  const izqRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const derRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [lineas, setLineas] = useState<{ par: number; x1: number; y1: number; x2: number; y2: number }[]>([])

  // Geometría de las líneas: se mide contra el contenedor y se rehace si
  // cambia el ancho (rotar el teléfono, abrir el teclado, etc.).
  useEffect(() => {
    const cont = contRef.current
    if (!cont) return
    const medir = () => {
      const base = cont.getBoundingClientRect()
      const out: typeof lineas = []
      for (const par of hechos) {
        const a = izqRefs.current.get(par)?.getBoundingClientRect()
        const b = derRefs.current.get(par)?.getBoundingClientRect()
        if (!a || !b) continue
        out.push({
          par,
          x1: a.right - base.left,
          y1: a.top + a.height / 2 - base.top,
          x2: b.left - base.left,
          y2: b.top + b.height / 2 - base.top,
        })
      }
      setLineas(out)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(cont)
    return () => ro.disconnect()
  }, [hechos])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 1400)
    return () => clearTimeout(t)
  }, [aviso])

  if (!cd) return null

  const completo = hechos.length === n

  function tocar(lado: 'L' | 'R', par: number) {
    if (completo || hechos.includes(par)) return
    // Primera selección, o cambio de opinión dentro de la misma columna.
    if (!sel || sel.lado === lado) {
      setSel(sel && sel.lado === lado && sel.par === par ? null : { lado, par })
      setError(null)
      return
    }
    intentosRef.current += 1
    if (sel.par === par) {
      const nuevos = [...hechos, par]
      setHechos(nuevos)
      setSel(null)
      setError(null)
      setAviso('ok')
      onProgreso?.({ paso: `pares_${nuevos.length}_de_${n}`, intentos: intentosRef.current })
      if (nuevos.length === n) onComplete?.()
    } else {
      // 🔴 La PRIMERA selección se conserva: el alumno prueba otra pareja
      // sin volver a empezar. Solo la segunda tarjeta se sacude.
      setError({ lado, par, k: intentosRef.current })
      setAviso('mal')
      vibrar()
      onProgreso?.({ paso: `fallo_par_${hechos.length + 1}_de_${n}`, intentos: intentosRef.current })
      onFallo?.({ intentos: intentosRef.current, par: pairs[sel.lado === 'L' ? sel.par : par].left })
    }
  }

  const tarjeta = (lado: 'L' | 'R', par: number, texto: string) => {
    const hecho = hechos.includes(par)
    const colorPar = COLORES_PAR[hechos.indexOf(par) % COLORES_PAR.length]
    const seleccionada = sel?.lado === lado && sel.par === par
    const mal = error?.lado === lado && error.par === par
    const esIzq = lado === 'L'
    const acento = esIzq ? '#ec4899' : '#7c3aed'
    return (
      <button
        key={`${lado}-${par}-${mal ? error!.k : 0}`}
        type="button"
        ref={(el) => {
          const m = esIzq ? izqRefs.current : derRefs.current
          if (el) m.set(par, el)
          else m.delete(par)
        }}
        onClick={() => tocar(lado, par)}
        disabled={hecho || completo}
        aria-pressed={seleccionada}
        className={mal ? 'pasas-mj-shake' : hecho ? 'pasas-mj-pop' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 48,
          padding: '9px 10px',
          borderRadius: 12,
          fontFamily: 'var(--font-nunito)',
          fontSize: 13.5,
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: 'center',
          overflowWrap: 'anywhere',
          cursor: hecho || completo ? 'default' : 'pointer',
          transition: 'background 140ms, border-color 140ms, color 140ms, box-shadow 140ms',
          WebkitTapHighlightColor: 'transparent',
          background: hecho
            ? `${colorPar}1f`
            : seleccionada
              ? acento
              : esIzq
                ? 'rgba(236,72,153,0.07)'
                : 'rgba(124,58,237,0.09)',
          border: `1.5px solid ${
            hecho ? colorPar : mal ? '#ef4444' : seleccionada ? acento : esIzq ? 'rgba(236,72,153,0.38)' : 'rgba(167,139,250,0.38)'
          }`,
          color: hecho ? '#ecfdf5' : seleccionada ? '#ffffff' : esIzq ? '#fbcfe8' : '#e2d9f3',
          boxShadow: seleccionada ? `0 0 0 3px ${esIzq ? 'rgba(236,72,153,0.25)' : 'rgba(124,58,237,0.3)'}` : 'none',
        }}
      >
        {texto}
      </button>
    )
  }

  const etiqueta = (txt: string, color: string) => (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        textAlign: 'center',
        fontFamily: 'var(--font-nunito)',
        paddingBottom: 2,
      }}
    >
      {txt}
    </div>
  )

  return (
    <div style={{ padding: '14px 16px' }}>
      <style>{MINIJUEGO_CSS}</style>
      {!completo && <InstruccionMinijuego>Toca una idea de la izquierda y luego su pareja de la derecha</InstruccionMinijuego>}
      {cd.prompt && (
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#e2d9f3', marginBottom: 12 }}>{cd.prompt}</div>
      )}

      <div
        ref={contRef}
        style={{
          position: 'relative',
          display: 'grid',
          // Columna central vacía: ahí corren las líneas. 34px dejan ver los
          // cruces a 360px sin robar demasiado ancho a las tarjetas.
          gridTemplateColumns: 'minmax(0,1fr) 34px minmax(0,1fr)',
          rowGap: 8,
          alignItems: 'stretch',
        }}
      >
        {etiqueta(cd.left_label ?? 'Analogía', '#f472b6')}
        <div />
        {etiqueta(cd.right_label ?? 'Concepto', '#a78bfa')}

        {pairs.map((p, k) => (
          <React.Fragment key={k}>
            {tarjeta('L', k, p.left)}
            <div aria-hidden="true" />
            {tarjeta('R', derecha[k], pairs[derecha[k]].right)}
          </React.Fragment>
        ))}

        <svg
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
        >
          {lineas.map((l) => {
            const color = COLORES_PAR[hechos.indexOf(l.par) % COLORES_PAR.length]
            return (
            <g key={l.par}>
              <path
                className="pasas-mj-line"
                pathLength={1}
                d={`M ${l.x1} ${l.y1} L ${l.x2} ${l.y2}`}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
              />
              <circle cx={l.x1} cy={l.y1} r={4} fill={color} />
              <circle cx={l.x2} cy={l.y2} r={4} fill={color} />
            </g>
            )
          })}
        </svg>
      </div>

      {completo ? (
        <CierreMinijuego titulo="¡Todo conectado!" texto={cd.completion_feedback} />
      ) : (
        <div
          aria-live="polite"
          style={{
            marginTop: 10,
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            fontFamily: 'var(--font-nunito)',
            color: aviso === 'mal' ? '#fca5a5' : aviso === 'ok' ? '#6ee7b7' : '#a78bfa',
          }}
        >
          {aviso === 'mal'
            ? 'Esa no es su pareja — prueba otra'
            : aviso === 'ok'
              ? '✓ ¡Conectado!'
              : `${hechos.length} / ${n} conectadas`}
        </div>
      )}
    </div>
  )
}

// ── ARMA LOS PASOS 🧩 ────────────────────────────────────────────────────

export type OnFalloArma = (d: { intentos: number; posicion: number }) => void

export function OrderStepsBlock({
  data,
  onComplete,
  onProgreso,
  onFallo,
}: {
  data: Record<string, unknown> | null
  onComplete?: () => void
  onProgreso?: OnProgreso
  onFallo?: OnFalloArma
}) {
  const valido = validarOrderSteps(data).errores.length === 0
  const od = (valido ? data : null) as unknown as OrderStepsData | null
  const steps = od?.steps ?? []
  const n = steps.length

  // Posición k de las opciones muestra el paso `opciones[k]`. Sin puntos
  // fijos: tocar de arriba abajo nunca resuelve el juego.
  const semillaO = semillaDe(steps)
  const opciones = React.useMemo(() => permutacionSinFijos(n, semillaO), [n, semillaO])

  /** colocados[k] = índice (en orden correcto) del paso puesto en el slot k. */
  const [colocados, setColocados] = useState<number[]>([])
  /** Slots 0..fijos-1 ya validados como correctos: no se pueden quitar. */
  const [fijos, setFijos] = useState(0)
  const [estado, setEstado] = useState<'armando' | 'error' | 'correcto'>('armando')
  const [slotMal, setSlotMal] = useState(-1)
  const [fallosPorSlot, setFallosPorSlot] = useState<Record<number, number>>({})
  const intentosRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  if (!od) return null

  const correcto = estado === 'correcto'
  const lleno = colocados.length === n
  // Pista suave tras DOS fallos en el mismo punto: se resalta el paso que va
  // ahí. El documento pide que el error no frustre; esto evita que alguien
  // se quede dando vueltas sin salida.
  const pistaPara = !correcto && (fallosPorSlot[fijos] ?? 0) >= 2 ? fijos : -1

  function colocar(paso: number) {
    if (correcto || estado === 'error' || colocados.includes(paso) || lleno) return
    const nuevos = [...colocados, paso]
    setColocados(nuevos)
    setSlotMal(-1)
    onProgreso?.({ paso: `slot_${nuevos.length}_de_${n}`, intentos: intentosRef.current })
  }

  function quitar(k: number) {
    if (correcto || estado === 'error' || k < fijos || k >= colocados.length) return
    setColocados(colocados.filter((_, i) => i !== k))
    setSlotMal(-1)
  }

  function revisar() {
    if (!lleno || correcto || estado === 'error') return
    intentosRef.current += 1
    const e = primerError(colocados)
    if (e === -1) {
      setEstado('correcto')
      setFijos(n)
      onProgreso?.({ paso: 'correcto', intentos: intentosRef.current })
      onComplete?.()
      return
    }
    // Lo anterior al error queda fijo (verde); del error en adelante regresa
    // a las opciones tras un instante para que se vea DÓNDE se rompió.
    setEstado('error')
    setSlotMal(e)
    setFijos(e)
    setFallosPorSlot((f) => ({ ...f, [e]: (f[e] ?? 0) + 1 }))
    vibrar()
    onProgreso?.({ paso: `fallo_slot_${e + 1}`, intentos: intentosRef.current })
    onFallo?.({ intentos: intentosRef.current, posicion: e + 1 })
    timerRef.current = setTimeout(() => {
      setColocados((c) => c.slice(0, e))
      setEstado('armando')
    }, 1100)
  }

  const disponibles = opciones.filter((p) => !colocados.includes(p))

  return (
    <div style={{ padding: '14px 16px' }}>
      <style>{MINIJUEGO_CSS}</style>
      {!correcto && <InstruccionMinijuego>Toca los pasos en el orden correcto · toca uno colocado para regresarlo</InstruccionMinijuego>}
      {od.prompt && (
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#e2d9f3', marginBottom: 12 }}>{od.prompt}</div>
      )}

      {/* Slots numerados */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: n }, (_, k) => {
          const paso = colocados[k]
          const lleno_k = paso != null
          const verde = correcto || k < fijos
          const rojo = estado === 'error' && k === slotMal
          const quitable = lleno_k && !verde && estado !== 'error'
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => quitar(k)}
                disabled={!quitable}
                aria-label={lleno_k ? `Paso ${k + 1}: ${steps[paso]}${quitable ? '. Toca para regresarlo' : ''}` : `Paso ${k + 1}: vacío`}
                className={rojo ? 'pasas-mj-shake' : undefined}
                style={{
                  width: '100%',
                  minHeight: lleno_k ? 46 : 40,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 11,
                  textAlign: 'left',
                  fontFamily: 'var(--font-nunito)',
                  cursor: quitable ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 140ms, border-color 140ms',
                  background: verde
                    ? 'rgba(16,185,129,0.12)'
                    : rojo
                      ? 'rgba(239,68,68,0.12)'
                      : lleno_k
                        ? 'rgba(6,182,212,0.10)'
                        : 'transparent',
                  border: verde
                    ? '1.5px solid #10b981'
                    : rojo
                      ? '1.5px solid #ef4444'
                      : lleno_k
                        ? '1.5px solid rgba(6,182,212,0.55)'
                        : '1.5px dashed rgba(167,139,250,0.28)',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 11.5,
                    fontWeight: 900,
                    background: verde ? '#10b981' : rojo ? '#ef4444' : lleno_k ? '#06b6d4' : 'rgba(167,139,250,0.14)',
                    color: lleno_k || verde ? '#0f0a1e' : '#a78bfa',
                  }}
                >
                  {verde && lleno_k ? '✓' : k + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    fontWeight: lleno_k ? 700 : 600,
                    lineHeight: 1.35,
                    color: verde ? '#d1fae5' : rojo ? '#fecaca' : lleno_k ? '#e2d9f3' : 'rgba(167,139,250,0.45)',
                  }}
                >
                  {lleno_k ? steps[paso] : '—'}
                </span>
                {quitable && (
                  <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 13, color: '#67e8f9', opacity: 0.8 }}>↩</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {/* Opciones */}
      {!correcto && disponibles.length > 0 && (
        <>
          <div
            style={{
              marginTop: 14,
              marginBottom: 6,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#a78bfa',
              fontFamily: 'var(--font-nunito)',
            }}
          >
            Opciones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {disponibles.map((p) => {
              const pista = p === pistaPara
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => colocar(p)}
                  disabled={estado === 'error'}
                  style={{
                    width: '100%',
                    minHeight: 46,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 11,
                    textAlign: 'left',
                    fontFamily: 'var(--font-nunito)',
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    color: '#e2d9f3',
                    cursor: estado === 'error' ? 'default' : 'pointer',
                    opacity: estado === 'error' ? 0.55 : 1,
                    WebkitTapHighlightColor: 'transparent',
                    background: pista ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                    border: pista ? '1.5px dashed #10b981' : '1px solid rgba(124,58,237,0.32)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      border: `1.5px solid ${pista ? '#10b981' : 'rgba(167,139,250,0.6)'}`,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>{steps[p]}</span>
                  {pista && (
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#6ee7b7' }}>💡 va aquí</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {correcto ? (
        <CierreMinijuego titulo="¡Orden correcto!" texto={od.completion_feedback} />
      ) : estado === 'error' ? (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            fontSize: 13.5,
            fontWeight: 800,
            fontFamily: 'var(--font-nunito)',
          }}
        >
          {slotMal === 0
            ? '✗ El paso 1 no va ahí. ¿Qué tiene que pasar primero?'
            : `✗ El paso ${slotMal + 1} no va ahí. Lo de antes está bien ✓`}
        </div>
      ) : (
        <button
          type="button"
          onClick={revisar}
          disabled={!lleno}
          style={{
            width: '100%',
            minHeight: 46,
            marginTop: 12,
            background: lleno ? '#7c3aed' : 'rgba(124,58,237,0.2)',
            color: lleno ? '#fff' : '#a78bfa',
            border: 'none',
            borderRadius: 12,
            fontFamily: 'var(--font-nunito)',
            fontSize: 15,
            fontWeight: 800,
            cursor: lleno ? 'pointer' : 'default',
          }}
        >
          {lleno ? 'Revisar orden' : `Falta${n - colocados.length === 1 ? '' : 'n'} ${n - colocados.length} por colocar`}
        </button>
      )}
    </div>
  )
}

export const INTERACTIVE_TYPES = new Set<string>(['sort', 'scrubber', 'steps', 'match', 'solve', 'connect', 'order_steps'])

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Eventos de analitica del reproductor. Ninguno cambia la reproduccion. */
export type EventosAudio = {
  onAudioInicio?: (d: { duracionTotalSeg: number }) => void
  onAudioProgreso?: (d: { pct: 25 | 50 | 75 | 100 }) => void
  onAudioFin?: (d: { pctEscuchado: number; segundosEscuchados: number; motivo: 'fin' | 'pausa' }) => void
}

export function AudioPlayer({
  url,
  duration,
  onAudioInicio,
  onAudioProgreso,
  onAudioFin,
}: { url: string; duration?: number | null } & EventosAudio) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState<number>(duration ?? 0)

  // ── Estado de analitica. Todo en refs: ni un render de mas. ──────────
  const hitosRef = useRef<Set<number>>(new Set())
  const iniciadoRef = useRef(false)
  const escuchadoRef = useRef(0)
  const ultimoTiempoRef = useRef(0)
  /**
   * 🔴 Distingue el `pause` del USUARIO del que provoca `audioRegistry` al
   * arrancar otro audio.
   *
   * `toggle()` pausa los demas antes de reproducir el suyo, y eso dispara un
   * evento `pause` en cada uno. Sin esta marca, empezar a escuchar una
   * seccion contaria como "abandono" de la anterior — y `audio_terminado`
   * mediria interrupciones ajenas en vez de decisiones del alumno.
   */
  const pausaAjenaRef = useRef(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    audioRegistry.add(el)
    const onTime = () => {
      setCurrent(el.currentTime)

      // Segundos REALMENTE escuchados: se acumula el avance entre ticks y se
      // ignoran los saltos del seek. Sin esto, arrastrar la barra al final
      // contaria como haberlo escuchado entero.
      const delta = el.currentTime - ultimoTiempoRef.current
      if (delta > 0 && delta < 2) escuchadoRef.current += delta
      ultimoTiempoRef.current = el.currentTime

      const dur = el.duration && isFinite(el.duration) ? el.duration : total
      if (!dur) return
      const pct = (el.currentTime / dur) * 100
      for (const hito of [25, 50, 75, 100] as const) {
        if (pct >= hito && !hitosRef.current.has(hito)) {
          hitosRef.current.add(hito)
          onAudioProgreso?.({ pct: hito })
        }
      }
    }
    const onLoaded = () => { if (el.duration && isFinite(el.duration)) setTotal(el.duration) }
    const onEnd = () => {
      // 🔴 ANTES del reset. `onEnd` pone currentTime a 0, y emitir despues
      // mandaria cero segundos escuchados en todos los audios completados.
      const dur = el.duration && isFinite(el.duration) ? el.duration : total
      onAudioFin?.({
        pctEscuchado: dur ? Math.round((escuchadoRef.current / dur) * 100) : 0,
        segundosEscuchados: Math.round(escuchadoRef.current),
        motivo: 'fin',
      })
      setPlaying(false); setCurrent(0); el.currentTime = 0
      ultimoTiempoRef.current = 0
    }
    const onPlay = () => {
      setPlaying(true)
      if (!iniciadoRef.current) {
        iniciadoRef.current = true
        const dur = el.duration && isFinite(el.duration) ? el.duration : total
        onAudioInicio?.({ duracionTotalSeg: Math.round(dur) })
      }
    }
    const onPause = () => {
      setPlaying(false)
      // Pausa provocada por otro audio: no es una decision del alumno.
      if (pausaAjenaRef.current) {
        pausaAjenaRef.current = false
        return
      }
      // Ni tampoco la pausa que acompaña al final natural: `ended` ya emitio.
      if (el.ended) return
      const dur = el.duration && isFinite(el.duration) ? el.duration : total
      onAudioFin?.({
        pctEscuchado: dur ? Math.round((escuchadoRef.current / dur) * 100) : 0,
        segundosEscuchados: Math.round(escuchadoRef.current),
        motivo: 'pausa',
      })
    }
    const onPausaAjena = () => { pausaAjenaRef.current = true }
    el.addEventListener('pasas:pausa-ajena', onPausaAjena)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('pasas:pausa-ajena', onPausaAjena)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      audioRegistry.delete(el)
    }
  }, [])

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      // Detener cualquier otro audio que esté sonando
      audioRegistry.forEach((other) => {
        if (other !== el) {
          // Marca la pausa como AJENA antes de provocarla: el listener del
          // otro reproductor la lee y no la cuenta como abandono.
          other.dispatchEvent(new CustomEvent('pasas:pausa-ajena'))
          other.pause()
        }
      })
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !total) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    el.currentTime = ratio * total
    setCurrent(el.currentTime)
  }

  const pct = total > 0 ? (current / total) * 100 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 16px 14px' }}>
      <audio ref={audioRef} src={url} preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar audio' : 'Escuchar sección'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: playing ? '#8b5cf6' : '#7c3aed', color: '#ffffff',
          border: 'none', cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        {/* SVG y no emoji: iOS pinta ▶ de azul por su cuenta y rompe la paleta */}
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.14v13.72c0 .83.92 1.33 1.62.88l10.78-6.86c.65-.41.65-1.35 0-1.76L9.62 4.26C8.92 3.81 8 4.31 8 5.14z" />
          </svg>
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: '#efe9ff', fontWeight: 600 }}>
            {playing ? 'Reproduciendo' : 'Escuchar sección'}
          </span>
          <span style={{ color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(current)} / {formatTime(total)}
          </span>
        </div>
        <div
          onClick={seek}
          style={{ height: 6, background: '#2a1d52', borderRadius: 99, overflow: 'hidden', cursor: 'pointer' }}
        >
          <div style={{ height: '100%', width: `${pct}%`, background: '#7c3aed', borderRadius: 99 }} />
        </div>
      </div>
    </div>
  )
}
