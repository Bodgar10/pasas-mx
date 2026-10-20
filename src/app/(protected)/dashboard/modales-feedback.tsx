'use client'

import { useState } from 'react'

/**
 * Modales de feedback del dashboard. El texto que se escribe vive AQUÍ y no
 * en DashboardClient: antes cada tecla re-pintaba el dashboard completo.
 *
 * Siguen montados aunque estén cerrados (devuelven null), así que lo escrito
 * se conserva al cerrar y volver a abrir, igual que cuando el estado vivía en
 * el padre. El envío (fetch, "Enviando…", "¡Enviado!") sigue en el padre.
 */

type Comunes = {
  abierto: boolean
  onCerrar: () => void
  feedbackSending: boolean
  feedbackSent: 'subject' | 'bug' | null
}

export function ModalPedirMateria({
  abierto,
  onCerrar,
  feedbackSending,
  feedbackSent,
  educationLevel,
  grade,
  onEnviar,
}: Comunes & {
  educationLevel: string | null
  grade: number | null
  /** true si se envió: entonces se limpia el formulario. */
  onEnviar: (nombre: string, desc: string) => Promise<boolean>
}) {
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')

  async function enviar() {
    if (!nombre.trim()) return
    if (await onEnviar(nombre, desc)) {
      setNombre('')
      setDesc('')
    }
  }

  if (!abierto) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,10,30,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onCerrar}>
      <div style={{
        background: '#1a1035', border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 20, padding: 24, width: '100%', maxWidth: 440,
      }} onClick={e => e.stopPropagation()}>
        {feedbackSent === 'subject' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#10b981' }}>¡Solicitud enviada!</div>
            <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 8 }}>Lo revisamos y la agregamos pronto.</div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>
              📩 Solicitar materia
            </div>
            <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
              {educationLevel === 'middle_school' ? 'Secundaria' : 'Preparatoria'} {grade}°
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                  Nombre de la materia *
                </label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="ej. Física 2°"
                  style={{ width: '100%', background: '#1C1033', border: '1.5px solid #2D2048', borderRadius: 10, color: '#e2d9f3', fontSize: 15, padding: '10px 12px', fontFamily: 'var(--font-nunito)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                  ¿Algo más que quieras decirnos? (opcional)
                </label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="ej. La vemos en tercer semestre con el prof. García"
                  rows={3}
                  style={{ width: '100%', background: '#1C1033', border: '1.5px solid #2D2048', borderRadius: 10, color: '#e2d9f3', fontSize: 15, padding: '10px 12px', fontFamily: 'var(--font-nunito)', boxSizing: 'border-box', resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onCerrar}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048', color: '#a78bfa', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                Cancelar
              </button>
              <button type="button" onClick={enviar} disabled={feedbackSending || !nombre.trim()}
                style={{ background: nombre.trim() ? 'linear-gradient(135deg, #7c3aed, #ec4899)' : 'rgba(124,58,237,0.3)', color: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 800, border: 'none', cursor: (feedbackSending || !nombre.trim()) ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'var(--font-nunito)', opacity: feedbackSending ? 0.7 : 1 }}>
                {feedbackSending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ModalReportarBug({
  abierto,
  onCerrar,
  feedbackSending,
  feedbackSent,
  onEnviar,
}: Comunes & {
  /** true si se envió: entonces se limpia el formulario. */
  onEnviar: (desc: string) => Promise<boolean>
}) {
  const [desc, setDesc] = useState('')

  async function enviar() {
    if (!desc.trim()) return
    if (await onEnviar(desc)) setDesc('')
  }

  if (!abierto) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,10,30,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onCerrar}>
      <div style={{
        background: '#1a1035', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 20, padding: 24, width: '100%', maxWidth: 440,
      }} onClick={e => e.stopPropagation()}>
        {feedbackSent === 'bug' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#10b981' }}>¡Reporte enviado!</div>
            <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 8 }}>Lo revisamos y si procede te damos 15 días gratis.</div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 900, color: '#e2d9f3', marginBottom: 4 }}>
              🐛 Reportar error
            </div>
            <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
              Si encontraste un error, cuéntanos qué pasó. Si el reporte procede, te damos 15 días gratis.
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                ¿Qué pasó? *
              </label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="ej. En la materia de Matemáticas 1°, el tema 'Álgebra' no carga el contenido"
                rows={4}
                style={{ width: '100%', background: '#1C1033', border: '1.5px solid #2D2048', borderRadius: 10, color: '#e2d9f3', fontSize: 15, padding: '10px 12px', fontFamily: 'var(--font-nunito)', boxSizing: 'border-box', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onCerrar}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048', color: '#a78bfa', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)' }}>
                Cancelar
              </button>
              <button type="button" onClick={enviar} disabled={feedbackSending || !desc.trim()}
                style={{ background: desc.trim() ? '#ef4444' : 'rgba(239,68,68,0.3)', color: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 800, border: 'none', cursor: (feedbackSending || !desc.trim()) ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'var(--font-nunito)', opacity: feedbackSending ? 0.7 : 1 }}>
                {feedbackSending ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
