'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { formatoMXN } from '@/lib/payments/config'
import {
  etiquetaCiclo,
  etiquetaDescuento,
  etiquetaPlan,
  precioConPromo,
  type PromoCampaign,
  type PromoVerificacion,
  type TopeCanjes,
} from '@/lib/promos'

interface Props {
  campanas: PromoCampaign[]
}

/** Fechas en es-MX. Sin hora: las campañas se piensan por día. */
function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Cómo se lee la duración de un cupón de Stripe. */
function textoDuracion(v: PromoVerificacion): string {
  switch (v.duracion) {
    case 'forever':
      return 'Para siempre (todos los cobros)'
    case 'once':
      return 'Un solo cobro'
    case 'repeating':
      return `${v.duracion_meses ?? '?'} meses`
    default:
      return '—'
  }
}

/** El descuento tal como lo tiene Stripe. */
function textoDescuentoStripe(v: PromoVerificacion): string {
  if (v.stripe_descuento_valor == null) return '—'
  if (v.stripe_descuento_tipo === 'porcentaje') return `${v.stripe_descuento_valor}%`
  return `$${formatoMXN(v.stripe_descuento_valor)} ${(v.stripe_moneda ?? '').toUpperCase()}`.trim()
}

/** "812 de 1001" | "3 canjes, sin tope" | "sin tope". */
function textoTope(t: TopeCanjes): string {
  if (t.max_redemptions != null) {
    return `${t.times_redeemed ?? 0} de ${t.max_redemptions}`
  }
  return t.times_redeemed != null && t.times_redeemed > 0
    ? `${t.times_redeemed} canjes, sin tope`
    : 'sin tope'
}

/**
 * Los ids de Stripe. `wordBreak` parte la cadena dentro de su caja en vez de
 * dejarla desbordar sobre la celda vecina, y como no se trunca, se copia
 * completa de un triple clic.
 */
const ID_STRIPE_STYLE = {
  fontSize: 13,
  color: '#e2d9f3',
  fontFamily: 'monospace',
  display: 'block',
  wordBreak: 'break-all' as const,
}

const LABEL_STYLE = {
  fontSize: 12,
  color: '#a78bfa',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  marginBottom: 4,
  display: 'block',
}

const BOTON_SECUNDARIO = {
  background: 'rgba(124,58,237,0.12)',
  border: '1px solid rgba(124,58,237,0.3)',
  color: '#a78bfa',
  borderRadius: 10,
  padding: '9px 18px',
  fontSize: 14,
  fontWeight: 800,
  fontFamily: 'var(--font-nunito)',
  cursor: 'pointer',
}

