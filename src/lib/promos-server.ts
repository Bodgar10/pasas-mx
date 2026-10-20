import 'server-only'

/**
 * PROMOCIONES — LECTURAS DE SUPABASE
 * ---------------------------------------------------------------------------
 * La mitad de src/lib/promos.ts que habla con la base. Se separó en s34: las
 * reglas puras (promoAplica, precioConPromo, leyendaPromo, copyCTA, …) siguen
 * allá y las usan componentes de cliente; esto solo lo usan server
 * components, route handlers y promo-checkout.
 *
 * 🔴 `server-only` convierte en error de build cualquier import desde un
 * componente 'use client'. Es a propósito: el día que alguien lo importe
 * desde la landing, @supabase/supabase-js vuelve a viajar a todas las
 * pantallas. El cliente que necesite una promo la pide a GET /api/promo
 * (usePromo).
 *
 * Arma su propio cliente ANÓNIMO con @supabase/supabase-js en vez de usar
 * @/utils/supabase/server: la policy pública de promo_campaigns basta, y sin
 * cookies la lectura es la misma para todos.
 */

import { createClient } from '@supabase/supabase-js'
import { PROMO_COLUMNS, type PromoCampaign } from '@/lib/promos'

function clienteAnonimo() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

/**
 * Normaliza una fila cruda. Única puerta de entrada de los datos.
 *
 * `numeric` de Postgres puede llegar como string según el driver. Sin este
 * Number(), un descuento de tipo 'monto' haría `249 - "248"` y JavaScript
 * devolvería 1 por coerción, pero el de 'porcentaje' haría `"20" / 100` y
 * también colaría. El que revienta es el `Math.max(0, …)` con NaN.
 */
export function normalizar(fila: PromoCampaign): PromoCampaign {
  return { ...fila, descuento_valor: Number(fila.descuento_valor) }
}

/**
 * ¿Es utilizable AHORA MISMO? Fechas nulas = sin límite por ese lado.
 *
 * La policy pública de RLS ya filtra activa = true, pero un admin autenticado
 * entra por la policy de admin y SÍ ve las apagadas. El chequeo va en código
 * para que esto signifique lo mismo para todos.
 */
export function vigente(promo: PromoCampaign): boolean {
  if (!promo.activa) return false
  const ahora = Date.now()
  if (promo.inicia_at && new Date(promo.inicia_at).getTime() > ahora) return false
  if (promo.termina_at && new Date(promo.termina_at).getTime() < ahora) return false
  return true
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

  const { data, error } = await clienteAnonimo()
    .from('promo_campaigns')
    .select(PROMO_COLUMNS)
    .eq('slug', limpio)
    .maybeSingle()

  if (error) {
    console.error('[promos] lectura de promo_campaigns fallo:', error)
    return null
  }
  if (!data) return null

  const promo = normalizar(data as unknown as PromoCampaign)
  return vigente(promo) ? promo : null
}

/**
 * LA CAMPAÑA DE LA CASA — la que ve quien llega a pasas.mx sin `?promo=`.
 *
 * ── El bug que arregla ────────────────────────────────────────────────
 * Hasta ahora toda la promoción colgaba del slug: sin `?promo=` en la URL
 * y sin nada en sessionStorage, `usePromo` ni preguntaba y la pantalla
 * pintaba precio de lista. O sea que prender la campaña desde /admin solo
 * surtía efecto para quien llegaba por un enlace de campaña — el tráfico
 * orgánico, el directo y el de redes sin UTM veían $249 con la campaña
 * encendida.
 *
 * ── La regla, y por qué es esta ───────────────────────────────────────
 * Se anuncia la campaña vigente solo si hay EXACTAMENTE UNA. Con dos
 * encendidas no se adivina: se devuelve null y cada quien sigue viendo la
 * suya por `?promo=`.
 *
 * 🔴 Eso es deliberado y es lo que mantiene la garantía de PROFECO. Elegir
 * "la más nueva" o "la de mayor descuento" significaría que una campaña de
 * canal —un código de escuela, un acuerdo con un creador— se filtraría a la
 * landing pública en cuanto alguien la prenda, anunciando a todo el mundo un
 * descuento que su checkout no aplica. Fail-closed: si hay ambigüedad, no
 * hay promo por defecto.
 *
 * El día que convivan dos campañas y una deba ser la pública, esto se
 * reemplaza por una columna `publica` en promo_campaigns. Mientras haya una
 * sola, esa columna sería un interruptor más que mantener sincronizado con
 * `activa` — y un interruptor olvidado es justo lo que apaga una campaña sin
 * que nadie se entere.
 */
export async function getPromoPorDefecto(): Promise<PromoCampaign | null> {
  const { data, error } = await clienteAnonimo()
    .from('promo_campaigns')
    .select(PROMO_COLUMNS)
    .eq('activa', true)

  if (error) {
    console.error('[promos] lectura de campañas activas fallo:', error)
    return null
  }

  const vigentes = ((data ?? []) as unknown as PromoCampaign[])
    .map(normalizar)
    .filter(vigente)

  if (vigentes.length !== 1) {
    if (vigentes.length > 1) {
      console.warn(
        `[promos] ${vigentes.length} campañas vigentes a la vez ` +
          `(${vigentes.map((p) => p.slug).join(', ')}): no hay promo por ` +
          'defecto. Quien llegue sin ?promo= verá precio de lista.'
      )
    }
    return null
  }

  return vigentes[0]
}
