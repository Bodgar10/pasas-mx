'use client'

import Pasita from '@/components/mascota/Pasita'

import React, { useState, useEffect, useRef } from 'react'

// Tipos de sección que llevan audio narrado (bloques de texto).
export const AUDIO_TEXT_TYPES = new Set<string>(['explanation', 'analogy', 'example', 'key_fact', 'tip'])

// Registro global para que solo un audio suene a la vez en toda la página.
const audioRegistry = new Set<HTMLAudioElement>()

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
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ fontWeight: 800, color: '#e2d9f3' }}>{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
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

export function ScrubberBlock({ data, onComplete }: { data: Record<string, unknown> | null; onComplete?: () => void }) {
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

export function StepsBlock({ data, onComplete }: { data: Record<string, unknown> | null; onComplete?: () => void }) {
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

export function SortBlock({ data, onComplete }: { data: Record<string, unknown> | null; onComplete?: () => void }) {
  const sort = data as unknown as SortData | null
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
            if (correct) onComplete?.()
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

export function MatchBlock({ data, onComplete }: { data: Record<string, unknown> | null; onComplete?: () => void }) {
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

  if (!md || !Array.isArray(md.pairs) || md.pairs.length < 2) return null

  const totalPairs = md.pairs.length

  function tap(card: { id: number; pairId: number; text: string }) {
    if (busyRef.current || matched.includes(card.pairId) || flippedRef.current.includes(card.id)) return
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

export function SolveBlock({ data, onComplete }: { data: Record<string, unknown> | null; onComplete?: () => void }) {
  const sv = data as unknown as SolveData | null
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [state, setState] = useState<'typing' | 'right' | 'wrong' | 'solution'>('typing')
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(false)

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
    if (isRightAnswer(value, current.answer, current.tolerance)) {
      setState('right')
      return
    }
    // Fallar revela la siguiente pista. Resolver con pistas cuenta igual
    // que resolver solo: penalizar la ayuda ensena a no pedirla.
    setState('wrong')
    setShown((n) => Math.min(n + 1, current.hints.length))
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
              onClick={() => setShown((n) => Math.min(n + 1, current.hints.length))}
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
              onClick={() => setState('solution')}
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

export const INTERACTIVE_TYPES = new Set<string>(['sort', 'scrubber', 'steps', 'match', 'solve'])

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function AudioPlayer({ url, duration }: { url: string; duration?: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState<number>(duration ?? 0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    audioRegistry.add(el)
    const onTime = () => setCurrent(el.currentTime)
    const onLoaded = () => { if (el.duration && isFinite(el.duration)) setTotal(el.duration) }
    const onEnd = () => { setPlaying(false); setCurrent(0); el.currentTime = 0 }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
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
      audioRegistry.forEach((other) => { if (other !== el) other.pause() })
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
