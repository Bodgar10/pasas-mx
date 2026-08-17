import 'server-only'

/**
 * RESOLUCIÓN DE PROMOCIÓN PARA EL CHECKOUT — SOLO SERVIDOR
 * ---------------------------------------------------------------------------
 * 🔴 EL CLIENTE NUNCA DECIDE UN DESCUENTO. El cliente manda un slug; aquí se
 * decide si aplica y cuánto. Los dos endpoints que abren Checkout Sessions
 * pasan por esta función y por ninguna otra.
 *
 * Vive en su propio archivo y NO dentro de src/lib/promos.ts porque importa
 * @/lib/payments/stripe, que hace `throw` al cargarse si falta
 * STRIPE_SECRET_KEY. `promos.ts` lo importan landing-client, /planes,
 * /bienvenida, usePromo y el cliente de /admin/promociones — todos 'use
 * client' —, así que meter Stripe ahí reventaría el bundle del navegador.
 *
 * El `import 'server-only'` de arriba convierte ese error de runtime en un
 * error de build: si algún día alguien importa esto desde un componente de
 * cliente, no compila. Un import dinámico dentro de la función habría
 * escondido el problema y además arrastrado el SDK de Stripe a un chunk de
 * cliente.
 */

import { stripe } from '@/lib/payments/stripe'
import { cicloDisplay } from '@/lib/payments/config'
import { getPromoActiva, promoAplica, type PromoCampaign } from '@/lib/promos'

/**
 * La fila dice que la campaña está viva y aplica, pero Stripe no reconoce el
 * código.
 *
 * 🔴 Esto NO se puede tragar. El usuario ya vio "$1" en pantalla; abrir el
 * checkout a precio de lista es anunciar un precio y cobrar otro. Los
 * llamadores tienen que cortar la venta y decirlo.
 *
 * Es distinto de que la promo no aplique (ciclo equivocado, campaña apagada):
 * eso devuelve null, es el camino normal sin descuento, y la pantalla tampoco
 * prometió nada porque promoAplica gobierna también la decoración.
 */
export class PromoNoDisponibleError extends Error {
  readonly slug: string

  constructor(slug: string) {
    super(`Promoción "${slug}" activa en la base pero sin promotion code activo en Stripe`)
    this.name = 'PromoNoDisponibleError'
    this.slug = slug
  }
}

/**
 * Resuelve el descuento a aplicar, o null si no hay ninguno.
 *
 * @param slug         Lo que mandó el cliente. Sin validar.
 * @param plan         Clave de PLAN_DISPLAY: 'estandar_v2' | 'personalizado_v2'.
 * @param billingCycle Ciclo en vocabulario de la BASE ('monthly' | 'semestral'
 *                     | 'annual'). La conversión a display ocurre AQUÍ dentro,
 *                     una sola vez, para que ningún llamador pueda equivocarse
 *                     comparando 'annual' contra ['anual'].
 * @param yaTuvoSuscripcion Si esta cuenta tuvo alguna suscripción antes.
 *                     Obligatorio a propósito: no tiene default para que un
 *                     tercer llamador tenga que ir a averiguarlo en vez de
 *                     heredar un `false` cómodo y equivocado.
 *
 * @throws PromoNoDisponibleError si la campaña aplica pero Stripe no tiene el
 *         código.
 */
export async function resolvePromoParaCheckout(
  slug: string | null | undefined,
  plan: string,
  billingCycle: string,
  yaTuvoSuscripcion: boolean
): Promise<{ promotionCodeId: string; promo: PromoCampaign } | null> {
  /**
   * 0. 🔴 CLIENTE QUE VUELVE.
   *
   * El promotion code de la campaña es `first_time_transaction`. Si se
   * mandara igual, Stripe rechazaría el código y se caería la Checkout
   * Session ENTERA: no es que se cobrara de más, es que la persona no podría
   * pagar. Devolver null lo baja al camino normal —allow_promotion_codes y
   * precio de lista—, que es exactamente lo que le toca.
   *
   * Va ANTES de leer la fila: para un cliente que vuelve no hay nada que
   * resolver, gane o no la campaña.
   *
   * Esto NO es la razón de que la pantalla no prometa el descuento. La UI
   * decora por su cuenta; que no prometa se resuelve aparte. Aquí solo se
   * garantiza que el cobro sea correcto pase lo que pase en la pantalla.
   */
  if (yaTuvoSuscripcion) return null

  // 1. La campaña, ya filtrada por activa = true y por fechas.
  const promo = await getPromoActiva(slug ?? null)
  if (!promo) return null

  // 2. 🔴 EL CANDADO CENTRAL, y va ANTES de hablarle a Stripe.
  //
  //    /api/checkout/create-session es público para cualquier usuario
  //    autenticado: un POST a mano con
  //    { plan:'estandar_v2', duration:'annual', promo:'pasas1' }
  //    aplicaría $248 de descuento a un anual de $1,290. La UI no protege
  //    nada — solo decora. Lo que protege es esta línea.
  const ciclo = cicloDisplay(billingCycle)
  if (!promoAplica(promo, plan, ciclo)) return null

  // 3. El código real. Recién ahora se sale a la red.
  //
  //    🔴 Se resuelve el PROMOTION CODE, no el cupón. Las restricciones
  //    —first_time_transaction, max_redemptions, expires_at— viven en el
  //    promotion code; aplicar el cupón directo las saltaría todas y un
  //    cliente viejo podría canjear una promo de primera compra.
  const lista = await stripe.promotionCodes.list({
    code: promo.codigo_visible,
    active: true,
    limit: 1,
  })

  const promotionCode = lista.data[0]
  if (!promotionCode) {
    throw new PromoNoDisponibleError(promo.slug)
  }

  return { promotionCodeId: promotionCode.id, promo }
}

/** Mensaje único para el usuario cuando la promo no se pudo aplicar. */
export const MENSAJE_PROMO_NO_DISPONIBLE =
  'No pudimos aplicar la promoción, inténtalo de nuevo'
