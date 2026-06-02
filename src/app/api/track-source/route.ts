import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { buildAcquisitionSource } from '@/lib/audience-detection'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_url } = body

    // Si hay usuario autenticado, guardar directo en BD
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const acquisitionSource = buildAcquisitionSource(
        { utm_source, utm_medium, utm_campaign, utm_content, utm_term },
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
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
