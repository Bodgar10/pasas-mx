import { describe, it, expect } from 'vitest'
import { construirMetadataCheckout, CLAVES_ATRIBUCION } from '@/lib/payments/metadata-checkout'

/**
 * U5 — La metadata que viaja a Stripe.
 *
 * Es el puente entre el clic y el cobro: el webhook lee `user_id` de aquí
 * para saber a quién escribirle la suscripción, y el bloque de atribución
 * para saber por qué canal entró. Stripe impone 50 claves y 500 caracteres
 * por valor, y esos límites NO están en los tipos del SDK —MetadataParam es
 * un index signature abierto—, así que TypeScript no frena nada y el error
 * llegaría en runtime desde la API, tumbando la venta.
 */

const BASE = { userId: 'user-123', plan: 'estandar_v2', duration: 'monthly' }

describe('construirMetadataCheckout', () => {
  it('sin acquisition ni promo: solo los campos propios del pedido', () => {
    expect(construirMetadataCheckout(BASE)).toEqual({
      user_id: 'user-123',
      plan: 'estandar_v2',
      duration: 'monthly',
    })
  })

  it('checkoutEventId: se emite si viene, se omite si no', () => {
    // 🔴 Es lo que cierra el círculo entre `checkout_iniciado` (navegador) y
    // `pago_exitoso` (webhook). Sin él, "cuántos checkouts abiertos acaban en
    // cobro" solo se puede responder por usuario, y eso miente en cuanto
    // alguien abre el checkout dos veces.
    const con = construirMetadataCheckout({ ...BASE, checkoutEventId: 'evt-abc-123' })
    expect(con.checkout_event_id).toBe('evt-abc-123')

    const sin = construirMetadataCheckout({ ...BASE, checkoutEventId: null })
    expect(sin).not.toHaveProperty('checkout_event_id')
  })

  it('valores vacíos NO se emiten: una clave ausente y una clave vacía significan cosas distintas', () => {
    // Una propiedad ausente se lee como "no había dato"; un '' como "el dato
    // es vacío", que es falso.
    const r = construirMetadataCheckout({
      ...BASE,
      promoSlug: '',
      acquisition: { utm_source: 'tiktok', utm_medium: '', utm_campaign: undefined },
    })

    expect(r.utm_source).toBe('tiktok')
    expect(r).not.toHaveProperty('utm_medium')
    expect(r).not.toHaveProperty('utm_campaign')
    expect(r).not.toHaveProperty('promo_slug')
  })

  it('🔴 landing_url que pasa de 500 caracteres: se le tira el query y sobrevive origen + path', () => {
    // No se pierde nada útil: los parámetros de campaña ya viajan desglosados
    // en los cinco utm_*.
    const larga = `https://pasas.mx/planes?ref=${'a'.repeat(600)}`
    expect(larga.length).toBeGreaterThan(500)

    const r = construirMetadataCheckout({ ...BASE, acquisition: { landing_url: larga } })

    expect(r.landing_url).toBe('https://pasas.mx/planes')
    expect(r.landing_url.length).toBeLessThanOrEqual(500)
  })

  it('landing_url que no es una URL válida y es larga: se corta en seco a 500', () => {
    const basura = `no-es-una-url-${'a'.repeat(600)}`

    const r = construirMetadataCheckout({ ...BASE, acquisition: { landing_url: basura } })

    expect(r.landing_url).toHaveLength(500)
    expect(r.landing_url).toBe(basura.slice(0, 500))
  })

  it('🔴 orden de prioridad: utm_source va antes que promo_slug, y landing_url al final', () => {
    // El orden es el de descarte cuando no cabe todo: se tira desde el FINAL.
    // Sin utm_source no hay canal y el resto no significa nada; landing_url y
    // referrer son contexto reconstruible.
    const r = construirMetadataCheckout({
      ...BASE,
      promoSlug: 'pasas1',
      acquisition: {
        utm_source: 'tiktok',
        utm_medium: 'cpc',
        utm_campaign: 'agosto',
        utm_content: 'video3',
        utm_term: 'mate',
        referrer: 'https://tiktok.com',
        landing_url: 'https://pasas.mx/',
      },
    })

    expect(Object.keys(r)).toEqual([
      'user_id',
      'plan',
      'duration',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'promo_slug',
      'utm_content',
      'utm_term',
      'referrer',
      'landing_url',
    ])
    // Muy por debajo del tope de 50 claves de Stripe.
    expect(Object.keys(r).length).toBeLessThan(50)
  })

  it('CONTRATO · CLAVES_ATRIBUCION: las siete que el webhook rescata, y promo_slug NO está', () => {
    // 🔴 promo_slug tiene su propia columna en subscriptions desde la
    // migración 043. Meterlo también en el jsonb daría dos verdades que se
    // pueden contradecir.
    expect([...CLAVES_ATRIBUCION]).toEqual([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'referrer',
      'landing_url',
    ])
    expect(CLAVES_ATRIBUCION).not.toContain('promo_slug')
  })
})
