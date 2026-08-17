/**
 * POST /api/admin/promo/verify
 * ---------------------------------------------------------------------------
 * Resuelve `codigo_visible` de una campaña contra Stripe y compara el
 * descuento REAL con el que la fila anuncia.
 *
 * 🔴 Esta es la única defensa contra anunciar "$1" mientras la tarjeta cobra
 * otra cosa. `descuento_tipo` / `descuento_valor` de promo_campaigns son solo
 * texto para la pantalla; el cargo lo decide el cupón que Stripe tiene detrás
 * del código. Nada los mantiene sincronizados salvo correr esto y mirar el
 * resultado antes de prender la campaña.
 *
 * Request body: { slug: string }
 * Response:     PromoVerificacion | { error: string }
 *
 * Required env vars: STRIPE_SECRET_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/payments/stripe'
import type { DescuentoTipo, PromoVerificacion } from '@/lib/promos'

/** La moneda del negocio. Un cupón de amount_off en otra divisa es un desajuste. */
const MONEDA = 'mxn'

/**
 * Tolerancia al comparar montos. `descuento_valor` es numeric de Postgres y
 * el de Stripe sale de dividir centavos entre 100: 24850/100 no siempre da
 * exactamente 248.5 en binario. Un centavo de holgura evita un DESAJUSTE
 * falso sin dejar pasar una diferencia real.
 */
const EPSILON = 0.005

export async function POST(req: NextRequest) {
  // 1. Gate de admin — mismo patrón que el resto de /api/admin/*.
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 2. Body
  const { slug } = (await req.json()) as { slug?: string }
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  // 3. La fila. Se lee por la policy de admin, así que también ve las apagadas
  //    —que son justo las que hay que verificar antes de prender.
  const { data: fila, error: filaError } = await supabase
    .from('promo_campaigns')
    .select('slug, codigo_visible, descuento_tipo, descuento_valor')
    .eq('slug', slug)
    .maybeSingle()

  if (filaError) {
    console.error('[admin/promo/verify] lectura de promo_campaigns fallo:', filaError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!fila) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  const campana = fila as {
    slug: string
    codigo_visible: string
    descuento_tipo: DescuentoTipo
    descuento_valor: number | string
  }
  const valorFila = Number(campana.descuento_valor)

  const vacio: PromoVerificacion = {
    slug: campana.slug,
    codigo_visible: campana.codigo_visible,
    existe: false,
    cupon_id: null,
    promotion_code_id: null,
    stripe_descuento_tipo: null,
    stripe_descuento_valor: null,
    stripe_moneda: null,
    duracion: null,
    duracion_meses: null,
    max_redemptions: null,
    times_redeemed: null,
    canjes_restantes: null,
    first_time_transaction: null,
    expira_at: null,
    desajuste: true,
    desajuste_motivos: [],
  }

  // 4. Stripe.
  //
  //    🔴 `expand: ['data.promotion.coupon']` NO es opcional. En la API
  //    2026-04-22.dahlia el cupón vive en promotion_code.promotion.coupon —no
  //    en .coupon— y sin expandir llega como string (el id). Sin el expand,
  //    percent_off/amount_off serían undefined, la comparación no encontraría
  //    diferencia y esto reportaría "todo bien" para cualquier cupón.
  let promo
  try {
    const lista = await stripe.promotionCodes.list({
      code: campana.codigo_visible,
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    })
    promo = lista.data[0]
  } catch (error) {
    console.error('[admin/promo/verify] Stripe fallo:', error)
    return NextResponse.json({ error: 'Stripe no respondió' }, { status: 502 })
  }

  if (!promo) {
    return NextResponse.json({
      ...vacio,
      desajuste_motivos: [
        `Stripe no tiene ningún promotion code activo con el código "${campana.codigo_visible}".`,
      ],
    } satisfies PromoVerificacion)
  }

  // 5. El cupón. Si por alguna razón no vino expandido, se dice — no se
  //    asume que coincide.
  const cupon =
    promo.promotion.coupon && typeof promo.promotion.coupon === 'object'
      ? promo.promotion.coupon
      : null

  const motivos: string[] = []

  let stripeTipo: DescuentoTipo | null = null
  let stripeValor: number | null = null
  let stripeMoneda: string | null = null

  if (!cupon) {
    motivos.push(
      'Stripe reconoció el código pero no devolvió el cupón asociado: no se puede comparar el descuento.'
    )
  } else if (cupon.percent_off != null) {
    stripeTipo = 'porcentaje'
    stripeValor = cupon.percent_off
  } else if (cupon.amount_off != null) {
    stripeTipo = 'monto'
    // amount_off viene en la unidad mínima de su moneda.
    stripeValor = cupon.amount_off / 100
    stripeMoneda = cupon.currency
  } else {
    motivos.push('El cupón de Stripe no tiene ni percent_off ni amount_off.')
  }

  // 6. LA COMPARACIÓN.
  if (stripeTipo && stripeValor != null) {
    if (stripeTipo !== campana.descuento_tipo) {
      motivos.push(
        `Tipo: la fila dice "${campana.descuento_tipo}" y Stripe tiene "${stripeTipo}".`
      )
    } else if (Math.abs(stripeValor - valorFila) > EPSILON) {
      motivos.push(
        `Valor: la fila anuncia ${valorFila} y Stripe descuenta ${stripeValor}.`
      )
    }

    if (stripeTipo === 'monto' && stripeMoneda && stripeMoneda !== MONEDA) {
      motivos.push(
        `Moneda: el cupón está en ${stripeMoneda.toUpperCase()}, no en ${MONEDA.toUpperCase()}. ` +
          'El monto anunciado no equivale al que se cobra.'
      )
    }
  }

  // Un cupón `once` descuenta el primer cobro; `forever` descuenta todos.
  // No es un desajuste por sí solo —"primer mes a $1" quiere exactamente
  // `once`— pero es el dato que decide si el copy es cierto, así que se
  // reporta para que se lea, no se compara automáticamente.

  const canjesRestantes =
    promo.max_redemptions == null
      ? null
      : Math.max(0, promo.max_redemptions - promo.times_redeemed)

  if (canjesRestantes === 0) {
    motivos.push('Sin canjes restantes: el código ya alcanzó max_redemptions.')
  }

  const resultado: PromoVerificacion = {
    slug: campana.slug,
    codigo_visible: campana.codigo_visible,
    existe: true,
    cupon_id: cupon?.id ?? null,
    promotion_code_id: promo.id,
    stripe_descuento_tipo: stripeTipo,
    stripe_descuento_valor: stripeValor,
    stripe_moneda: stripeMoneda,
    duracion: cupon?.duration ?? null,
    duracion_meses: cupon?.duration_in_months ?? null,
    max_redemptions: promo.max_redemptions,
    times_redeemed: promo.times_redeemed,
    canjes_restantes: canjesRestantes,
    first_time_transaction: promo.restrictions.first_time_transaction,
    expira_at: promo.expires_at ? new Date(promo.expires_at * 1000).toISOString() : null,
    desajuste: motivos.length > 0,
    desajuste_motivos: motivos,
  }

  return NextResponse.json(resultado)
}
