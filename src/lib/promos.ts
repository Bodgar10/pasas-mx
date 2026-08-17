/**
 * PROMOCIONES — FUENTE ÚNICA
 * ---------------------------------------------------------------------------
 * Todo lo que tenga que ver con una campaña de promoción pasa por aquí:
 * leerla, decidir si aplica a un plan/ciclo, y calcular el precio con
 * descuento.
 *
 * 🔴 NINGUNA pantalla ni endpoint calcula un precio con descuento por su
 * cuenta. Si en algún archivo aparece una resta o un porcentaje sobre un
 * precio de lista, es un bug: el número anunciado se desincroniza del que
 * cobra Stripe y eso es materia de PROFECO. Todo pasa por precioConPromo().
 *
 * 🔴 El descuento REAL lo aplica el cupón que Stripe tiene detrás de
 * `codigo_visible`, resuelto en tiempo de checkout con
 * stripe.promotionCodes.list({ code, active: true }). No se guarda ningún id
 * de Stripe en la tabla: el código es la fuente.
 *
 * `descuento_tipo` y `descuento_valor` son solo para pintar el número en
 * pantalla. Este módulo no puede verificar que coincidan con Stripe — de eso
 * sirve POST /api/admin/promo/verify, que compara los dos lados y devuelve
 * DESAJUSTE si difieren.
 *
 * NO lleva 'use client': lo importan tanto server components y route
 * handlers como el cliente de /admin/promociones. Por eso getPromoActiva()
 * arma su propio cliente de Supabase con @supabase/supabase-js en vez de
 * usar @/utils/supabase/server — ese importa `next/headers` y rompería el
 * bundle de cualquier componente 'use client' que toque este archivo.
 */

import { createClient } from '@supabase/supabase-js'
import { PLAN_DISPLAY, formatoMXN } from '@/lib/payments/config'

export type DescuentoTipo = 'monto' | 'porcentaje'

/** Espejo exacto de las columnas de public.promo_campaigns (migración 042). */
export type PromoCampaign = {
  slug: string
  activa: boolean
  /** Lo que el usuario teclea. Es la fuente: el promo_... se resuelve en Stripe. */
  codigo_visible: string
  /** Claves de PLAN_DISPLAY: 'estandar_v2' | 'personalizado_v2' */
  planes: string[]
  /** Vocabulario de PLAN_DISPLAY.prices: 'mensual' | 'semestral' | 'anual' */
  ciclos: string[]
  descuento_tipo: DescuentoTipo
  descuento_valor: number
  inicia_at: string | null
  termina_at: string | null
  cta_label: string
  cta_sublabel: string | null
  badge_landing: string | null
  banner_checkout: string | null
  created_at: string
  updated_at: string
}

/**
 * Los campos de PINTADO. Es todo lo que /api/promo devuelve.
 *
 * Sin `activa`, `inicia_at` ni `termina_at` a propósito: si el endpoint
 * respondió con una promo, es porque está vigente. Que la UI vuelva a
 * evaluar la vigencia por su cuenta sería una segunda regla, y dos reglas
 * acaban discrepando.
 *
 * 🔴 Es un `Pick` y NO un `Omit`: con Omit, cualquier columna agregada mañana
 * entraría sola a este tipo y el endpoint la devolvería sin que nadie se
 * enterara. Con Pick, lo nuevo queda fuera por defecto y hay que agregarlo a
 * mano.
 */
export type PromoPublica = Pick<
  PromoCampaign,
  | 'slug'
  | 'codigo_visible'
  | 'planes'
  | 'ciclos'
  | 'descuento_tipo'
  | 'descuento_valor'
  | 'cta_label'
  | 'cta_sublabel'
  | 'badge_landing'
  | 'banner_checkout'
>

/**
 * Lista explícita de columnas para los `.select()`. Se comparte para que la
 * pantalla de admin y getPromoActiva lean exactamente lo mismo y el tipo
 * PromoCampaign siga siendo cierto en los dos lados.
 */
export const PROMO_COLUMNS =
  'slug, activa, codigo_visible, planes, ciclos, ' +
  'descuento_tipo, descuento_valor, inicia_at, termina_at, cta_label, ' +
  'cta_sublabel, badge_landing, banner_checkout, created_at, updated_at'

/**
 * Respuesta de POST /api/admin/promo/verify.
 *
 * Vive aquí y no en el route handler porque el cliente de /admin/promociones
 * la necesita tipada, y ese archivo importa @/lib/payments/stripe — que
 * revienta al cargarse sin STRIPE_SECRET_KEY.
 */
