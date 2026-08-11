/**
 * POST /api/seats/create-learner
 * ------------------------------
 * Crea la fila de `learners` que despues cobrara /api/seats/add.
 *
 * Nace en status 'inactive' a proposito: el asiento se activa SOLO tras
 * el cobro. Si el usuario abandona aqui, queda una fila sin acceso y sin
 * cargo, que es el estado seguro.
 *
 * Separar la creacion del cobro es lo que hace reintentable el flujo: si
 * el cargo falla, la pantalla reusa este learnerId en vez de crear otra
 * fila.
 *
 * Request body:
 *   { displayName, birthdate, samePersonAs, educationLevel, grade, themeId }
 * Response: { learnerId: string } | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { MAX_SEATS } from '@/lib/payments/config'
import { calcularEdad } from '@/lib/legal'

type Body = {
  displayName?: string
  birthdate?: string | null
  samePersonAs?: string | null
  educationLevel?: string | null
  grade?: number | null
  themeId?: string | null
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Body | null
  const displayName = body?.displayName?.trim()
  if (!displayName) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  // 2. Tope. Misma RPC que add y preview: un asiento dado de baja sigue
  //    ocupando lugar mientras conserve acceso.
  const { data: ocupados, error: rpcError } = await supabase
    .rpc('occupied_seats', { p_account: user.id })

  if (rpcError) {
    console.error('[seats/create-learner] occupied_seats fallo:', rpcError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if ((ocupados ?? 0) >= MAX_SEATS) {
    return NextResponse.json(
      { error: `Una cuenta admite hasta ${MAX_SEATS} alumnos` },
      { status: 409 }
    )
  }

  // 3. samePersonAs, si viene, DEBE ser un alumno de esta misma cuenta.
  //    No se confia en el id del body.
  const samePersonAs = body?.samePersonAs ?? null
  if (samePersonAs) {
    const { data: origen, error: origenError } = await supabase
      .from('learners')
      .select('id')
      .eq('id', samePersonAs)
      .eq('account_user_id', user.id)
      .maybeSingle()

    if (origenError) {
      console.error('[seats/create-learner] lectura de origen fallo:', origenError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!origen) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // 4. La fecha de nacimiento vive en la PERSONA, no en la fila.
  //    El CHECK learners_birthdate_solo_persona_nueva de la migracion 035
  //    rechaza una fila que traiga las dos cosas, asi que aqui se decide
  //    una u otra y no se deja que la base lo descubra.
  let birthdate: string | null = null
  if (!samePersonAs) {
    const raw = body?.birthdate
    if (!raw) {
      return NextResponse.json(
        { error: 'La fecha de nacimiento es obligatoria' },
        { status: 400 }
      )
    }
    // Mismo criterio que el registro (@/lib/legal): un rango propio aqui
    // significaria dos definiciones de "fecha valida" para lo mismo.
    const edad = calcularEdad(raw)
    if (edad === null || edad < 0 || edad > 120) {
      return NextResponse.json(
        { error: 'Escribe una fecha de nacimiento válida.' },
        { status: 400 }
      )
    }

    // El rango de @/lib/legal (0-120) cubre el age gate de menores, no
    // la plausibilidad escolar. El contenido mas bajo es 1° de
    // secundaria: por debajo de 4 años no hay nada que estudiar aqui.
    if (edad !== null && edad < 4) {
      return NextResponse.json(
        { error: 'La fecha no corresponde a un alumno en edad escolar.' },
        { status: 400 }
      )
    }

    birthdate = raw
  }

  // 5. Service role: learners no tiene politica de INSERT para
  //    `authenticated`, a proposito (ver migracion 035).
  //
  //    account_user_id sale de la sesion, NUNCA del body.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 6. Antes de insertar, reusar una fila 'inactive' de esta cuenta.
  //
  //    Si el usuario crea la fila, el cobro falla y recarga la pantalla
  //    en vez de reintentar, sin esto quedaria una fila huerfana y el
  //    siguiente intento crearia otra. No cobran ni dan acceso, pero
  //    consumen slots —que no se reciclan— y unos cuantos intentos
  //    fallidos dejarian al segundo alumno real con slot 7.
  //
  //    Es seguro reusarla porque una fila 'inactive' nunca se cobro ni
  //    dio acceso: no hay progreso colgando de ella.
  const campos = {
    display_name: displayName,
    birthdate,
    same_person_as: samePersonAs,
    education_level: body?.educationLevel ?? null,
    grade: body?.grade ?? null,
    theme_id: body?.themeId ?? null,
  }

  const { data: huerfana, error: huerfanaError } = await admin
    .from('learners')
    .select('id')
    .eq('account_user_id', user.id)
    .eq('status', 'inactive')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (huerfanaError) {
    console.error('[seats/create-learner] busqueda de huerfana fallo:', huerfanaError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (huerfana) {
    // Se conservan slot y account_user_id: el slot ya esta tomado por
    // esta fila y cambiarlo no aporta nada.
    const { error: updateError } = await admin
      .from('learners')
      .update(campos)
      .eq('id', huerfana.id)

    if (updateError) {
      console.error('[seats/create-learner] update de huerfana fallo:', updateError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ learnerId: huerfana.id })
  }

  // 7. Sin fila reusable: alta nueva.
  //    Slot via RPC: MAX+1, sin reutilizar huecos, para que un slot
  //    nunca se refiera a dos personas distintas en la misma cuenta.
  const { data: slot, error: slotError } = await supabase
    .rpc('next_learner_slot', { p_account: user.id })

  if (slotError || slot == null) {
    console.error('[seats/create-learner] next_learner_slot fallo:', slotError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const { data: creado, error: insertError } = await admin
    .from('learners')
    .insert({
      account_user_id: user.id,
      is_primary: false,
      status: 'inactive',
      slot,
      ...campos,
    })
    .select('id')
    .single()

  if (insertError || !creado) {
    console.error('[seats/create-learner] insert fallo:', insertError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ learnerId: creado.id })
}
