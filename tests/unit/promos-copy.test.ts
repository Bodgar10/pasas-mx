import { describe, it, expect } from 'vitest'
import { copyCTA, microcopyPromo, conPromo, etiquetaDescuento } from '@/lib/promos'

/**
 * U2 — El copy de la promoción: qué dice el botón y qué promesas lo acompañan.
 *
 * Menos crítico que U1 en pesos, pero no en confianza: "Sin tarjeta" fue una
 * mentira que ya costó una corrección, y microcopyPromo existe justo para que
 * "Requiere tarjeta" y "Cancela cuando quieras" no se pierdan nunca, venga la
 * campaña que venga.
 */

describe('copyCTA', () => {
  it('promo que aplica: manda el copy de la campaña', () => {
    const promo = {
      planes: ['estandar_v2'],
      ciclos: ['mensual'],
      cta_label: 'Empieza por $1',
      cta_sublabel: 'Solo esta semana',
    }

    expect(copyCTA(promo, 'estandar_v2', 'mensual', { label: 'Empieza ahora', sublabel: null })).toEqual({
      label: 'Empieza por $1',
      sublabel: 'Solo esta semana',
    })
  })

  it('promo que NO aplica al ciclo: devuelve el fallback tal cual', () => {
    // Mismo objeto que arriba, pero pidiendo el anual. La campaña solo cubre
    // mensual, así que el botón tiene que decir lo de siempre — si dijera el
    // copy de la promo, prometería un descuento que el checkout no va a
    // aplicar.
    const promo = {
      planes: ['estandar_v2'],
      ciclos: ['mensual'],
      cta_label: 'Empieza por $1',
      cta_sublabel: 'Solo esta semana',
    }
    const fallback = { label: 'Empieza ahora', sublabel: 'Requiere tarjeta' }

    expect(copyCTA(promo, 'estandar_v2', 'anual', fallback)).toEqual(fallback)
  })

  it('promo null: devuelve el fallback', () => {
    const fallback = { label: 'Empieza ahora', sublabel: null }

    expect(copyCTA(null, 'estandar_v2', 'mensual', fallback)).toEqual(fallback)
  })
})

describe('microcopyPromo', () => {
  const OBLIGATORIAS = ['Requiere tarjeta', 'Cancela cuando quieras']

  it('sublabel null: pega las dos promesas obligatorias', () => {
    expect(microcopyPromo(null, OBLIGATORIAS)).toBe('Requiere tarjeta · Cancela cuando quieras')
  })

  it('la promesa ya viene como segmento propio: no se duplica', () => {
    expect(microcopyPromo('Cancela cuando quieras', ['Cancela cuando quieras'])).toBe('Cancela cuando quieras')
  })

  it('🔴 REGRESIÓN: promesa PEGADA a la frase anterior sin separador, se despega en su propio segmento', () => {
    // El bug real: la comprobación era `base.includes(frase)`, así que con un
    // sublabel capturado desde /admin como
    //   "Tus primeros 7 días son gratis.Cancela cuando quieras"
    // la frase SÍ aparecía como subcadena, se daba por puesta, y el texto
    // quedaba pegado en pantalla. Ahora se parte por el índice y el join le
    // pone su separador como a cualquier otro segmento.
    const resultado = microcopyPromo('Tus primeros 7 días son gratis.Cancela cuando quieras', [
      'Cancela cuando quieras',
    ])

    expect(resultado).toBe('Tus primeros 7 días son gratis. · Cancela cuando quieras')
  })

  it('las dos promesas ya presentes como segmentos: el texto no cambia ni crece', () => {
    const yaCompleto = 'Requiere tarjeta · Cancela cuando quieras'

    expect(microcopyPromo(yaCompleto, OBLIGATORIAS)).toBe(yaCompleto)
    expect(microcopyPromo(yaCompleto, OBLIGATORIAS).split('·')).toHaveLength(2)
  })
})

describe('conPromo', () => {
  it('destino que ya trae query: agrega el promo conservando lo que había', () => {
    expect(conPromo('/planes?plan=estandar_v2', 'pasas1')).toBe('/planes?plan=estandar_v2&promo=pasas1')
  })

  it('slug vacío: devuelve el destino intacto, sin un "?promo=" hueco que viaje a analítica', () => {
    expect(conPromo('/planes', '')).toBe('/planes')
    expect(conPromo('/planes', null)).toBe('/planes')
    expect(conPromo('/planes', undefined)).toBe('/planes')
  })

  it('slug en mayúsculas y con espacios: se normaliza a minúsculas, que es como vive en la base', () => {
    // promo_campaigns.slug es la PK y está en minúsculas. Un '?promo=PASAS1'
    // no encontraría la fila y la campaña se apagaría en silencio.
    expect(conPromo('/registro', '  PASAS1  ')).toBe('/registro?promo=pasas1')
  })
})

describe('etiquetaDescuento', () => {
  it('monto: lo pinta en pesos', () => {
    expect(etiquetaDescuento({ descuento_tipo: 'monto', descuento_valor: 248 })).toBe('$248 de descuento')
  })

  it('porcentaje: lo pinta con signo de porcentaje', () => {
    expect(etiquetaDescuento({ descuento_tipo: 'porcentaje', descuento_valor: 20 })).toBe('20% de descuento')
  })
})
