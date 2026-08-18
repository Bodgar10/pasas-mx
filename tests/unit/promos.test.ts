import { describe, it, expect } from 'vitest'
import { precioConPromo, promoAplica, leyendaPromo } from '@/lib/promos'
import type { PromoCampaign } from '@/lib/promos'

/**
 * U1 — El núcleo de dinero.
 *
 * 🔴 Estas catorce pruebas cubren el error más caro que puede cometer este
 * producto: anunciar un precio y cobrar otro. Todo lo que pinta un número con
 * descuento en pantalla pasa por precioConPromo(); si devuelve mal, la
 * pantalla miente y eso es materia de PROFECO.
 *
 * Los precios de lista contra los que se afirma salen de PLAN_DISPLAY
 * (src/lib/payments/config.ts) y son los de HOY:
 *   estandar_v2      mensual 249 · semestral 799  · anual 1290
 *   personalizado_v2 mensual 549 · semestral 1990 · anual 3290
 */

/**
 * Las funciones bajo prueba reciben tipos estructurales (Pick de
 * PromoCampaign), no la fila entera. Esta fábrica arma justo esos cuatro
 * campos para que cada caso solo escriba lo que le importa.
 */
function promo(
  campos: Partial<Pick<PromoCampaign, 'planes' | 'ciclos' | 'descuento_tipo' | 'descuento_valor'>>
) {
  return {
    planes: ['estandar_v2'],
    ciclos: ['mensual'],
    descuento_tipo: 'monto' as const,
    descuento_valor: 248,
    ...campos,
  }
}

describe('precioConPromo', () => {
  it('descuento de MONTO: resta el valor del precio de lista', () => {
    const r = precioConPromo(promo({ descuento_tipo: 'monto', descuento_valor: 248 }), 'estandar_v2', 'mensual')

    expect(r).toEqual({ lista: 249, final: 1 })
  })

  it('descuento de PORCENTAJE: conserva los decimales, no redondea a un entero bonito', () => {
    // 50% sobre 249 = 124.5. Se elige ese porcentaje porque en binario da un
    // resultado exacto; con 20% la multiplicación arrastra 199.20000000000002
    // y la aserción mediría IEEE754 en vez de la regla de negocio.
    const r = precioConPromo(promo({ descuento_tipo: 'porcentaje', descuento_valor: 50 }), 'estandar_v2', 'mensual')

    expect(r).toEqual({ lista: 249, final: 124.5 })
    // 🔴 El punto de la prueba: el centavo sobrevive. Un Math.round() aquí
    // haría que la pantalla dijera 125 y Stripe cobrara 124.50.
    expect(Number.isInteger(r!.final)).toBe(false)
  })

  it('descuento de porcentaje que no cae redondo: no se redondea (199.2, con el ruido de coma flotante)', () => {
    const r = precioConPromo(promo({ descuento_tipo: 'porcentaje', descuento_valor: 20 }), 'estandar_v2', 'mensual')

    expect(r!.final).toBeCloseTo(199.2, 10)
    expect(r!.final).not.toBe(199)
  })

  it('descuento MAYOR que la lista: se satura en 0, nunca devuelve un precio negativo', () => {
    const r = precioConPromo(promo({ descuento_tipo: 'monto', descuento_valor: 300 }), 'estandar_v2', 'mensual')

    expect(r).toEqual({ lista: 249, final: 0 })
  })

  it('promo null: devuelve null y la pantalla pinta su precio normal', () => {
    expect(precioConPromo(null, 'estandar_v2', 'mensual')).toBeNull()
  })

  it('plan que no existe en PLAN_DISPLAY: null aunque la campaña lo liste', () => {
    // La campaña SÍ incluye el plan, así que promoAplica pasa. Lo que corta es
    // precioLista, que no encuentra el plan en la tabla de precios.
    const r = precioConPromo(promo({ planes: ['plan_fantasma'] }), 'plan_fantasma', 'mensual')

    expect(r).toBeNull()
  })

  it('ciclo que no existe en PLAN_DISPLAY: null aunque la campaña lo liste', () => {
    const r = precioConPromo(promo({ ciclos: ['trimestral'] }), 'estandar_v2', 'trimestral')

    expect(r).toBeNull()
  })

  it('🔴 ciclo en vocabulario de BASE contra campaña en vocabulario de DISPLAY: null en silencio', () => {
    // promo_campaigns.ciclos guarda 'anual' (vocabulario de PLAN_DISPLAY).
    // Todo lo que viene de Stripe, de la base o de sessionStorage trae
    // 'annual' (vocabulario de la base). Comparar los dos NO da error: da
    // false, y la promoción se apaga sin que nadie se entere.
    //
    // Por eso resolvePromoParaCheckout llama a cicloDisplay() antes de
    // comparar. Esta prueba fija el comportamiento que hace necesaria esa
    // traducción.
    const campaña = promo({ ciclos: ['anual'] })

    expect(precioConPromo(campaña, 'estandar_v2', 'annual')).toBeNull()
    expect(precioConPromo(campaña, 'estandar_v2', 'anual')).toEqual({ lista: 1290, final: 1042 })
  })

  it('descuento_valor que llega como string (numeric de Postgres): la coerción de JS lo salva en ambos tipos', () => {
    // 🔴 precioConPromo NO normaliza. La protección vive una capa antes, en
    // getPromoActiva, que hace Number(fila.descuento_valor) en la puerta de
    // entrada. Esta prueba documenta qué pasa si algo se salta esa puerta:
    // hoy los dos tipos sobreviven por coerción, y por eso el bug sería
    // invisible en producción.
    const comoMonto = precioConPromo(
      promo({ descuento_tipo: 'monto', descuento_valor: '248' as unknown as number }),
      'estandar_v2',
      'mensual'
    )
    expect(comoMonto).toEqual({ lista: 249, final: 1 })

    const comoPorcentaje = precioConPromo(
      promo({ descuento_tipo: 'porcentaje', descuento_valor: '50' as unknown as number }),
      'estandar_v2',
      'mensual'
    )
    expect(comoPorcentaje).toEqual({ lista: 249, final: 124.5 })
  })
})

