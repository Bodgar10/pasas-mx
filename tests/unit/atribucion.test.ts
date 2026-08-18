import { describe, it, expect } from 'vitest'
import { detectAudience, buildAcquisitionSource } from '@/lib/audience-detection'
import { destinoBienvenida } from '@/app/autorizar-menor/[token]/destino'
import { MAPEO_META, MAPEO_TIKTOK } from '@/lib/analytics/track'

/**
 * U9 — Atribución, destino tras autorizar, y las tablas de los pixeles.
 */

describe('detectAudience', () => {
  it('fuentes de hijo y de papá', () => {
    expect(detectAudience('tiktok')).toBe('hijo')
    expect(detectAudience('meta_hijos')).toBe('hijo')
    expect(detectAudience('meta_papas')).toBe('papa')
    expect(detectAudience('google')).toBe('papa')
  })

  it('mayúsculas: se normaliza antes de comparar', () => {
    expect(detectAudience('TikTok')).toBe('hijo')
    expect(detectAudience('META_PAPAS')).toBe('papa')
  })

  it('sin utm_source: unknown', () => {
    expect(detectAudience(null)).toBe('unknown')
    expect(detectAudience(undefined)).toBe('unknown')
    expect(detectAudience('')).toBe('unknown')
  })

  it('fuente desconocida: unknown, no adivina', () => {
    expect(detectAudience('bing')).toBe('unknown')
  })
})

describe('buildAcquisitionSource', () => {
  it('🔴 first_touch_at que viene en los params se RESPETA', () => {
    // El bug real: antes esto era siempre `new Date()`, es decir la fecha en
    // que se construía el objeto y no la del toque. En el camino de /registro
    // eso puede ser días después del clic en el anuncio, y la columna decía
    // "vino el martes" de alguien que llegó el viernes anterior.
    const sellado = '2026-08-01T10:00:00.000Z'

    const r = buildAcquisitionSource({ utm_source: 'tiktok', first_touch_at: sellado })

    expect(r.first_touch_at).toBe(sellado)
  })

  it('sin first_touch_at: se rellena con la hora actual, porque es peor no tener fecha', () => {
    const antes = Date.now()
    const r = buildAcquisitionSource({ utm_source: 'tiktok' })
    const sellado = new Date(r.first_touch_at!).getTime()

    expect(sellado).toBeGreaterThanOrEqual(antes)
    expect(sellado).toBeLessThanOrEqual(Date.now())
  })

  it('valores vacíos: undefined, no cadena vacía', () => {
    // Igual que en la metadata de Stripe: ausente y vacío significan cosas
    // distintas, y guardar '' en el jsonb inventa un dato que no existió.
    const r = buildAcquisitionSource({ utm_source: '', utm_medium: 'cpc' }, '', '')

    expect(r.utm_source).toBeUndefined()
    expect(r.utm_medium).toBe('cpc')
    expect(r.referrer).toBeUndefined()
    expect(r.landing_url).toBeUndefined()
  })

  it('referrer y landing_url llegan por argumento, no por params', () => {
    const r = buildAcquisitionSource({ utm_source: 'tiktok' }, 'https://tiktok.com', 'https://pasas.mx/?x=1')

    expect(r.referrer).toBe('https://tiktok.com')
    expect(r.landing_url).toBe('https://pasas.mx/?x=1')
  })
})

describe('destinoBienvenida', () => {
  it('sin checkout pendiente: /bienvenida a secas', () => {
    // 🔴 Sin plan, /bienvenida cae en sus defaults y la persona elige desde
    // ahí. Lo que NO puede pasar es que no se redirija: pending_checkout
    // decide qué lleva la URL, nunca si hay redirección o no.
    expect(destinoBienvenida(null)).toBe('/bienvenida')
  })

  it('checkout a medias (plan sin duration): /bienvenida a secas', () => {
    expect(destinoBienvenida({ plan: 'estandar_v2' })).toBe('/bienvenida')
    expect(destinoBienvenida({ duration: 'monthly' })).toBe('/bienvenida')
  })

  it('checkout completo: lleva plan y duration', () => {
    expect(destinoBienvenida({ plan: 'estandar_v2', duration: 'monthly' })).toBe(
      '/bienvenida?plan=estandar_v2&duration=monthly'
    )
  })

  it('🔴 con promo: el slug viaja en la URL o muere aquí', () => {
    // El tutor pudo abrir el enlace del correo en otro navegador, así que
    // sessionStorage no es siquiera una opción de respaldo.
    expect(destinoBienvenida({ plan: 'estandar_v2', duration: 'annual', promo_slug: 'pasas1' })).toBe(
      '/bienvenida?plan=estandar_v2&duration=annual&promo=pasas1'
    )
  })

  it('promo_slug null: no se emite un &promo= vacío', () => {
    expect(destinoBienvenida({ plan: 'estandar_v2', duration: 'monthly', promo_slug: null })).toBe(
      '/bienvenida?plan=estandar_v2&duration=monthly'
    )
  })
})

describe('CONTRATO · MAPEO_META y MAPEO_TIKTOK', () => {
  it('🔴 pago_exitoso NO está en ninguno de los dos, y no es un olvido', () => {
    // El webhook de Stripe YA manda 'Subscribe' a Meta y 'CompletePayment' a
    // TikTok con sendMetaCapiEvent/sendTikTokEvent. Mapearlo aquí haría que
    // trackServer mandara un SEGUNDO evento por el mismo cobro y, sin
    // event_id compartido, Meta lo contaría como dos ventas.
    //
    // Hoy esa decisión solo la protege un comentario. Esta prueba la sostiene.
    expect(MAPEO_META).not.toHaveProperty('pago_exitoso')
    expect(MAPEO_TIKTOK).not.toHaveProperty('pago_exitoso')
    expect(MAPEO_META).not.toHaveProperty('checkout_completed')
    expect(MAPEO_TIKTOK).not.toHaveProperty('checkout_completed')
  })

  it('los eventos que sí se mandan, traducidos al vocabulario de cada pixel', () => {
    expect(MAPEO_META).toEqual({
      signup: 'CompleteRegistration',
      checkout_started: 'InitiateCheckout',
      hero_variant_converted: 'Lead',
      signup_completado: 'CompleteRegistration',
      checkout_iniciado: 'InitiateCheckout',
    })

    expect(MAPEO_TIKTOK).toEqual({
      signup: 'CompleteRegistration',
      checkout_started: 'InitiateCheckout',
      hero_variant_converted: 'Lead',
      signup_completado: 'CompleteRegistration',
      checkout_iniciado: 'InitiateCheckout',
    })
  })

  it('un evento de producto cualquiera no llega a los pixeles', () => {
    // La mayoría de los ~67 eventos son de producto: mandarlos todos ensucia
    // la señal y encarece la optimización de las campañas.
    expect(MAPEO_META['seccion_leida']).toBeUndefined()
    expect(MAPEO_TIKTOK['seccion_leida']).toBeUndefined()
  })
})
