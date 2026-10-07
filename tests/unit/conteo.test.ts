import { describe, expect, it } from 'vitest'
import { esEventoConteo, limpiarProps, tramoCarga } from '@/lib/analytics/conteo'

describe('conteo anónimo', () => {
  it('solo acepta eventos de la lista', () => {
    expect(esEventoConteo('hero_variant_seen')).toBe(true)
    expect(esEventoConteo('aviso_cookies_rechazado')).toBe(true)
    expect(esEventoConteo('arcade_completado')).toBe(true)
    // Eventos de dentro del producto no se cuentan aquí.
    expect(esEventoConteo('quiz_completado')).toBe(false)
    expect(esEventoConteo('')).toBe(false)
  })

  it('descarta claves que pueden identificar a alguien', () => {
    const limpio = limpiarProps({
      user_id: 'u-123',
      learner_id: 'l-456',
      email: 'alguien@ejemplo.com',
      promo_slug: 'pasas1',
      utm_source: 'ig',
      event_id: 'ev_1',
      section: 'hero',
      percent: 50,
      cta_visto: true,
    })
    expect(limpio).toEqual({ section: 'hero', percent: 50, cta_visto: true })
  })

  it('descarta valores no escalares, vacíos o largos', () => {
    const limpio = limpiarProps({
      section: { anidado: true },
      variant: '',
      motivo: 'x'.repeat(41),
      location: 'hero',
      score: Number.NaN,
      paso: 2,
    })
    expect(limpio).toEqual({ location: 'hero', paso: 2 })
  })

  it('no revienta con entradas raras', () => {
    expect(limpiarProps(null)).toEqual({})
    expect(limpiarProps('texto')).toEqual({})
    expect(limpiarProps(undefined)).toEqual({})
  })

  it('agrupa el tiempo de carga en tramos', () => {
    expect(tramoCarga(450)).toBe('<1s')
    expect(tramoCarga(1000)).toBe('1-3s')
    expect(tramoCarga(4200)).toBe('3-5s')
    expect(tramoCarga(9000)).toBe('>5s')
    expect(tramoCarga(0)).toBeNull()
    expect(tramoCarga(Number.NaN)).toBeNull()
  })
})
