'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  guardarConsentimiento,
  hayQuePreguntar,
} from '@/lib/consent'
import { contarAnonimo } from '@/lib/analytics/conteo'

/**
 * Banner de consentimiento de cookies.
 *
 * 🔴 "Rechazar" pesa lo mismo que "Aceptar". Un botón grande de aceptar
 * junto a un enlace chico de configurar es lo que se sanciona. No cambiar
 * la jerarquía visual de los dos botones principales.
 *
 * s37 — compacto. La versión anterior ocupaba casi la mitad de la pantalla
 * de un celular y tapaba el hero y su botón: del tráfico de anuncios del
 * 6 de octubre (~200 visitas) lo aceptó UNA persona y nadie pasó de la
 * landing. Ahora es una barra baja: texto corto y los dos botones en una
 * fila, del mismo tamaño. "Elegir" sigue abriendo las dos categorías.
 * Lo que se dice no cambió: hay análisis, hay publicidad, ambas comparten
 * datos con terceros, y se puede rechazar sin perder nada.
 *
 * Cuenta cuántos lo ven y qué deciden con el conteo anónimo (sin cookies):
 * es justo lo que PostHog no puede medir, porque depende de esta decisión.
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
    if (hayQuePreguntar()) {
      setVisible(true)
      contarAnonimo('aviso_cookies_visto')
    }
  }, [])

  if (!visible) return null

  function decidir(a: boolean, m: boolean, evento: 'aviso_cookies_aceptado' | 'aviso_cookies_rechazado' | 'aviso_cookies_personalizado') {
    contarAnonimo(evento)
    guardarConsentimiento(a, m)
    setVisible(false)
  }

  const enlace = { color: '#c4b5fd', fontWeight: 700, textDecoration: 'underline' } as const

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
        backgroundColor: 'rgba(26, 16, 53, 0.97)',
        borderTop: '1px solid #2D2048',
        padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          maxWidth: 960, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px',
        }}
      >
        <p style={{ flex: '1 1 320px', fontSize: 13, color: '#a78bfa', lineHeight: 1.4, margin: 0 }}>
          Usamos cookies de análisis y publicidad que comparten datos con terceros.
          Puedes rechazarlas y usar Pasas.mx igual.{' '}
          <Link href="/privacidad" style={enlace}>Aviso de Privacidad</Link>
          {!detalle && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setDetalle(true)}
                style={{ ...enlace, background: 'none', border: 'none', padding: 0, fontSize: 13, cursor: 'pointer' }}
              >
                Elegir
              </button>
            </>
          )}
        </p>

        {detalle && (
          <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: '#7c3aed' }}
              />
              <span style={{ fontSize: 13, color: '#e2d9f3' }}>
                <strong>Análisis de uso</strong>
                <span style={{ display: 'block', fontSize: 12, color: '#a78bfa' }}>
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
              <span style={{ fontSize: 13, color: '#e2d9f3' }}>
                <strong>Publicidad</strong>
                <span style={{ display: 'block', fontSize: 12, color: '#a78bfa' }}>
                  Comparte datos con Meta, TikTok y Google para medir anuncios.
                </span>
              </span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flex: '1 1 240px', maxWidth: 360 }}>
          <button
            type="button"
            onClick={() => decidir(false, false, 'aviso_cookies_rechazado')}
            style={{
              flex: 1, minHeight: 40, borderRadius: 10,
              backgroundColor: 'transparent', border: '1.5px solid #7c3aed',
              color: '#c4b5fd', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() =>
              detalle
                ? decidir(analytics, marketing, 'aviso_cookies_personalizado')
                : decidir(true, true, 'aviso_cookies_aceptado')
            }
            style={{
              flex: 1, minHeight: 40, borderRadius: 10,
              backgroundColor: '#7c3aed', border: '1.5px solid #7c3aed',
              color: '#ffffff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}
          >
            {detalle ? 'Guardar' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
