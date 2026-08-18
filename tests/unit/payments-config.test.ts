import { describe, it, expect } from 'vitest'
import {
  cicloDisplay,
  precioAsiento,
  formatoMXN,
  PLAN_DISPLAY,
  PRICE_TO_PLAN,
  PLAN_DB_A_STRIPE,
  MAX_SEATS,
  SEAT_DISCOUNT_COUPON,
  type PlanKey,
  type BillingCycleDB,
} from '@/lib/payments/config'

/**
 * U3 — La configuración de pagos.
 *
 * Las pruebas de "contrato" de este archivo afirman los valores que el código
 * tiene HOY. No son una opinión sobre cuáles deberían ser: son una alarma
 * para cuando alguien los cambie sin querer. Si un precio sube a propósito,
 * la prueba falla, se actualiza el número, y ese cambio queda registrado —
 * que es exactamente lo que hoy no pasa.
 */

describe('cicloDisplay — traducción base → display', () => {
  it('traduce los tres ciclos de la base al vocabulario de PLAN_DISPLAY', () => {
    expect(cicloDisplay('monthly')).toBe('mensual')
    expect(cicloDisplay('semestral')).toBe('semestral')
    expect(cicloDisplay('annual')).toBe('anual')
  })

  it('🔴 valor desconocido: cae en "mensual" SIN avisar', () => {
    // Es el comportamiento existente y hay que conocerlo: un ciclo mal escrito
    // no produce error, produce el precio mensual. Con 'trimestral' o con un
    // string vacío, la pantalla pinta $249 tan tranquila.
    expect(cicloDisplay('trimestral')).toBe('mensual')
    expect(cicloDisplay('')).toBe('mensual')
    expect(cicloDisplay('ANNUAL')).toBe('mensual')
  })
})

describe('precioAsiento', () => {
  it('es exactamente la mitad del precio de lista, con centavos', () => {
    // 🔴 249/2 = 124.5, y el .5 es intencional: el cupón SEAT_50 descuenta 50%
    // real sobre el precio de lista, así que el cargo trae centavos.
    // Redondear a 125 haría que la pantalla anuncie un número distinto al que
    // se cobra.
    expect(precioAsiento('estandar_v2', 'monthly')).toBe(124.5)
    expect(precioAsiento('estandar_v2', 'semestral')).toBe(399.5)
    expect(precioAsiento('estandar_v2', 'annual')).toBe(645)
    expect(precioAsiento('personalizado_v2', 'monthly')).toBe(274.5)
  })

  it('plan que no existe en PLAN_DISPLAY: devuelve 0', () => {
    // El caso real es 'exam': está en el enum plan_type de la base pero no
    // tiene price en STRIPE_PRICES, así que un titular con ese plan no puede
    // comprar asientos.
    expect(precioAsiento('exam' as PlanKey, 'monthly')).toBe(0)
  })

  it('ciclo que no existe: devuelve 0', () => {
    expect(precioAsiento('estandar_v2', 'trimestral' as BillingCycleDB)).toBe(0)
  })
})

describe('formatoMXN', () => {
  it('entero: sin decimales', () => {
    expect(formatoMXN(249)).toBe('249')
    expect(formatoMXN(0)).toBe('0')
  })

  it('con centavos: dos decimales', () => {
    expect(formatoMXN(124.5)).toBe('124.50')
    expect(formatoMXN(399.5)).toBe('399.50')
  })

  it('millares: separador de es-MX', () => {
    expect(formatoMXN(1290)).toBe('1,290')
    expect(formatoMXN(3290)).toBe('3,290')
  })
})

describe('CONTRATO · PLAN_DISPLAY', () => {
  it('los seis pares plan × ciclo existen con los montos de hoy', () => {
    expect(PLAN_DISPLAY.estandar_v2.prices.mensual.amount).toBe(249)
    expect(PLAN_DISPLAY.estandar_v2.prices.semestral.amount).toBe(799)
    expect(PLAN_DISPLAY.estandar_v2.prices.anual.amount).toBe(1290)

    expect(PLAN_DISPLAY.personalizado_v2.prices.mensual.amount).toBe(549)
    expect(PLAN_DISPLAY.personalizado_v2.prices.semestral.amount).toBe(1990)
    expect(PLAN_DISPLAY.personalizado_v2.prices.anual.amount).toBe(3290)
  })

  it('solo hay dos planes, y sus claves de ciclo son las de DISPLAY', () => {
    expect(Object.keys(PLAN_DISPLAY)).toEqual(['estandar_v2', 'personalizado_v2'])
    expect(Object.keys(PLAN_DISPLAY.estandar_v2.prices)).toEqual(['mensual', 'semestral', 'anual'])
  })
})

describe('CONTRATO · PRICE_TO_PLAN', () => {
  it('los seis price IDs mapean a su plan y ciclo de la BASE', () => {
    // Los ids vienen de .env.test. Lo que importa no son las cadenas sino que
    // haya SEIS entradas distintas y que cada una traiga el par correcto: es
    // la tabla con la que el webhook decide qué escribir en subscriptions, y
    // un `duration` equivocado manda el aviso de renovación de la LFPC con el
    // ciclo y el monto de otro plan.
    expect(Object.keys(PRICE_TO_PLAN)).toHaveLength(6)

    expect(PRICE_TO_PLAN['price_test_grade_monthly']).toEqual({ plan: 'grade', duration: 'monthly' })
    expect(PRICE_TO_PLAN['price_test_grade_semestral']).toEqual({ plan: 'grade', duration: 'semestral' })
    expect(PRICE_TO_PLAN['price_test_grade_annual']).toEqual({ plan: 'grade', duration: 'annual' })
    expect(PRICE_TO_PLAN['price_test_personalizado_monthly']).toEqual({ plan: 'ai_personalized', duration: 'monthly' })
    expect(PRICE_TO_PLAN['price_test_personalizado_semestral']).toEqual({ plan: 'ai_personalized', duration: 'semestral' })
    expect(PRICE_TO_PLAN['price_test_personalizado_annual']).toEqual({ plan: 'ai_personalized', duration: 'annual' })
  })

  it('price desconocido: undefined — el webhook cae a su default grade/monthly', () => {
    expect(PRICE_TO_PLAN['price_que_no_existe']).toBeUndefined()
  })

  it('los planes que emite son los del enum plan_type de la base, no las claves de PLAN_DISPLAY', () => {
    const planes = new Set(Object.values(PRICE_TO_PLAN).map((v) => v.plan))

    expect(planes).toEqual(new Set(['grade', 'ai_personalized']))
  })
})

describe('CONTRATO · PLAN_DB_A_STRIPE y constantes de asientos', () => {
  it('traduce los dos planes vendibles y NO incluye exam', () => {
    expect(PLAN_DB_A_STRIPE).toEqual({ grade: 'estandar_v2', ai_personalized: 'personalizado_v2' })
    expect(PLAN_DB_A_STRIPE['exam']).toBeUndefined()
  })

  it('el tope de asientos es 3 y el cupón oculto se llama SEAT_50', () => {
    // SEAT_DISCOUNT_COUPON está escrito literal en el código, así que tiene
    // que existir con ESE id exacto en la cuenta de Stripe contra la que se
    // corra. Fijarlo aquí hace visible esa dependencia.
    expect(MAX_SEATS).toBe(3)
    expect(SEAT_DISCOUNT_COUPON).toBe('SEAT_50')
  })
})
