/**
 * POST /api/seats/change-grade
 * ----------------------------
 * Cambia el nivel y grado de un alumno.
 *
 * NO toca Stripe: el grado no cambia el precio ni el asiento.
 *
 * El avance del grado anterior NO se borra. `progress`, `topic_progress`
 * y `user_subjects` cuelgan del learner_id, no del grado, asi que
 * regresar al grado anterior devuelve el avance tal cual estaba.
 *
 * Request body: { learnerId, educationLevel, grade }
 * Response:     { ok: true, sinCambio?: true } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const NIVELES = ['middle_school', 'high_school'] as const
type Nivel = (typeof NIVELES)[number]

const GRADOS = [1, 2, 3]

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as {
      learnerId?: string
      educationLevel?: string
      grade?: number
    } | null

    const learnerId = body?.learnerId
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId requerido' }, { status: 400 })
    }

    // 3. La columna es un enum y el grado un integer. Cualquier otra
    //    cosa la rechazaria Postgres; se corta antes para dar un error
    //    util en vez de un 500.
    const educationLevel = body?.educationLevel
    const grade = body?.grade
    if (!educationLevel || !NIVELES.includes(educationLevel as Nivel)) {
      return NextResponse.json({ error: 'Nivel invalido' }, { status: 400 })
    }
    if (typeof grade !== 'number' || !GRADOS.includes(grade)) {
      return NextResponse.json({ error: 'Grado invalido' }, { status: 400 })
    }

    // 2. Pertenencia. Cliente del usuario: la RLS respalda el filtro.
    const { data: learner, error: learnerError } = await supabase
      .from('learners')
      .select('id, education_level, grade')
      .eq('id', learnerId)
      .eq('account_user_id', user.id)
      .maybeSingle()

    if (learnerError) {
      console.error('[seats/change-grade] lectura de learner fallo:', learnerError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!learner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Sin cambio real: no se escribe ni se registra en la bitacora.
    if (learner.education_level === educationLevel && learner.grade === grade) {
      return NextResponse.json({ ok: true, sinCambio: true })
    }

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 5. 🔴 Un grado sin contenido es una promesa vacia — la misma que
    //    se cerro en s26 ocultando el bloque de Horda con conteo cero.
    //    Aqui es peor porque el usuario ya pago.
    //
    //    preview_stats tiene EXECUTE revocado a `authenticated` y
    //    concedido solo a service_role (migracion 033), asi que va con
    //    el cliente admin.
    const { data: stats, error: statsError } = await admin
      .rpc('preview_stats', { p_nivel: educationLevel, p_grado: grade })
      .single()

    if (statsError) {
      console.error('[seats/change-grade] preview_stats fallo:', statsError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const temas = (stats as { temas?: number } | null)?.temas ?? 0
    if (Number(temas) === 0) {
      return NextResponse.json(
        { error: 'Todavia no tenemos contenido para ese grado. Escribenos y te avisamos en cuanto este.' },
        { status: 400 }
      )
    }

    // 6. Service role: learners no tiene politica de UPDATE para
    //    `authenticated` (migracion 036).
    const { error: updateError } = await admin
      .from('learners')
      .update({
        education_level: educationLevel,
        grade,
      })
      .eq('id', learnerId)

    if (updateError) {
      console.error('[seats/change-grade] update fallo:', updateError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // 7. Bitacora append-only. Sin contadores que se desincronicen: el
    //    limite de cambios, cuando exista, se calcula con un count(*).
    const { error: bitacoraError } = await admin
      .from('learner_grade_changes')
      .insert({
        learner_id: learnerId,
        from_level: learner.education_level,
        from_grade: learner.grade,
        to_level: educationLevel,
        to_grade: grade,
        reason: 'manual',
      })

    if (bitacoraError) {
      // El cambio ya se aplico. La bitacora es registro, no requisito:
      // fallarla no justifica revertir el grado del alumno.
      console.error('[seats/change-grade] bitacora fallo:', bitacoraError)
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[seats/change-grade] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
