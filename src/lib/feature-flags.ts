/**
 * Feature flags — controlled via Vercel environment variables.
 * To enable a flag: set the env var to 'true' in Vercel and redeploy.
 * To disable a flag: set the env var to 'false' or remove it and redeploy.
 */

export const FEATURE_FLAGS = {
  // Exam plans (COMIPEMS, UNAM, IPN) — launching January 2027
  ENABLE_EXAM_PLANS: process.env.NEXT_PUBLIC_ENABLE_EXAM_PLANS === 'true',

  // Plan Personalizado — oculto de la venta desde ago 2026.
  // NO se borró: PLAN_DISPLAY, STRIPE_PRICES y PRICE_TO_PLAN siguen
  // intactos para no romper suscripciones existentes ni el webhook.
  // Para reactivarlo: NEXT_PUBLIC_ENABLE_PERSONALIZED_PLAN=true en Vercel + redeploy.
  ENABLE_PERSONALIZED_PLAN: process.env.NEXT_PUBLIC_ENABLE_PERSONALIZED_PLAN === 'true',
} as const