export default function PromocionesClient({ campanas }: Props) {
  const router = useRouter()
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null)
  const [verificandoSlug, setVerificandoSlug] = useState<string | null>(null)
  const [verificaciones, setVerificaciones] = useState<Record<string, PromoVerificacion>>({})
  const [erroresVerify, setErroresVerify] = useState<Record<string, string>>({})

  /**
   * Toggle del interruptor. Actualiza SOLO la columna `activa`.
   *
   * 🔴 La migración 042 no trae trigger de updated_at (el repo no tiene ese
   * patrón en ninguna tabla), así que `updated_at` se queda con la fecha del
   * INSERT. No leerla como "última vez que se prendió".
   */
  async function toggleActiva(slug: string, activaAhora: boolean) {
    setTogglingSlug(slug)
    const supabase = createClient()
    const { error } = await supabase
      .from('promo_campaigns')
      .update({ activa: !activaAhora })
      .eq('slug', slug)
    setTogglingSlug(null)
    if (error) {
      alert('Error al guardar: ' + error.message)
      return
    }
    router.refresh()
  }

  /**
   * Resuelve el código contra Stripe y compara el descuento.
   *
   * 🔴 Nada obliga a correr esto antes de prender una campaña — el toggle no
   * lo exige porque no hay forma de saber si el resultado que se ve en
   * pantalla sigue siendo cierto. Correrlo es parte del procedimiento: si
   * marca DESAJUSTE, la campaña no se prende.
   */
  async function verificar(slug: string) {
    setVerificandoSlug(slug)
    // Limpia el error anterior de ESTA campaña, no los de las demás.
    setErroresVerify((prev) => {
      if (!(slug in prev)) return prev
      const resto = { ...prev }
      delete resto[slug]
      return resto
    })
    try {
      const res = await fetch('/api/admin/promo/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroresVerify((prev) => ({ ...prev, [slug]: data.error ?? 'Error desconocido' }))
        return
      }
      setVerificaciones((prev) => ({ ...prev, [slug]: data as PromoVerificacion }))
    } catch {
      setErroresVerify((prev) => ({ ...prev, [slug]: 'No se pudo contactar al servidor' }))
    } finally {
      setVerificandoSlug(null)
    }
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '32px 16px',
        fontFamily: 'var(--font-nunito)',
        color: '#e2d9f3',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 24,
            fontWeight: 900,
            color: '#e2d9f3',
          }}
        >
          🎟️ Promociones
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          style={{ ...BOTON_SECUNDARIO, marginLeft: 'auto', fontSize: 15 }}
        >
          ← Panel
        </button>
      </div>

      <p style={{ fontSize: 14, color: '#a78bfa', lineHeight: 1.6, marginBottom: 28 }}>
        El descuento real lo aplica el cupón que Stripe tiene detrás del{' '}
        <strong>código visible</strong>. Los montos de abajo son lo que la app{' '}
        <em>anunciará</em>. Corre <strong>Verificar en Stripe</strong> antes de prender una
        campaña: si marca DESAJUSTE, no la prendas.
      </p>

      {campanas.length === 0 ? (
        <div style={{ fontSize: 16, color: '#a78bfa' }}>No hay campañas registradas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {campanas.map((c) => {
            const guardando = togglingSlug === c.slug
            const verificando = verificandoSlug === c.slug
            const v = verificaciones[c.slug]
            const errorVerify = erroresVerify[c.slug]

            return (
              <div
                key={c.slug}
                style={{
                  background: '#1a1035',
                  border: c.activa
                    ? '1.5px solid rgba(16,185,129,0.4)'
                    : '1px solid rgba(124,58,237,0.2)',
                  borderRadius: 16,
                  padding: '20px 20px 16px',
                }}
              >
                {/* Encabezado: slug + código + acciones */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-orbitron)',
                        fontSize: 17,
                        fontWeight: 900,
                        color: '#e2d9f3',
                        marginBottom: 4,
                      }}
                    >
                      {c.slug}
                    </div>
                    <div style={{ fontSize: 14, color: '#a78bfa' }}>
                      Código visible:{' '}
                      <strong style={{ color: '#e2d9f3', letterSpacing: 1 }}>
                        {c.codigo_visible}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        borderRadius: 999,
                        padding: '3px 12px',
                        background: c.activa ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                        border: c.activa
                          ? '1px solid rgba(16,185,129,0.3)'
                          : '1px solid rgba(148,163,184,0.25)',
                        color: c.activa ? '#10b981' : '#94a3b8',
                      }}
                    >
                      {c.activa ? '● Activa' : '○ Inactiva'}
                    </span>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => verificar(c.slug)}
                        disabled={verificando}
                        style={{
                          ...BOTON_SECUNDARIO,
                          cursor: verificando ? 'not-allowed' : 'pointer',
                          opacity: verificando ? 0.7 : 1,
                        }}
                      >
                        {verificando ? 'Verificando...' : '🔍 Verificar en Stripe'}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActiva(c.slug, c.activa)}
                        disabled={guardando}
                        style={{
                          background: c.activa ? 'rgba(239,68,68,0.08)' : '#7c3aed',
                          border: c.activa ? '1px solid rgba(239,68,68,0.25)' : 'none',
                          color: c.activa ? '#ef4444' : '#fff',
                          borderRadius: 10,
                          padding: '9px 18px',
                          fontSize: 14,
                          fontWeight: 800,
                          fontFamily: 'var(--font-nunito)',
                          cursor: guardando ? 'not-allowed' : 'pointer',
                          opacity: guardando ? 0.7 : 1,
                        }}
                      >
                        {guardando ? 'Guardando...' : c.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Alcance, descuento y fechas */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 14,
                    paddingTop: 14,
                    borderTop: '1px solid #2D2048',
                  }}
                >
                  <div>
                    <span style={LABEL_STYLE}>Planes</span>
                    <span style={{ fontSize: 14, color: '#e2d9f3' }}>
                      {c.planes.map(etiquetaPlan).join(', ')}
                    </span>
                  </div>
                  <div>
                    <span style={LABEL_STYLE}>Ciclos</span>
                    <span style={{ fontSize: 14, color: '#e2d9f3' }}>
                      {c.ciclos.map(etiquetaCiclo).join(', ')}
                    </span>
                  </div>
                  <div>
                    <span style={LABEL_STYLE}>Descuento</span>
                    <span style={{ fontSize: 14, color: '#e2d9f3' }}>{etiquetaDescuento(c)}</span>
                  </div>
                  <div>
                    <span style={LABEL_STYLE}>Inicia</span>
                    <span style={{ fontSize: 14, color: '#e2d9f3' }}>{fechaCorta(c.inicia_at)}</span>
                  </div>
                  <div>
                    <span style={LABEL_STYLE}>Termina</span>
                    <span style={{ fontSize: 14, color: '#e2d9f3' }}>{fechaCorta(c.termina_at)}</span>
                  </div>
                </div>

                {/*
                  Verificación de precios. Cada línea sale de precioConPromo(),
                  la MISMA función que usará la UI pública: si aquí dice $1, la
                  pantalla dirá $1. Lo que no garantiza es que Stripe cobre $1
                  — eso lo dice el bloque de "Verificar en Stripe".
                */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #2D2048' }}>
                  <span style={LABEL_STYLE}>Lo que se anunciará</span>
                  {c.planes.flatMap((plan) =>
                    c.ciclos.map((ciclo) => {
                      const precio = precioConPromo(c, plan, ciclo)
                      const etiqueta = `${etiquetaPlan(plan)} ${etiquetaCiclo(ciclo)}`

                      return (
                        <div
                          key={`${plan}-${ciclo}`}
                          style={{
                            fontSize: 15,
                            color: precio ? '#e2d9f3' : '#ef4444',
                            fontFamily: 'monospace',
                            lineHeight: 1.8,
                          }}
                        >
                          {precio
                            ? `${etiqueta}: $${formatoMXN(precio.lista)} → $${formatoMXN(precio.final)}`
                            : `${etiqueta}: sin precio de lista en PLAN_DISPLAY`}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Resultado de la verificación contra Stripe */}
                {errorVerify && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      fontSize: 14,
                      color: '#ef4444',
                      fontWeight: 700,
                    }}
                  >
                    No se pudo verificar: {errorVerify}
                  </div>
                )}

                {v && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: v.desajuste ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                      border: v.desajuste
                        ? '1.5px solid rgba(239,68,68,0.35)'
                        : '1.5px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-orbitron)',
                        fontSize: 14,
                        fontWeight: 900,
                        color: v.desajuste ? '#ef4444' : '#10b981',
                        marginBottom: v.desajuste_motivos.length > 0 ? 10 : 14,
                      }}
                    >
                      {!v.existe
                        ? '🔴 DESAJUSTE — Stripe no reconoce el código'
                        : v.desajuste
                        ? '🔴 DESAJUSTE — no prender esta campaña'
                        : '✅ Coincide con Stripe'}
                    </div>

                    {v.desajuste_motivos.length > 0 && (
                      <ul
                        style={{
                          margin: '0 0 14px',
                          paddingLeft: 20,
                          fontSize: 14,
                          color: '#e2d9f3',
                          lineHeight: 1.7,
                        }}
                      >
                        {v.desajuste_motivos.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}

                    {v.existe && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 14,
                        }}
                      >
                        {/*
                          Los ids de Stripe (promo_1U42D6FgP0GDlD36NXnw…) son
                          largos y no tienen espacios: dentro de una columna de
                          160px se desbordaban encima de la celda vecina. Van
                          en su propia fila a ancho completo —gridColumn 1/-1—
                          y con wordBreak, que parte la cadena en vez de
                          empujarla fuera.

                          🔴 Se parte, NO se trunca con ellipsis: son ids que
                          se copian y se pegan en el buscador de Stripe. Un
                          "promo_1U42…" a medias obliga a abrir el inspector.
                        */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={LABEL_STYLE}>Cupón</span>
                          <span style={ID_STRIPE_STYLE}>{v.cupon_id ?? '—'}</span>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={LABEL_STYLE}>Promotion code</span>
                          <span style={ID_STRIPE_STYLE}>{v.promotion_code_id ?? '—'}</span>
                        </div>
                        <div>
                          <span style={LABEL_STYLE}>Descuento en Stripe</span>
                          <span style={{ fontSize: 14, color: '#e2d9f3', fontWeight: 700 }}>
                            {textoDescuentoStripe(v)}
                          </span>
                        </div>
                        <div>
                          <span style={LABEL_STYLE}>Duración</span>
                          <span style={{ fontSize: 14, color: '#e2d9f3' }}>{textoDuracion(v)}</span>
                        </div>
                        {/*
                          Los dos niveles, por separado y etiquetados. El tope
                          de PASAS1 vive en el CUPÓN y su promotion code va sin
                          tope: una sola línea "Canjes" no permitía ver cuál de
                          los dos manda, y mostrando solo el promotion code
                          decía "∞" sobre una campaña que sí se agota.
                        */}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={LABEL_STYLE}>Canjes</span>
                          <span style={{ fontSize: 14, color: '#e2d9f3', display: 'block' }}>
                            Cupón: {textoTope(v.tope_cupon)}
                          </span>
                          <span style={{ fontSize: 14, color: '#e2d9f3', display: 'block' }}>
                            Promotion code: {textoTope(v.tope_promotion_code)}
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              display: 'block',
                              marginTop: 4,
                              color: v.canjes_restantes === 0 ? '#ef4444' : '#10b981',
                            }}
                          >
                            {v.canjes_restantes == null
                              ? 'Sin tope en ningún nivel: ilimitado'
                              : `${v.canjes_restantes} restantes`}
                          </span>
                        </div>
                        <div>
                          <span style={LABEL_STYLE}>Solo primera compra</span>
                          <span style={{ fontSize: 14, color: '#e2d9f3' }}>
                            {v.first_time_transaction === null
                              ? '—'
                              : v.first_time_transaction
                              ? 'Sí'
                              : 'No'}
                          </span>
                        </div>
                        <div>
                          <span style={LABEL_STYLE}>Expira</span>
                          <span style={{ fontSize: 14, color: '#e2d9f3' }}>
                            {fechaCorta(v.expira_at)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Copy que verá el usuario */}
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px solid #2D2048',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span style={LABEL_STYLE}>Copy</span>
                  <div style={{ fontSize: 14, color: '#e2d9f3' }}>
                    <strong style={{ color: '#a78bfa' }}>CTA:</strong> {c.cta_label}
                  </div>
                  {c.cta_sublabel && (
                    <div style={{ fontSize: 14, color: '#e2d9f3' }}>
                      <strong style={{ color: '#a78bfa' }}>Sub:</strong> {c.cta_sublabel}
                    </div>
                  )}
                  {c.badge_landing && (
                    <div style={{ fontSize: 14, color: '#e2d9f3' }}>
                      <strong style={{ color: '#a78bfa' }}>Badge:</strong> {c.badge_landing}
                    </div>
                  )}
                  {c.banner_checkout && (
                    <div style={{ fontSize: 14, color: '#e2d9f3' }}>
                      <strong style={{ color: '#a78bfa' }}>Banner:</strong> {c.banner_checkout}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