/**
 * Tope de canjes de UN nivel de Stripe.
 *
 * `restantes` en null significa "sin tope EN ESTE NIVEL", que NO es lo mismo
 * que ilimitado: el otro nivel puede tenerlo. Quien quiera la respuesta a
 * "¿cuántos quedan?" usa `canjes_restantes` de PromoVerificacion, que ya
 * combina los dos.
 */
export type TopeCanjes = {
  max_redemptions: number | null
  times_redeemed: number | null
  restantes: number | null
}

export type PromoVerificacion = {
  slug: string
  codigo_visible: string
  /** false = Stripe no reconoce ese código como activo. Nada más aplica. */
  existe: boolean
  /** El cupón detrás del promotion code. */
  cupon_id: string | null
  promotion_code_id: string | null
  /** Descuento tal como lo tiene Stripe, ya traducido a nuestro vocabulario. */
  stripe_descuento_tipo: DescuentoTipo | null
  stripe_descuento_valor: number | null
  /** Moneda del cupón cuando es de monto fijo. null en porcentajes. */
  stripe_moneda: string | null
  duracion: 'forever' | 'once' | 'repeating' | null
  duracion_meses: number | null
  /**
   * 🔴 El tope de canjes vive en DOS niveles y Stripe aplica LOS DOS. En
   * PASAS1 el promotion code no tiene tope propio y el límite real está en el
   * cupón: leer solo el promotion code reportaba "∞" sobre una campaña que sí
   * se agota, y el aviso de agotamiento nunca habría saltado.
   */
  tope_promotion_code: TopeCanjes
  tope_cupon: TopeCanjes
  /**
   * El MÁS RESTRICTIVO de los dos niveles. null solo si los dos son null —
   * ahí sí es ilimitado.
   */
  canjes_restantes: number | null
  first_time_transaction: boolean | null
  expira_at: string | null
  /**
   * 🔴 true = lo que la fila anuncia NO es lo que Stripe cobra. No prender la
   * campaña. `desajuste_motivos` dice exactamente qué difiere.
   */
  desajuste: boolean
  desajuste_motivos: string[]
}

/**
 * Etiquetas del vocabulario de DISPLAY.
 *
 * CICLO_LABEL de src/lib/payments/config.ts NO sirve aquí: sus claves son las
 * de la base (monthly | semestral | annual) y `promo_campaigns.ciclos` guarda
 * las de PLAN_DISPLAY.prices (mensual | semestral | anual).
 */
const CICLO_PROMO_LABEL: Record<string, string> = {
  mensual: 'Mensual',
  semestral: 'Semestral',
  anual: 'Anual',
}

export function etiquetaCiclo(ciclo: string): string {
  return CICLO_PROMO_LABEL[ciclo] ?? ciclo
}

export function etiquetaPlan(plan: string): string {
  const entry = (PLAN_DISPLAY as Record<string, { label: string } | undefined>)[plan]
  return entry?.label ?? plan
}

/** "$248 de descuento" | "20% de descuento". Formato en un solo lugar. */
export function etiquetaDescuento(promo: Pick<PromoCampaign, 'descuento_tipo' | 'descuento_valor'>): string {
  return promo.descuento_tipo === 'monto'
    ? `$${promo.descuento_valor} de descuento`
    : `${promo.descuento_valor}% de descuento`
}

/**
 * Precio de lista, leído de PLAN_DISPLAY.
 *
 * Privado a propósito: quien necesite un número con descuento usa
 * precioConPromo(), que devuelve lista y final juntos. Exponer solo la lista
 * invita a que una pantalla haga la resta por su cuenta.
 */
function precioLista(plan: string, ciclo: string): number | null {
  const entry = (PLAN_DISPLAY as Record<
    string,
    { prices: Record<string, { amount: number }> } | undefined
  >)[plan]
  const lista = entry?.prices?.[ciclo]?.amount
  return lista == null ? null : lista
}

/**
 * Devuelve la campaña SOLO si es utilizable ahora mismo.
 *
 * null si: slug vacío, no existe, activa = false, hoy < inicia_at, o
 * hoy > termina_at. Fechas nulas = sin límite por ese lado.
 */
