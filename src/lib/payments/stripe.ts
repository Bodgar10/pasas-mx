/**
 * STRIPE CLIENT
 * -------------
 * Singleton Stripe instance for use in API routes (server-side only).
 * To reuse in another project: no changes needed — just copy this file.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY — from Stripe Dashboard → Developers → API keys
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY. Add it to your .env.local and Vercel environment variables.'
  )
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil',
})
