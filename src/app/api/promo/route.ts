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
import { getPromoActiva, getPromoPorDefecto, type PromoPublica } from '@/lib/promos'

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug')?.trim()

    // Con slug manda el slug: una campaña de canal se sigue pudiendo pedir
    // por su nombre aunque no sea la de la casa.
    const promo = slug ? await getPromoActiva(slug) : await getPromoPorDefecto()

    if (!promo) {
      return NextResponse.json({ promo: null })
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

    return NextResponse.json({ promo: publica })
  } catch (error) {
    console.error('[api/promo] Error:', error)
    // Tampoco aquí se devuelve 500: si la promo no se pudo leer, la pantalla
    // debe pintarse a precio de lista, no romperse.
    return NextResponse.json({ promo: null })
  }
}
