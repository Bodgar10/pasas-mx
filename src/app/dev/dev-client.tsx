'use client'

import { useEffect, useState } from 'react'
import { track, pendientesEnCola } from '@/lib/analytics/track'
import { permiteAnalytics, permiteMarketing } from '@/lib/consent'

/**
 * ÚNICO evento instrumentado con track() por ahora. Valida la tubería de
 * punta a punta; los ~67 eventos reales van en los prompts 3 a 6.
 *
 * También se expone en `window.__track` para poder dispararlo desde la
 * consola en cualquier pantalla, no solo aquí.
 */
export default function DevClient() {
  const [disparos, setDisparos] = useState(0)
  const [estado, setEstado] = useState({ cola: 0, analytics: false, marketing: false })
  // Resultado crudo de /dev/track-server: dice a qué destinos llegó el evento
  // de servidor y por qué se saltó el resto.
  const [servidor, setServidor] = useState<string | null>(null)

  // Todo se relee en el intervalo, no una vez al montar: así aceptar el
  // banner en otra pestaña —o revocarlo— se refleja aquí sin recargar, que
  // es justo lo que hay que poder ver al probar el consentimiento.
  useEffect(() => {
    const leer = () =>
      setEstado({
        cola: pendientesEnCola(),
        analytics: permiteAnalytics(),
        marketing: permiteMarketing(),
      })
    const t = setInterval(leer, 400)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    // Puente de consola. Se va solo al desmontar, y la ruta entera es 404
    // en producción, así que no queda nada colgado del global en prod.
    ;(window as unknown as Record<string, unknown>).__track = track
    return () => {
      delete (window as unknown as Record<string, unknown>).__track
    }
  }, [])

  function disparar() {
    track('test_pipeline', { origen: 'manual' })
    setDisparos((n) => n + 1)
  }

  async function dispararServidor() {
    setServidor('…')
    try {
      const res = await fetch('/dev/track-server')
      setServidor(JSON.stringify(await res.json(), null, 2))
    } catch (err) {
      setServidor(`error de red: ${String(err)}`)
    }
  }

  const fila = { display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'var(--font-nunito)',
        color: '#e2d9f3',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
        🔧 Analytics · banco de pruebas
      </h1>
      <p style={{ fontSize: 14, color: '#a78bfa', marginBottom: 24, lineHeight: 1.6 }}>
        Dispara <code>track(&apos;test_pipeline&apos;, {'{'} origen: &apos;manual&apos; {'}'})</code>.
        Ruta temporal: se borra eliminando <code>src/app/dev/</code>.
      </p>

      <div
        style={{
          background: '#1a1035',
          border: '1px solid #2D2048',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
        }}
      >
        <div style={fila}>
          <span style={{ color: '#a78bfa', width: 190 }}>Consentimiento analytics</span>
          <strong style={{ color: estado.analytics ? '#10b981' : '#ef4444' }}>
            {estado.analytics ? 'sí — PostHog + GA4' : 'no — ambos se saltan'}
          </strong>
        </div>
        <div style={fila}>
          <span style={{ color: '#a78bfa', width: 190 }}>Consentimiento marketing</span>
          <strong style={{ color: estado.marketing ? '#10b981' : '#ef4444' }}>
            {estado.marketing ? 'sí — Meta + TikTok' : 'no — ambos se saltan'}
          </strong>
        </div>
        <div style={fila}>
          <span style={{ color: '#a78bfa', width: 190 }}>Globales presentes</span>
          <strong style={{ color: '#e2d9f3' }}>
            {typeof window !== 'undefined'
              ? (['posthog', 'gtag', 'fbq', 'ttq'] as const)
                  .map((g) => `${g}:${(window as unknown as Record<string, unknown>)[g] ? '✓' : '✗'}`)
                  .join('  ')
              : '—'}
          </strong>
        </div>
        <div style={fila}>
          <span style={{ color: '#a78bfa', width: 190 }}>En cola / disparados</span>
          <strong style={{ color: estado.cola > 0 ? '#fbbf24' : '#e2d9f3' }}>
            {estado.cola} / {disparos}
          </strong>
        </div>
      </div>

      <button
        type="button"
        onClick={disparar}
        style={{
          background: '#7c3aed',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          padding: '12px 22px',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'var(--font-nunito)',
        }}
      >
        Disparar test_pipeline
      </button>

      <button
        type="button"
        onClick={dispararServidor}
        style={{
          background: 'transparent',
          color: '#a78bfa',
          border: '1px solid #2D2048',
          borderRadius: 12,
          padding: '12px 22px',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'var(--font-nunito)',
          marginLeft: 10,
        }}
      >
        Disparar test_pipeline_servidor
      </button>

      {servidor && (
        <pre
          style={{
            marginTop: 16,
            background: '#1a1035',
            border: '1px solid #2D2048',
            borderRadius: 12,
            padding: '14px 16px',
            fontSize: 12,
            color: '#c4b5fd',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {servidor}
        </pre>
      )}

      <p style={{ fontSize: 13, color: '#6b5fa0', marginTop: 20, lineHeight: 1.6 }}>
        Desde la consola de cualquier pantalla, con esta ruta abierta al menos una vez:
        <br />
        <code>__track(&apos;test_pipeline&apos;, {'{'} origen: &apos;consola&apos; {'}'})</code>
        <br />
        <br />
        <strong style={{ color: '#fbbf24' }}>Nota:</strong> <code>test_pipeline</code> no está en{' '}
        <code>MAPEO_META</code> ni en <code>MAPEO_TIKTOK</code>, así que{' '}
        <em>por diseño</em> solo debe verse en PostHog y GA4, aunque aceptes marketing.
      </p>
    </div>
  )
}
