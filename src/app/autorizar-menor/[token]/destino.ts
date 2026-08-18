/**
 * Destino ÚNICO tras autorizar: /bienvenida, siempre.
 *
 * 🔴 VIVE EN SU PROPIO MÓDULO PORQUE LO USAN DOS SITIOS.
 *
 * `actions.ts` es `'use server'`, y de un módulo así solo se pueden exportar
 * funciones async que sean server actions: si esto viviera ahí, `page.tsx` no
 * podría importarlo. Los dos lo necesitan y tienen que coincidir — si el
 * formulario y la página mandaran a sitios distintos, un reenvío llevaría a un
 * lugar y una recarga a otro.
 *
 * `pending_checkout` decide qué lleva la URL, NUNCA si se redirige o no. Sin
 * plan, /bienvenida cae en sus valores por defecto (estandar_v2 / monthly) y la
 * persona puede cambiarlo desde ahí.
 */
export type CheckoutPendiente = {
  plan?: string
  duration?: string
  promo_slug?: string | null
} | null

export function destinoBienvenida(checkout: CheckoutPendiente): string {
  if (!checkout?.plan || !checkout?.duration) return '/bienvenida'

  // 🔴 Mismo transporte que en auth/callback: sin `&promo` el slug muere aquí.
  // Este camino es todavía más frágil que el otro —el tutor pudo abrir el
  // enlace en otro navegador—, así que sessionStorage no es siquiera una
  // opción de respaldo.
  const promoParam = checkout.promo_slug
    ? `&promo=${encodeURIComponent(checkout.promo_slug)}`
    : ''

  return `/bienvenida?plan=${encodeURIComponent(checkout.plan)}&duration=${encodeURIComponent(checkout.duration)}${promoParam}`
}
