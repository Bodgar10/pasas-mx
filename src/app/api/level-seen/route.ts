import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { xpToLevel } from '@/lib/gamification'
import { getActiveLearnerId } from '@/lib/learners'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // El nivel se recalcula del xp_total real, no llega del cliente:
  // si viniera del body, cualquiera se marcaria el nivel 40 como visto.
  const learnerId = await getActiveLearnerId(supabase, user.id)
  if (!learnerId) {
    return NextResponse.json({ error: 'Sin alumno activo' }, { status: 409 })
  }

  const { data: profile } = await supabase
    .from('learners')
    .select('xp_total')
    .eq('id', learnerId)
    .single()

  const { level } = xpToLevel(profile?.xp_total ?? 0)

  const { error } = await supabase
    .from('learners')
    .update({ last_level_seen: level })
    .eq('id', learnerId)

  if (error) {
    console.error('level-seen update failed:', error)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  return NextResponse.json({ level })
}
