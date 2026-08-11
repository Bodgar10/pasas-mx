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

  // Alta y acceso con Google — apagado en s28.
  // El flujo de OAuth se salta el selector de "quien crea la cuenta" y la
  // validacion de fecha de nacimiento previa al signUp, asi que el gate de
  // menores solo atrapa al usuario DESPUES de que la cuenta ya existe.
  // Mientras eso no se construya, el correo es el unico camino con control
  // completo sobre el alta.
  // Para reactivarlo: NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true en Vercel + redeploy.
  // 🔴 Y habilitar tambien el proveedor en Supabase (Authentication →
  // Providers): el flag solo oculta el boton, no cierra el endpoint.
  ENABLE_GOOGLE_AUTH: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true',
} as const
