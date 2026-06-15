'use client'

import React, { useState } from 'react'

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
            width: '100%', minHeight: 44,
            background: 'rgba(6,182,212,0.15)', color: '#06b6d4',
            border: '1px solid #06b6d4', borderRadius: 12,
            fontFamily: 'var(--font-nunito)', fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {isBar
            ? `${sd.steps[step].text} ${(sd.steps[step].delta ?? 0) < 0 ? '−' : '+'}${Math.abs(sd.steps[step].delta ?? 0)} →`
            : 'Siguiente paso →'}
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

  if (!sort || !Array.isArray(sort.items) || !Array.isArray(sort.buckets)) {
    return null
  }

  const allDone = assign.every((a) => a !== -1)
  const correct = assign.every((a, i) => a === sort.items[i].b)
  const bucketColors = ['#06b6d4', '#ec4899', '#fbbf24']

  return (
    <div style={{ padding: '14px 16px' }}>
      {sort.prompt && (
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e2d9f3', marginBottom: 14 }}>
          {sort.prompt}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {sort.items.map((it, i) => {
          const bk = assign[i]
          const ok = checked && bk === it.b
          const bad = checked && bk !== it.b
          const borderC = ok ? '#10b981' : bad ? '#ef4444' : 'rgba(124,58,237,0.25)'
          return (
            <button
              key={i}
              type="button"
              disabled={checked}
              onClick={() =>
                setAssign((arr) =>
                  arr.map((a, j) => (j === i ? (a + 1) % sort.buckets.length : a))
                )
              }
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${borderC}`, borderRadius: 10,
                padding: '10px 14px', fontSize: 15, color: '#e2d9f3',
                fontFamily: 'var(--font-nunito)', fontWeight: 600,
                cursor: checked ? 'default' : 'pointer', textAlign: 'left',
              }}
            >
              <span>{it.t}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                whiteSpace: 'nowrap',
                color: bk === -1 ? '#a78bfa' : bucketColors[bk % bucketColors.length],
                border: `1px solid ${bk === -1 ? 'rgba(167,139,250,0.3)' : bucketColors[bk % bucketColors.length]}`,
              }}>
                {bk === -1 ? 'toca para elegir →' : sort.buckets[bk]}
              </span>
            </button>
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
          Revisar
        </button>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 700, color: correct ? '#6ee7b7' : '#fca5a5' }}>
          {correct
            ? '¡Todo bien clasificado!'
            : 'Revisa los marcados en rojo e inténtalo de nuevo en el siguiente tema.'}
        </div>
      )}
    </div>
  )
}

export const INTERACTIVE_TYPES = new Set<string>(['sort', 'scrubber', 'steps'])
