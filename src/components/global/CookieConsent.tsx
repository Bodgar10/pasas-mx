'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  guardarConsentimiento,
  hayQuePreguntar,
} from '@/lib/consent'

/**
 * Banner de consentimiento de cookies.
 *
 * 🔴 "Rechazar" pesa lo mismo que "Aceptar". Un botón grande de aceptar
 * junto a un enlace chico de configurar es lo que se sanciona. No cambiar
 * la jerarquía visual de los dos botones principales.
 *
 * No se monta hasta que el cliente hidrata: en el servidor no hay
 * localStorage, y pintarlo en SSR causaría un parpadeo a quien ya contestó.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [detalle, setDetalle] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    if (hayQuePreguntar()) setVisible(true)
  }, [])

  if (!visible) return null

  function decidir(a: boolean, m: boolean) {
    guardarConsentimiento(a, m)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
        backgroundColor: '#1a1035',
        borderTop: '1.5px solid #2D2048',
        padding: '18px 16px calc(18px + env(safe-area-inset-bottom))',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <p style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700, margin: '0 0 6px' }}>
          Cookies y datos
        </p>
        <p style={{ fontSize: 14, color: '#a78bfa', lineHeight: 1.5, margin: '0 0 14px' }}>
          Usamos herramientas que analizan cómo se usa el sitio y que pueden
          compartir datos con terceros. Puedes rechazarlas y seguir usando
          Pasas.mx igual.{' '}
          <Link href="/privacidad" style={{ color: '#7c3aed', fontWeight: 700 }}>
            Aviso de Privacidad
          </Link>
        </p>

        {detalle && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: '#7c3aed' }}
              />
              <span style={{ fontSize: 14, color: '#e2d9f3' }}>
                <strong>Análisis de uso</strong>
                <span style={{ display: 'block', fontSize: 13, color: '#a78bfa' }}>
                  Nos dice qué pantallas se usan y dónde se traba la gente.
                  Incluye grabación de sesiones.
                </span>
              </span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: '#7c3aed' }}
              />
              <span style={{ fontSize: 14, color: '#e2d9f3' }}>
                <strong>Publicidad</strong>
                <span style={{ display: 'block', fontSize: 13, color: '#a78bfa' }}>
                  Comparte datos con Meta, TikTok y Google para medir anuncios.
                </span>
              </span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => decidir(false, false)}
            style={{
              flex: 1, minHeight: 46, borderRadius: 12,
              backgroundColor: 'transparent', border: '1.5px solid #7c3aed',
              color: '#a78bfa', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            }}
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => (detalle ? decidir(analytics, marketing) : decidir(true, true))}
            style={{
              flex: 1, minHeight: 46, borderRadius: 12,
              backgroundColor: '#7c3aed', border: 'none',
              color: '#ffffff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            }}
          >
            {detalle ? 'Guardar' : 'Aceptar'}
          </button>
        </div>

        {!detalle && (
          <button
            type="button"
            onClick={() => setDetalle(true)}
            style={{
              marginTop: 10, width: '100%', background: 'none', border: 'none',
              color: '#a78bfa', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Elegir qué permito
          </button>
        )}
      </div>
    </div>
  )
}
