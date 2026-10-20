/**
 * GET /api/promo?slug=pasas1   ·   GET /api/promo
 * ---------------------------------------------------------------------------
 * Devuelve la campaña de promoción vigente, o { promo: null }.
 *
 * 🔴 SIN `slug` devuelve la CAMPAÑA DE LA CASA (getPromoPorDefecto): la que
 * ve quien llega a pasas.mx sin enlace de campaña. Antes, sin slug no se
 * llamaba a este endpoint siquiera, así que prender una campaña desde /admin
 * no se veía en el tráfico orgánico ni directo.
 *
 * Existe porque /planes y /bienvenida son 'use client' de arriba a abajo: no
 * pueden hacer `await getPromoActiva()` en el render. Un server component
 * SÍ debe llamar a getPromoActiva() directo y NO pasar por aquí — un fetch a
 * tu propio origen desde el servidor es un salto de red de más.
 *
 * 🔴 Devuelve SOLO los campos de pintado (PromoPublica, un Pick — ver
 * src/lib/promos.ts). Sin fechas y sin `activa`: si esto respondió con una
 * promo, es porque está vigente, y la UI no tiene que volver a decidirlo. La
 * lista blanca de abajo se escribe campo por campo a propósito — un
 * `...promo` arrastraría la fila entera y ataría la UI a columnas que no
 * necesita.
 *
 * Sin promo válida devuelve 200, no 404: "no hay promoción" es una respuesta
 * normal, no un error, y la UI la pinta sin promo en vez de mostrar un fallo.
 *
 * Response: { promo: PromoPublica | null }
 */

import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { PROMO_COLUMNS, type PromoCampaign, type PromoPublica } from '@/lib/promos'
// La misma regla de vigencia que usan getPromoActiva/getPromoPorDefecto.
import { normalizar, vigente } from '@/lib/promos-server'

/**
 * CACHÉ DE LAS FILAS CRUDAS — 60 s, tag 'promos'.
 *
 * Lo llaman /planes y /bienvenida en cada visita y la respuesta es la misma
 * para todos: cliente ANÓNIMO, sin cookies, sin usuario. Lo único que cambia
 * la respuesta es `?slug=`, que va en la URL (y por tanto en la clave del CDN).
 *
 * 🔴 Se cachean las FILAS, no la decisión. La vigencia por fecha (inicia_at /
 * termina_at) se evalúa FUERA, en cada request: una campaña que termina a las
 * 23:59 deja de anunciarse a las 23:59, no 60 s después. Lo que sí puede
 * tardar hasta 60 s (+ el CDN) es ver el cambio de un `activa` desde /admin.
 *
 * La anon key solo ve `activa = true` (policy "public read active", 042), así
 * que estas filas son exactamente las que getPromoActiva y getPromoPorDefecto
 * podían ver: buscar el slug aquí dentro es la misma lectura que antes.
 *
 * Un error de lectura LANZA dentro del scope para NO cachear el fallo: el
 * catch de abajo responde { promo: null } como siempre y el siguiente request
 * vuelve a intentar.
 */
const leerFilasActivas = unstable_cache(
  async (): Promise<PromoCampaign[]> => {
    const { data, error } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    )
      .from('promo_campaigns')
      .select(PROMO_COLUMNS)
      .eq('activa', true)
    if (error) throw error
    return (data ?? []) as unknown as PromoCampaign[]
  },
  ['api-promo-filas-activas'],
  { revalidate: 60, tags: ['promos'] }
)

/** Misma regla que getPromoActiva(slug), sobre las filas cacheadas. */
function promoPorSlug(filas: PromoCampaign[], slug: string): PromoCampaign | null {
  const fila = filas.find((f) => f.slug === slug)
  if (!fila) return null
  const promo = normalizar(fila)
  return vigente(promo) ? promo : null
}

/**
 * Misma regla que getPromoPorDefecto(): EXACTAMENTE una vigente o null
 * (fail-closed, ver el porqué en promos-server.ts).
 */
function promoPorDefecto(filas: PromoCampaign[]): PromoCampaign | null {
  const vigentes = filas.map(normalizar).filter(vigente)
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

/**
 * CDN: 60 s frescos y hasta 300 s sirviendo la copia vieja mientras se
 * regenera. Va en TODAS las respuestas 200, también en { promo: null }: "no
 * hay campaña" también es la respuesta de todos.
 */
const CACHE_CDN = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug')?.trim()

    // Con slug manda el slug: una campaña de canal se sigue pudiendo pedir
    // por su nombre aunque no sea la de la casa.
    const filas = await leerFilasActivas()
    const promo = slug ? promoPorSlug(filas, slug) : promoPorDefecto(filas)

    if (!promo) {
      return NextResponse.json({ promo: null }, { headers: CACHE_CDN })
    }

    const publica: PromoPublica = {
      slug: promo.slug,
      codigo_visible: promo.codigo_visible,
      planes: promo.planes,
      ciclos: promo.ciclos,
      descuento_tipo: promo.descuento_tipo,
      descuento_valor: promo.descuento_valor,
      cta_label: promo.cta_label,
      cta_sublabel: promo.cta_sublabel,
      badge_landing: promo.badge_landing,
      banner_checkout: promo.banner_checkout,
    }

    return NextResponse.json({ promo: publica }, { headers: CACHE_CDN })
  } catch (error) {
    console.error('[api/promo] Error:', error)
    // Tampoco aquí se devuelve 500: si la promo no se pudo leer, la pantalla
    // debe pintarse a precio de lista, no romperse.
    return NextResponse.json({ promo: null })
  }
}
