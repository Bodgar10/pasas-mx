import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { buildAcquisitionSource } from '@/lib/audience-detection'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      referrer, landing_url,
      // Hora real del toque, sellada por UTMPersistence al capturar.
      first_touch_at,
    } = body

    // Si hay usuario autenticado, guardar directo en BD
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const acquisitionSource = buildAcquisitionSource(
        { utm_source, utm_medium, utm_campaign, utm_content, utm_term, first_touch_at },
        referrer,
        landing_url
      )

      // Solo guardar si aún no tiene acquisition_source
      const { data: existing } = await supabase
        .from('users')
        .select('acquisition_source')
        .eq('id', user.id)
        .single()

      if (!existing?.acquisition_source) {
        await supabase
          .from('users')
          .update({ acquisition_source: acquisitionSource })
          .eq('id', user.id)
      }

      // 🔴 `persistido: true` tambien cuando ya habia valor.
      //
      // Significa "este canal ya esta en la base, deja de reintentar", no
      // "acabo de escribir". Devolver false porque ya existia haria que
      // UTMPersistence reintentara para siempre contra una fila que nunca
      // va a cambiar: el first-touch no se pisa.
      return NextResponse.json({ ok: true, persistido: true })
    }

    // Sin sesion todavia. `ok` a secas era ambiguo: el cliente no podia
    // distinguir esto de un guardado real, y por eso la primera visita se
    // quedaba sin atribucion sin que nada fallara.
    return NextResponse.json({ ok: true, persistido: false })
  } catch {
    return NextResponse.json({ ok: false, persistido: false }, { status: 500 })
  }
}
