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

  // Bloque "Así se ve por dentro" de la landing — apagado en s31.
  //
  // Las capturas que muestra traen marcas de terceros dentro de la propia
  // imagen (Genshin Impact en la de videojuegos, SEVENTEEN en la de K-pop).
  // La landing es material promocional público, así que ahí eso es uso
  // comercial de marca ajena — y hay una solicitud de marca propia en curso
  // ante el IMPI.
  //
  // 🔴 El componente, las pestañas y los PNG de public/screenshots/ NO se
  // borraron: solo dejan de renderizarse. Un precio o un texto se corrigen con
  // un deploy; una marca quemada dentro de un PNG no, y por eso el material
  // tiene que reemplazarse antes de volver a encenderlo.
  //
  // Para reactivarlo: sustituir las 8 capturas por otras con temas propios
  // (sin marcas visibles en el contenido de la lección) y poner
  // NEXT_PUBLIC_ENABLE_LANDING_SCREENSHOTS=true en Vercel + redeploy.
  ENABLE_LANDING_SCREENSHOTS: process.env.NEXT_PUBLIC_ENABLE_LANDING_SCREENSHOTS === 'true',

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