export async function getPromoActiva(slug: string | null): Promise<PromoCampaign | null> {
  const limpio = slug?.trim()
  if (!limpio) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  const { data, error } = await supabase
    .from('promo_campaigns')
    .select(PROMO_COLUMNS)
    .eq('slug', limpio)
    .maybeSingle()

  if (error) {
    console.error('[promos] lectura de promo_campaigns fallo:', error)
    return null
  }
  if (!data) return null

  const fila = data as unknown as PromoCampaign

  const promo: PromoCampaign = {
    ...fila,
    // `numeric` de Postgres puede llegar como string según el driver. Sin
    // este Number(), un descuento de tipo 'monto' haría `249 - "248"` y
    // JavaScript devolvería 1 por coerción, pero el de 'porcentaje' haría
    // `"20" / 100` y también colaría. El que revienta es el `Math.max(0, …)`
    // con NaN. Se normaliza aquí, una vez, en la puerta de entrada.
    descuento_valor: Number(fila.descuento_valor),
  }

  // La policy pública de RLS ya filtra activa = true, pero un admin
  // autenticado entra por la policy de admin y SÍ ve las apagadas. El
  // chequeo va en código para que la función signifique lo mismo para todos.
  if (!promo.activa) return null

  const ahora = Date.now()
  if (promo.inicia_at && new Date(promo.inicia_at).getTime() > ahora) return null
  if (promo.termina_at && new Date(promo.termina_at).getTime() < ahora) return null

  return promo
}

/**
 * Lo mínimo para decidir si una promo aplica. Tipado estructural a propósito:
 * así sirven igual `PromoCampaign` (servidor, /admin) y `PromoPublica` (lo
 * que la UI recibe de /api/promo), sin castear en cada llamada.
 */
type PromoAlcance = Pick<PromoCampaign, 'planes' | 'ciclos'>
type PromoDescuento = PromoAlcance & Pick<PromoCampaign, 'descuento_tipo' | 'descuento_valor'>
type PromoCopy = PromoAlcance & Pick<PromoCampaign, 'cta_label' | 'cta_sublabel'>

/** true solo si el plan Y el ciclo están en la campaña. */
export function promoAplica(
  promo: PromoAlcance | null,
  plan: string,
  ciclo: string
): boolean {
  if (!promo) return false
  return promo.planes.includes(plan) && promo.ciclos.includes(ciclo)
}

/**
 * Precio de lista y precio final de ese plan/ciclo con la campaña aplicada.
 *
 * null si la promo no aplica (o si el plan/ciclo no existe en PLAN_DISPLAY).
 *
 * 🔴 NO redondea. Un porcentaje puede dar centavos y el cargo de Stripe los
 * traerá; redondear a un entero "bonito" haría que la pantalla anuncie un
 * número distinto al que se cobra. Para pintarlo, formatoMXN() de
 * src/lib/payments/config.ts muestra centavos solo si los hay.
 */
export function precioConPromo(
  promo: PromoDescuento | null,
  plan: string,
  ciclo: string
): { lista: number; final: number } | null {
  if (!promoAplica(promo, plan, ciclo)) return null

  const lista = precioLista(plan, ciclo)
  if (lista == null) return null

  // promoAplica ya garantizó que no es null.
  const p = promo as PromoDescuento

  const bruto =
    p.descuento_tipo === 'monto'
      ? lista - p.descuento_valor
      : lista * (1 - p.descuento_valor / 100)

  // Un descuento mal capturado (monto 300 sobre lista 249) no puede producir
  // un precio negativo.
  return { lista, final: Math.max(0, bruto) }
}

/**
 * REGLA C — el bloque de precio con descuento, completo.
 *
 * 🔴 El cupón es `once`: descuenta el PRIMER cobro y después se cobra lista.
 * Pintar "$1 /mes" es anunciar un precio y cobrar otro, y eso es materia de
 * PROFECO. Por eso esta función no devuelve el precio final solo: devuelve
 * los TRES textos juntos, y quien tenga `finalTexto` tiene `despuesTexto` al
 * lado sin poder olvidarlo.
 *
 * Devuelve null si la promo no aplica — la pantalla pinta su precio normal.
 *
 *   listaTexto   "$249"              ← va tachado
 *   finalTexto   "$1 primer mes"
 *   despuesTexto "después $249/mes"
 */
export function leyendaPromo(
  promo: PromoDescuento | null,
  plan: string,
  ciclo: string
): {
  lista: number
  final: number
  listaTexto: string
  finalTexto: string
  despuesTexto: string
} | null {
  const precio = precioConPromo(promo, plan, ciclo)
  if (!precio) return null

  // Qué se cobra después, en el lenguaje de cada ciclo. El semestral y el
  // anual son un pago único, no una mensualidad: decir "/mes" ahí sería otra
  // forma del mismo problema.
  const despues =
    ciclo === 'mensual'
      ? `después $${formatoMXN(precio.lista)}/mes`
      : ciclo === 'semestral'
      ? `después $${formatoMXN(precio.lista)} cada 6 meses`
      : `después $${formatoMXN(precio.lista)} al año`

  // El descuento cae en el primer cargo. En mensual ese cargo ES el primer
  // mes; en los demás es el primer pago del periodo completo.
  const queCubre = ciclo === 'mensual' ? 'primer mes' : 'primer pago'

  return {
    lista: precio.lista,
    final: precio.final,
    listaTexto: `$${formatoMXN(precio.lista)}`,
    finalTexto: `$${formatoMXN(precio.final)} ${queCubre}`,
    despuesTexto: despues,
  }
}

