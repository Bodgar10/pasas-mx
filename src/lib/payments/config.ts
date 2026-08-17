/**
 * PAYMENTS CONFIG
 * ---------------
 * Single source of truth for Stripe price IDs and plan configuration.
 * To reuse in another project:
 *   1. Replace STRIPE_PRICES with your own price IDs
 *   2. Update PRICE_TO_PLAN to map your price IDs to your plan names
 *   3. Update DURATION_MONTHS if you have different billing periods
 */

// ---------------------------------------------------------------------------
// PRICE IDs — Replace these with your own Stripe price IDs
// ---------------------------------------------------------------------------
export const STRIPE_PRICES = {
  estandar_v2: {
    monthly:   process.env.STRIPE_PRICE_GRADE_MONTHLY_V2!,
    semestral: process.env.STRIPE_PRICE_GRADE_SEMESTRAL!,
    annual:    process.env.STRIPE_PRICE_GRADE_ANNUAL!,
  },
  personalizado_v2: {
    monthly:   process.env.STRIPE_PRICE_PERSONALIZADO_MONTHLY_V2!,
    semestral: process.env.STRIPE_PRICE_PERSONALIZADO_SEMESTRAL!,
    annual:    process.env.STRIPE_PRICE_PERSONALIZADO_ANNUAL!,
  },
} as const

/**
 * Prices exclusivos de los Lugares Adicionales.
 *
 * 🔴 Existen porque Stripe rechaza dos subscription items con el mismo
 * price en una misma suscripcion: "A new item with Price X can't be
 * added because an existing Subscription Item is already using that
 * Price". El asiento no puede reusar el price del titular.
 *
 * Los MONTOS son identicos a los de lista. El 50% lo sigue poniendo el
 * cupon SEAT_50, asi que `precioAsiento` no cambia y no hay un numero
 * nuevo que pueda desincronizarse de lo que anuncia la pantalla.
 *
 * NO entran en PRICE_TO_PLAN: esa tabla la usa el webhook para decidir
 * que plan guardar en `subscriptions`, y un asiento no crea suscripcion.
 */
export const STRIPE_SEAT_PRICES = {
  monthly:   process.env.STRIPE_PRICE_SEAT_MONTHLY!,
  semestral: process.env.STRIPE_PRICE_SEAT_SEMESTRAL!,
  annual:    process.env.STRIPE_PRICE_SEAT_ANNUAL!,
} as const

export type PlanKey = keyof typeof STRIPE_PRICES
export type DurationKey = keyof typeof STRIPE_PRICES.estandar_v2

// ---------------------------------------------------------------------------
// PRICE → PLAN MAP
// Maps each Stripe price ID to your internal plan name and duration.
// Used by the webhook handler to know what to store in the DB.
// ---------------------------------------------------------------------------
export const PRICE_TO_PLAN: Record<string, { plan: string; duration: string }> = {
  [process.env.STRIPE_PRICE_GRADE_MONTHLY_V2!]:        { plan: 'grade',           duration: 'monthly'   },
  [process.env.STRIPE_PRICE_GRADE_SEMESTRAL!]:          { plan: 'grade',           duration: 'semestral' },
  [process.env.STRIPE_PRICE_GRADE_ANNUAL!]:             { plan: 'grade',           duration: 'annual'    },
  [process.env.STRIPE_PRICE_PERSONALIZADO_MONTHLY_V2!]: { plan: 'ai_personalized', duration: 'monthly'   },
  [process.env.STRIPE_PRICE_PERSONALIZADO_SEMESTRAL!]:  { plan: 'ai_personalized', duration: 'semestral' },
  [process.env.STRIPE_PRICE_PERSONALIZADO_ANNUAL!]:     { plan: 'ai_personalized', duration: 'annual'    },
}

// ---------------------------------------------------------------------------
// CICLO → ETIQUETA — FUENTE ÚNICA
// Las claves son los valores del enum billing_cycle de la base y los que
// produce PRICE_TO_PLAN. Estaba copiado a mano en el cron de PROFECO y en el
// recibo de pago; al añadir el correo de bienvenida iba a ser la tercera copia.
// ---------------------------------------------------------------------------
export const CICLO_LABEL: Record<string, string> = {
  monthly:   'Mensual',
  semestral: 'Semestral',
  annual:    'Anual',
}

// ---------------------------------------------------------------------------
// DURATION IN MONTHS
// Used to calculate period_end for one-time payments if needed.
// ---------------------------------------------------------------------------
export const DURATION_MONTHS: Record<string, number> = {
  monthly:   1,
  semestral: 6,
  annual:    12,
}

// ---------------------------------------------------------------------------
// PLAN DISPLAY — Fuente de verdad de precios para UI.
// ---------------------------------------------------------------------------
export const PLAN_DISPLAY = {
  estandar_v2: {
    label: 'Estándar',
    badge: 'Curso por Grado — Todas las materias',
    badgeColor: '#06b6d4',
    badgeBg: '#06b6d420',
    badgeBorder: '#06b6d440',
    ctaColor: '#7c3aed',
    prices: {
      mensual:   { amount: 249,  total: 249,  savings: null, perMonth: 249 },
      semestral: { amount: 799,  total: 799,  savings: 695,  perMonth: 133 },
      anual:     { amount: 1290, total: 1290, savings: 1698, perMonth: 108 },
    },
  },
  personalizado_v2: {
    label: 'Personalizado',
    badge: 'Guías Únicas con IA — Adaptado a tu hijo',
    badgeColor: '#ec4899',
    badgeBg: '#ec489920',
    badgeBorder: '#ec489940',
    ctaColor: '#ec4899',
    prices: {
      mensual:   { amount: 549,  total: 549,  savings: null, perMonth: 549  },
      semestral: { amount: 1990, total: 1990, savings: 1304, perMonth: 332  },
      anual:     { amount: 3290, total: 3290, savings: 3298, perMonth: 274  },
    },
  },
} as const

