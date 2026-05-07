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
  estandar: {
    monthly:  'price_1TUTXmC61EHnoMUsCTw1FOcH',
    quarterly: 'price_1TUThlC61EHnoMUsOEZRxQ0L',
    biannual:  'price_1TUTiIC61EHnoMUszAZ1DXQw',
  },
  personalizado: {
    monthly:  'price_1TUTijC61EHnoMUsaksUSfwR',
    quarterly: 'price_1TUTj5C61EHnoMUsohVLpLFn',
    biannual:  'price_1TUTjTC61EHnoMUsvwLZnk4q',
  },
} as const

export type PlanKey = keyof typeof STRIPE_PRICES
export type DurationKey = keyof typeof STRIPE_PRICES.estandar

// ---------------------------------------------------------------------------
// PRICE → PLAN MAP
// Maps each Stripe price ID to your internal plan name and duration.
// Used by the webhook handler to know what to store in the DB.
// ---------------------------------------------------------------------------
export const PRICE_TO_PLAN: Record<string, { plan: string; duration: string }> = {
  'price_1TUTXmC61EHnoMUsCTw1FOcH': { plan: 'grade',          duration: 'monthly'   },
  'price_1TUThlC61EHnoMUsOEZRxQ0L': { plan: 'grade',          duration: 'quarterly' },
  'price_1TUTiIC61EHnoMUszAZ1DXQw': { plan: 'grade',          duration: 'biannual'  },
  'price_1TUTijC61EHnoMUsaksUSfwR': { plan: 'ai_personalized', duration: 'monthly'   },
  'price_1TUTj5C61EHnoMUsohVLpLFn': { plan: 'ai_personalized', duration: 'quarterly' },
  'price_1TUTjTC61EHnoMUsvwLZnk4q': { plan: 'ai_personalized', duration: 'biannual'  },
}

// ---------------------------------------------------------------------------
// DURATION IN MONTHS
// Used to calculate period_end for one-time payments if needed.
// ---------------------------------------------------------------------------
export const DURATION_MONTHS: Record<string, number> = {
  monthly:   1,
  quarterly: 3,
  biannual:  6,
}

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
