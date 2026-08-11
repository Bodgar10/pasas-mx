/**
 * POST /api/seats/promocion-vista
 * -------------------------------
 * Marca que al alumno ya se le propuso pasar de grado en este ciclo.
 *
 * Lo llaman los TRES caminos del modal —aceptar, elegir otro grado y
 * "ahora no"— a proposito: es un aviso una vez por ciclo, no una
 * insistencia. Cerrar sin decidir tambien cuenta como visto.
 *
 * Request body: { learnerId: string }
 * Response:     { ok: true, ciclo: string } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cicloActual } from '@/lib/ciclo-escolar'

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const learnerId = (body as { learnerId?: string } | null)?.learnerId
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId requerido' }, { status: 400 })
    }

    // 2. Pertenencia. Cliente del usuario: la RLS respalda el filtro.
    const { data: learner, error: learnerError } = await supabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .eq('account_user_id', user.id)
      .maybeSingle()

    if (learnerError) {
      console.error('[seats/promocion-vista] lectura de learner fallo:', learnerError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!learner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Service role: learners no tiene politica de UPDATE para
    //    `authenticated` (migracion 036).
    const ciclo = cicloActual()
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error: updateError } = await admin
      .from('learners')
      .update({ promocion_vista_ciclo: ciclo })
      .eq('id', learnerId)

    // 4. Si falla, el modal reaparece en la siguiente visita. Molesto,
    //    pero no rompe nada: se devuelve el error para no fingir exito.
    if (updateError) {
      console.error('[seats/promocion-vista] update fallo:', updateError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ciclo })

  } catch (err) {
    console.error('[seats/promocion-vista] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