describe('promoAplica', () => {
  it('plan Y ciclo en la campaña: true', () => {
    expect(promoAplica(promo({ planes: ['estandar_v2'], ciclos: ['mensual'] }), 'estandar_v2', 'mensual')).toBe(true)
  })

  it('plan sí pero ciclo no: false — es el candado que impide aplicar una promo mensual a un anual', () => {
    expect(promoAplica(promo({ planes: ['estandar_v2'], ciclos: ['mensual'] }), 'estandar_v2', 'anual')).toBe(false)
  })

  it('promo null: false', () => {
    expect(promoAplica(null, 'estandar_v2', 'mensual')).toBe(false)
  })
})

describe('leyendaPromo', () => {
  it('MENSUAL: el descuento cubre el "primer mes" y después se cobra la mensualidad', () => {
    const r = leyendaPromo(
      promo({ ciclos: ['mensual'], descuento_tipo: 'monto', descuento_valor: 248 }),
      'estandar_v2',
      'mensual'
    )

    expect(r).toEqual({
      lista: 249,
      final: 1,
      listaTexto: '$249',
      finalTexto: '$1 primer mes',
      despuesTexto: 'después $249/mes',
    })
  })

  it('SEMESTRAL: cubre el "primer pago" y el después se dice en semestres, no en meses', () => {
    const r = leyendaPromo(
      promo({ ciclos: ['semestral'], descuento_tipo: 'monto', descuento_valor: 100 }),
      'estandar_v2',
      'semestral'
    )

    expect(r).toEqual({
      lista: 799,
      final: 699,
      listaTexto: '$799',
      finalTexto: '$699 primer pago',
      despuesTexto: 'después $799 cada 6 meses',
    })
  })

  it('ANUAL: el después se dice "al año", y el monto va con separador de miles', () => {
    const r = leyendaPromo(
      promo({ ciclos: ['anual'], descuento_tipo: 'porcentaje', descuento_valor: 50 }),
      'estandar_v2',
      'anual'
    )

    expect(r).toEqual({
      lista: 1290,
      final: 645,
      listaTexto: '$1,290',
      finalTexto: '$645 primer pago',
      despuesTexto: 'después $1,290 al año',
    })
  })
})