// ---------------------------------------------------------------------------
// CHECKOUT CONFIG
// URLs and settings used when creating Stripe Checkout sessions.
// Change SUCCESS_PATH and CANCEL_PATH per project as needed.
// ---------------------------------------------------------------------------
export const CHECKOUT_CONFIG = {
  successPath: '/dashboard?checkout=success',
  cancelPath:  '/planes',
  paymentMethods: ['card'] as const,
  mode: 'subscription' as const,
}

// ---------------------------------------------------------------------------
// ASIENTOS ADICIONALES
// Una cuenta puede tener mas de una persona estudiando. Cada persona
// adicional cuesta la mitad del precio de lista de su plan.
// ---------------------------------------------------------------------------

/**
 * Cupon OCULTO en Stripe. 50% off, duration: forever, sin promotion code.
 * Nadie puede teclearlo en un checkout: solo lo aplica el servidor en el
 * line item del asiento.
 *
 * `forever` es a proposito. Con `once` el asiento subiria a precio de
 * lista en la primera renovacion, y anunciar un precio permanente que
 * despues sube es materia de PROFECO.
 */
export const SEAT_DISCOUNT_COUPON = 'SEAT_50'

/** Tope por cuenta. Mas de tres y un grupo de familias comparte un login. */
export const MAX_SEATS = 3

/**
 * Unico punto de traduccion entre los dos vocabularios de ciclo.
 *
 * La base y STRIPE_PRICES usan monthly | semestral | annual.
 * PLAN_DISPLAY.prices usa mensual | semestral | anual.
 *
 * Los llamadores SIEMPRE pasan el de la base. Nadie fuera de este
 * archivo deberia escribir 'mensual' ni 'anual'.
 */
const CICLO_A_DISPLAY = {
  monthly:   'mensual',
  semestral: 'semestral',
  annual:    'anual',
} as const

export type BillingCycleDB = keyof typeof CICLO_A_DISPLAY
export type CicloDisplay = (typeof CICLO_A_DISPLAY)[BillingCycleDB]

/**
 * ÚNICA traducción base → display. Antes vivía solo aquí y era privada, así
 * que /bienvenida se había hecho su propio mapa local (DURATION_CYCLE) con
 * los mismos tres pares. Dos mapas para lo mismo es cómo un ciclo acaba
 * traduciéndose bien en una pantalla y mal en otra.
 *
 * 🔴 Importa porque `promo_campaigns.ciclos` guarda el vocabulario de DISPLAY
 * y todo lo que venga de Stripe, de la base o de sessionStorage trae el de la
 * base. Comparar 'annual' contra ['anual'] no falla: devuelve false y la
 * promoción se apaga en silencio.
 *
 * El default 'mensual' conserva el comportamiento que ya tenían los
 * llamadores (`?? 'mensual'`).
 */
export function cicloDisplay(billingCycle: string): CicloDisplay {
  return CICLO_A_DISPLAY[billingCycle as BillingCycleDB] ?? 'mensual'
}

/**
 * Precio de un asiento adicional: exactamente la mitad del precio de
 * lista de ese plan y ese ciclo.
 *
 * 🔴 Devuelve DECIMALES a proposito: 124.5, 399.5, 645.
 * El cupon de Stripe descuenta 50% real sobre el precio de lista, asi
 * que el cargo trae centavos. Redondear a un entero "bonito" haria que
 * la pantalla anuncie un numero distinto al que se cobra — que es
 * justo el problema de PROFECO que ya costo dos correcciones.
 *
 * 🔴 El asiento SIEMPRE hereda plan y ciclo del titular, sin opcion.
 * Si alguien con plan mensual pudiera agregar un asiento anual al 50%,
 * compraria el mensual de $249, agregaria tres asientos anuales
 * baratos y cancelaria el mensual al mes siguiente: se quedaria con
 * tres accesos anuales sin el asiento de precio completo que justifica
 * el descuento. Ademas evita dos fechas de renovacion en la misma
 * suscripcion.
 */
export function precioAsiento(plan: PlanKey, billingCycle: BillingCycleDB): number {
  const claveDisplay = CICLO_A_DISPLAY[billingCycle]
  const lista = PLAN_DISPLAY[plan]?.prices?.[claveDisplay]?.amount
  if (lista == null) return 0
  return lista / 2
}

/** Formato de moneda para pantalla. Muestra centavos solo si los hay. */
/**
 * subscriptions.plan guarda el enum plan_type de la base (grade,
 * ai_personalized, exam); STRIPE_PRICES y PLAN_DISPLAY se llavean por
 * producto. PRICE_TO_PLAN solo traduce en el otro sentido.
 *
 * 'exam' no aparece a proposito: no tiene price en STRIPE_PRICES. Un
 * titular con ese plan no puede comprar asientos.
 */
export const PLAN_DB_A_STRIPE: Record<string, PlanKey> = {
  grade:           'estandar_v2',
  ai_personalized: 'personalizado_v2',
}

export function formatoMXN(monto: number): string {
  const tieneCentavos = monto % 1 !== 0
  return monto.toLocaleString('es-MX', {
    minimumFractionDigits: tieneCentavos ? 2 : 0,
    maximumFractionDigits: 2,
  })
}
