import type { AcquisitionSource } from '@/lib/audience-detection'

/**
 * FUENTE ÚNICA del objeto `metadata` de las Checkout Sessions.
 *
 * 🔴 Las DOS puertas de checkout lo usan: /api/checkout/create-session y
 * el alta con plan pendiente de registro/actions.ts. Antes cada una armaba
 * el suyo y ya se habían desincronizado — a la de registro le faltaba
 * `duration`, así que la mitad de los pagos llegaba a Stripe sin ciclo.
 * Dos objetos separados no se mantienen iguales: se separan y nadie se
 * entera hasta que falta la mitad de los datos en un análisis.
 *
 * ── LÍMITES DE STRIPE ─────────────────────────────────────────────────
 *
 * Consultados en https://docs.stripe.com/api/metadata el 17-ago-2026:
 *
 *   "You can specify up to 50 keys, with key names up to 40 characters
 *    long and values up to 500 characters long."
 *
 * NO están codificados en los tipos del SDK — `MetadataParam` es un index
 * signature abierto (`{ [name: string]: string | number | null }`), así
 * que TypeScript no frena nada y el error llega en runtime desde la API.
 * Por eso el recorte se hace aquí, a mano.
 *
 * Con 8 claves de atribución más 4 propias vamos muy por debajo de 50, y
 * ninguna clave se acerca a 40 caracteres. El único riesgo real es el
 * largo del VALOR de `landing_url`, que es una URL completa con query.
 */

const LIMITE_VALOR = 500
const LIMITE_CLAVES = 50

/**
 * Orden de descarte cuando no cabe todo. Se tira desde el FINAL.
 *
 * Refleja qué se pierde primero si hay que elegir: sin `utm_source` no hay
 * canal y el resto no significa nada; `landing_url` y `referrer` son
 * contexto que casi siempre se puede reconstruir.
 */
const PRIORIDAD = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'promo_slug',
  'utm_content',
  'utm_term',
  'referrer',
  'landing_url',
] as const

/**
 * Recorta una URL conservando origen y path, y tirando el query string.
 *
 * No se pierde nada útil: los parámetros de campaña ya viajan desglosados
 * en los cinco `utm_*`. Si aun así no cabe (un path absurdamente largo),
 * se corta en seco.
 */
function acortarUrl(url: string): string {
  if (url.length <= LIMITE_VALOR) return url
  try {
    const u = new URL(url)
    const sinQuery = `${u.origin}${u.pathname}`
    return sinQuery.length <= LIMITE_VALOR ? sinQuery : sinQuery.slice(0, LIMITE_VALOR)
  } catch {
    // No era una URL válida. Se trata como texto cualquiera.
    return url.slice(0, LIMITE_VALOR)
  }
}

export type MetadataCheckout = Record<string, string>

/**
 * Construye la metadata que va TANTO en la Checkout Session como en
 * `subscription_data.metadata`. El webhook lee `user_id` de la sesión y
 * `promo_slug` y el bloque de canal de la suscripción, así que los dos
 * objetos tienen que ser el mismo.
 *
 * Ninguna clave se emite vacía: una propiedad ausente se lee como "no
 * había dato", y un `''` como "el dato es vacío", que es falso.
 */
export function construirMetadataCheckout(params: {
  userId: string
  plan: string
  duration: string
  promoSlug?: string | null
  acquisition?: AcquisitionSource | null
  /**
   * 🔴 EL PUENTE ENTRE EL CLIENTE Y EL COBRO.
   *
   * Lo genera el navegador ANTES de pedir la sesión y lo manda en el mismo
   * `event_id` de `checkout_iniciado`. Stripe lo devuelve en la metadata y
   * el webhook lo pone en `pago_exitoso`.
   *
   * Sin esto, "cuántos checkouts abiertos acaban en cobro" solo se puede
   * responder por usuario, y eso miente en cuanto alguien abre el checkout
   * dos veces o lo abandona y vuelve al día siguiente: los dos intentos se
   * colapsan en una sola persona y el abandono desaparece del embudo.
   *
   * 36 caracteres de los 500 que permite Stripe por valor.
   */
  checkoutEventId?: string | null
}): MetadataCheckout {
  const { userId, plan, duration, promoSlug, acquisition, checkoutEventId } = params

  // Campos propios del pedido. NO entran en el descarte por prioridad: sin
  // `user_id` el webhook no puede escribir la suscripción de nadie, y sin
  // `checkout_event_id` el embudo pierde el enlace con el clic que lo abrió.
  const base: MetadataCheckout = { user_id: userId, plan, duration }
  if (checkoutEventId) base.checkout_event_id = checkoutEventId

  const candidatos: Record<string, string | undefined> = {
    utm_source: acquisition?.utm_source,
    utm_medium: acquisition?.utm_medium,
    utm_campaign: acquisition?.utm_campaign,
    utm_content: acquisition?.utm_content,
    utm_term: acquisition?.utm_term,
    referrer: acquisition?.referrer,
    landing_url: acquisition?.landing_url ? acortarUrl(acquisition.landing_url) : undefined,
    promo_slug: promoSlug ?? undefined,
  }

  const atribucion: MetadataCheckout = {}
  for (const clave of PRIORIDAD) {
    const valor = candidatos[clave]
    if (valor === undefined || valor === null || valor === '') continue

    const recortado = valor.length > LIMITE_VALOR ? valor.slice(0, LIMITE_VALOR) : valor

    // Tope de claves. En la práctica no se alcanza —12 como mucho— pero si
    // algún día alguien añade campos, esto tira los de menor prioridad en
    // vez de que Stripe rechace la sesión entera y se caiga la venta.
    if (Object.keys(base).length + Object.keys(atribucion).length >= LIMITE_CLAVES) break

    atribucion[clave] = recortado
  }

  return { ...base, ...atribucion }
}

/**
 * Las claves de atribución que el webhook debe rescatar de la metadata.
 * `promo_slug` NO está: ya tiene su propia columna en `subscriptions` desde
 * la migración 043 y duplicarlo dentro del jsonb daría dos verdades.
 */
export const CLAVES_ATRIBUCION = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'referrer',
  'landing_url',
] as const
