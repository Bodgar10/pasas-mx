import type { CSSProperties } from 'react'

/**
 * Piezas compartidas del tablero de admin.
 *
 * 🔴 Vivían dentro de metricas-client.tsx. Con seis pestañas no pueden
 * quedarse ahí: copiarlas seis veces es como empiezan las divergencias —
 * una pestaña cambia el color de un umbral y las otras cinco no.
 *
 * Son componentes de SERVIDOR: no llevan 'use client' ni estado. Todo el
 * cálculo ocurre antes de llegar aquí.
 */

export const COLORES = {
  texto: '#e2d9f3',
  suave: '#a78bfa',
  tenue: '#6b5fa0',
  fondo: '#1a1035',
  fondo2: '#0f0a1e',
  borde: '#2D2048',
  primario: '#7c3aed',
  verde: '#10b981',
  ambar: '#fbbf24',
  rojo: '#ef4444',
  cian: '#06b6d4',
  rosa: '#ec4899',
} as const

export function StatCard({
  label,
  value,
  sub,
  color = COLORES.primario,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div style={{ background: COLORES.fondo, border: `1px solid ${color}33`, borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 13, color: COLORES.suave, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: COLORES.tenue, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginTop: 32, marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 13, fontWeight: 900, color: COLORES.suave, textTransform: 'uppercase', letterSpacing: 2 }}>
        {children}
      </div>
      {sub && <div style={{ fontSize: 12, color: COLORES.tenue, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/** Contenedor con título para bloques que no son tarjetas. */
export function Panel({
  titulo,
  sub,
  children,
  style,
}: {
  titulo: string
  sub?: string
  children: React.ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ background: COLORES.fondo, border: `1px solid rgba(124,58,237,0.2)`, borderRadius: 16, padding: '16px 20px', ...style }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORES.suave, textTransform: 'uppercase', letterSpacing: 1, marginBottom: sub ? 2 : 14 }}>
        {titulo}
      </div>
      {sub && <div style={{ fontSize: 12, color: COLORES.tenue, marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  )
}

/**
 * Barra proporcional en CSS. Sin librería de gráficos: para "cuánto de X
 * respecto al total" una barra basta y no añade 300 KB al bundle.
 */
export function Barra({
  etiqueta,
  valor,
  total,
  color = COLORES.primario,
  sufijo,
}: {
  etiqueta: string
  valor: number
  total: number
  color?: string
  sufijo?: string
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
        <span style={{ fontSize: 14, color: COLORES.texto, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {etiqueta}
        </span>
        <span style={{ fontSize: 14, color, fontWeight: 700, flexShrink: 0 }}>
          {valor.toLocaleString('es-MX')}{sufijo ?? ''} ({pct}%)
        </span>
      </div>
      <div style={{ width: '100%', height: 6, background: COLORES.borde, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
    </div>
  )
}

/** Fila de ranking: posición, nombre, subtítulo y una o dos cifras. */
export function FilaRanking({
  posicion,
  nombre,
  sub,
  valor,
  valorSecundario,
  ultima,
  color = COLORES.verde,
}: {
  posicion?: number
  nombre: string
  sub?: string
  valor: string | number
  valorSecundario?: string
  ultima?: boolean
  color?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: ultima ? 'none' : '1px solid rgba(124,58,237,0.1)' }}>
      {posicion !== undefined && (
        <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: COLORES.primario, width: 24, textAlign: 'center', flexShrink: 0 }}>
          {posicion}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORES.texto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
        {sub && <div style={{ fontSize: 12, color: COLORES.suave }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 50, padding: '2px 10px', fontSize: 13, fontWeight: 800, color }}>
          {valor}
        </div>
        {valorSecundario && <div style={{ fontSize: 11, fontWeight: 700, color: '#4B3D6E', whiteSpace: 'nowrap' }}>{valorSecundario}</div>}
      </div>
    </div>
  )
}

/** Aviso contextual: para decir de dónde salen los datos o desde cuándo. */
export function Nota({ children, color = COLORES.ambar }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: `${color}0f`, border: `1px solid ${color}40`, borderRadius: 10, padding: '9px 12px', fontSize: 12, color, lineHeight: 1.5, marginTop: 10 }}>
      {children}
    </div>
  )
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ color: COLORES.tenue, fontSize: 14, padding: '8px 0' }}>{children}</div>
}

export const GRID_4: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
export const GRID_2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 8 }
