'use client'

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

export const INTERACTIVE_TYPES = new Set<string>(['sort', 'scrubber', 'steps', 'match'])

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
          background: playing ? '#efc562' : '#e0b64a', color: '#1a1035',
          border: 'none', cursor: 'pointer', fontSize: 16, transition: 'background 0.2s',
        }}
      >
        {playing ? '⏸' : '▶'}
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
          <div style={{ height: '100%', width: `${pct}%`, background: '#e0b64a', borderRadius: 99 }} />
        </div>
      </div>
    </div>
  )
}
