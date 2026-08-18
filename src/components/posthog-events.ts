/**
 * ⛔ CONGELADO — s32. No agregar eventos aquí.
 *
 * El camino nuevo es `track()` de `src/lib/analytics/track.ts`: un solo
 * punto de entrada que manda a PostHog, GA4, Meta y TikTok con las mismas
 * propiedades, el mismo id de usuario y el mismo `event_id`. Estos helpers
 * solo llegan a PostHog y no llevan ninguna propiedad automática.
 *
 * Los 13 eventos de abajo siguen funcionando y NO se migran en bloque: cada
 * uno se reemplaza por su equivalente en `track()` cuando se reinstrumente
 * su pantalla, en su propio prompt. Una migración masiva de analítica es
 * imposible de verificar — se descubre rota semanas después, cuando alguien
 * mira un embudo vacío.
 *
 * Dos de estos ya están muertos y nadie los importa: `onboarding_completed`
 * y `streak_milestone`.
 */

import posthog from 'posthog-js'

// Auth events
export const trackSignup = (method: 'email' | 'google') =>
  posthog.capture('signup', { method })

export const trackLogin = (method: 'email' | 'google') =>
  posthog.capture('login', { method })

// Onboarding events
export const trackOnboardingCompleted = (level: string, grade: string | null, theme: string) =>
  posthog.capture('onboarding_completed', { level, grade, theme })

// Checkout events
export const trackCheckoutStarted = (plan: string, duration: string) =>
  posthog.capture('checkout_started', { plan, duration })

/**
 * Se dispara junto a checkout_started, solo cuando hay una campaña que aplica
 * a ese plan y ciclo.
 *
 * `ciclo` va en vocabulario de DISPLAY (mensual | semestral | anual), el mismo
 * que guarda promo_campaigns.ciclos, para que el embudo se pueda cruzar contra
 * la campaña sin traducir nada. `duration` de checkout_started usa el de la
 * base: son eventos distintos y no se comparan entre sí.
 */
export const trackPromoCheckoutIniciado = (promoSlug: string, plan: string, ciclo: string) =>
  posthog.capture('promo_checkout_iniciado', { promo_slug: promoSlug, plan, ciclo })

export const trackCheckoutCompleted = (plan: string, price_mxn: number) =>
  posthog.capture('checkout_completed', { plan, price_mxn })

// Learning events
export const trackTopicStarted = (topicName: string, subjectName: string, themeName: string) =>
  posthog.capture('topic_started', { topic_name: topicName, subject_name: subjectName, theme_name: themeName })

export const trackTopicCompleted = (topicName: string, subjectName: string, score: number, isPerfect: boolean) =>
  posthog.capture('topic_completed', { topic_name: topicName, subject_name: subjectName, score, is_perfect: isPerfect })

export const trackQuizAnswered = (topicName: string, isCorrect: boolean, difficulty: number) =>
  posthog.capture('quiz_answered', { topic_name: topicName, is_correct: isCorrect, difficulty })

// Personalized plan events
export const trackDiagnosticCompleted = (subjectName: string, weakCount: number, strongCount: number) =>
  posthog.capture('diagnostic_completed', { subject_name: subjectName, weak_topics: weakCount, strong_topics: strongCount })

export const trackPersonalizedPlanGenerated = (subjectName: string, topicCount: number, themeName: string) =>
  posthog.capture('personalized_plan_generated', { subject_name: subjectName, topic_count: topicCount, theme_name: themeName })

// Error events
export const trackError = (errorType: string, errorMessage: string, context?: string) =>
  posthog.capture('error_occurred', { error_type: errorType, error_message: errorMessage, context })

// Streak events
export const trackStreakMilestone = (days: number) =>
  posthog.capture('streak_milestone', { days })
