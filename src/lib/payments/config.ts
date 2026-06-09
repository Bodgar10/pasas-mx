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