/**
 * Copy del CTA. Fallback tal cual si la promo no aplica.
 *
 * 🔴 TODA pantalla llama a esto. Ninguna arma el ternario a mano: es así como
 * el CTA del hero acaba diciendo una cosa y el de la tarjeta de precio otra.
 */
export function copyCTA(
  promo: PromoCopy | null,
  plan: string,
  ciclo: string,
  fallback: { label: string; sublabel: string | null }
): { label: string; sublabel: string | null } {
  if (!promoAplica(promo, plan, ciclo)) return fallback

  const p = promo as PromoCopy
  return { label: p.cta_label, sublabel: p.cta_sublabel }
}

/**
 * Pega `?promo=<slug>` a un destino interno, conservando lo que ya traiga.
 *
 * 🔴 EL SLUG TIENE QUE VIAJAR EN LOS ENLACES, no solo en sessionStorage.
 * sessionStorage es por pestaña: se pierde en una pestaña nueva, en un enlace
 * compartido y en cualquier navegador con el almacenamiento bloqueado (los
 * navegadores dentro de apps —TikTok, Instagram— son justo el origen del
 * tráfico de campaña). Y cuando se pierde no hay señal de error: la pantalla
 * simplemente cobra precio de lista.
 *
 * El param es la red de seguridad; sessionStorage sigue siendo el respaldo
 * para cualquier navegación que no pase por un enlace nuestro. usePromo lee
 * los dos, con el param ganando.
 *
 * `slug` null/vacío devuelve el destino intacto: un `?promo=` vacío en la URL
 * sería ruido que además viaja a analítica.
 */
export function conPromo(destino: string, slug: string | null | undefined): string {
  const limpio = slug?.trim().toLowerCase()
  if (!limpio) return destino

  // URLSearchParams y no una concatenación con '?' o '&': es el mismo patrón
  // con el que el embudo ya arma `?level=…&grade=…`, y resuelve solo el
  // separador correcto según el destino ya traiga query o no.
  const [ruta, queryExistente] = destino.split('?')
  const params = new URLSearchParams(queryExistente ?? '')
  params.set('promo', limpio)
  return `${ruta}?${params.toString()}`
}

/**
 * REGLA D — la microcopy de promo reemplaza la de trial, pero no borra las
 * promesas que ya estaban.
 *
 * 🔴 "Requiere tarjeta" y "Cancela cuando quieras" NO se pierden nunca. Si el
 * sublabel de la campaña no las trae, se pegan después. ("Sin tarjeta" fue una
 * mentira que se corrigió en la s26 — no la resucites.)
 *
 * `obligatorias` se pasa por sitio porque no todos los CTA las tienen hoy:
 * la del nav no tiene microcopy y la de la tarjeta de precio tiene las dos.
 * Se conserva lo que había, no lo que nos gustaría que hubiera.
 */
export function microcopyPromo(
  sublabel: string | null,
  obligatorias: string[]
): string {
  const base = (sublabel ?? '').trim()

  /**
   * 🔴 SE TRABAJA POR SEGMENTOS, NO POR SUBCADENAS.
   *
   * Antes la comprobación era `base.toLowerCase().includes(frase)`. Con un
   * sublabel capturado desde /admin como
   *   "Tus primeros 7 días son gratis.Cancela cuando quieras"
   * esa frase SÍ aparece como subcadena, así que se daba por puesta y no se
   * añadía nada — dejando el texto pegado en pantalla:
   *   "…son gratis.Cancela cuando quieras · Sin cobro hasta el día 8"
   *
   * Al partir por el separador y despegar la frase obligatoria del segmento
   * que la trae incrustada, la promesa queda como un segmento propio y el
   * `join` le pone su ` · ` como a cualquier otro. El arreglo vive aquí y no
   * en la fila: cualquier campaña futura capturada con el mismo descuido sale
   * bien formada sin tener que editarla.
   */
  const segmentos = obligatorias.reduce<string[]>(
    (acc, frase) =>
      acc.flatMap((seg) => {
        const i = seg.toLowerCase().indexOf(frase.toLowerCase())
        // i < 0: no está. i === 0: ya es el segmento entero, nada que partir.
        if (i <= 0) return [seg]
        return [seg.slice(0, i).trim(), seg.slice(i).trim()].filter(Boolean)
      }),
    base
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean)
  )

  const faltantes = obligatorias.filter(
    (f) => !segmentos.some((s) => s.toLowerCase() === f.toLowerCase())
  )

  return [...segmentos, ...faltantes].join(' · ')
}
