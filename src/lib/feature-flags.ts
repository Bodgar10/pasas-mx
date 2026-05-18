/**
 * Feature flags — controlled via Vercel environment variables.
 * To enable a flag: set the env var to 'true' in Vercel and redeploy.
 * To disable a flag: set the env var to 'false' or remove it and redeploy.
 */

export const FEATURE_FLAGS = {
  // Exam plans (COMIPEMS, UNAM, IPN) — launching January 2027
  ENABLE_EXAM_PLANS: process.env.NEXT_PUBLIC_ENABLE_EXAM_PLANS === 'true',
} as const
