/**
 * POST /api/seats/change-grade
 * ----------------------------
 * Cambia el nivel y grado de un alumno Y resincroniza sus materias.
 *
 * NO toca Stripe: el grado no cambia el precio ni el asiento.
 *
 * 🔴 s32 — LAS MATERIAS SE REEMPLAZAN, no solo el grado.
 * Antes esta ruta escribia `learners.education_level` y `learners.grade`
 * sin tocar `user_subjects`. Como los temas se filtran por grado
 * (`topics.grade`), el alumno quedaba con las materias del grado
 * anterior y veia "Proximamente" en TODAS: el contenido existia, pero
 * ninguno era de su grado. Medido en produccion: una alumna en 3° con
 * siete materias de 2°, 62 temas publicados entre ellas y 0 visibles.
 *
 * Es el camino de la PROMOCION DE CICLO ESCOLAR: en septiembre lo
 * recorre cualquier alumno que suba de grado.
 *
 * Que se conserva y que no:
 *   - `learners.xp_total`      → intacto. El XP historico no se pierde.
 *   - materias de ambos grados → intactas, con su xp y su racha.
 *   - materias `ai_personalized` → INTACTAS. Cambiar de grado reemplaza
 *     el catalogo estandar; no destruye lo que el alumno pago a medida.
 *   - `progress` y `topic_progress` → NO se borran. Quedan huerfanos por
 *     diseno: eran de temas del grado anterior, y si el alumno regresa a
 *     ese grado los recupera tal cual.
 *
 * Request body: { learnerId, educationLevel, grade, reason? }
 *   `reason` alimenta la bitacora: 'promocion_ciclo' lo manda el modal
 *   de septiembre, 'correccion' un arreglo de un dato mal capturado.
 *   Ausente o desconocido → 'manual'.
 * Response:     { ok: true, sinCambio?: true, materias?: {...} }
 *             | { error: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { materiasParaGrado } from '@/lib/learners'

const NIVELES = ['middle_school', 'high_school'] as const
type Nivel = (typeof NIVELES)[number]

const GRADOS = [1, 2, 3]

// Espejo exacto del CHECK `lgc_reason_check` de la migracion 035:57.
// Si la tabla acepta un motivo mas, se agrega aqui; mientras tanto un
// valor fuera de esta lista lo rechazaria Postgres DENTRO de la
// transaccion y tiraria el cambio de grado entero por un dato de
// bitacora. La bitacora es registro, no requisito: un motivo raro cae a
// 'manual' y el cambio se aplica.
const MOTIVOS = ['correccion', 'promocion_ciclo', 'manual'] as const
type Motivo = (typeof MOTIVOS)[number]

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
      reason?: string
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

    // El motivo NO se valida con un 400: distingue una promocion de
    // ciclo de una correccion manual en la bitacora, y eso importa para
    // leer el historico, pero no vale negarle el cambio de grado a un
    // alumno porque un cliente viejo mando un motivo que no existe.
    const reason: Motivo = MOTIVOS.includes(body?.reason as Motivo)
      ? (body?.reason as Motivo)
      : 'manual'

    if (body?.reason && body.reason !== reason) {
      console.warn('[seats/change-grade] motivo desconocido, se registra como manual:', body.reason)
    }

    // 2. Pertenencia. Cliente del usuario: la RLS respalda el filtro.
    //    `theme_id` viene porque es el respaldo para resolver la
    //    tematica de las materias nuevas (paso 7).
    const { data: learner, error: learnerError } = await supabase
      .from('learners')
      .select('id, education_level, grade, theme_id')
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

    // 5. 🔴 HUECO DE CATALOGO — ¿existen materias para ese grado?
    //
    //    Este chequeo es el que faltaba. `preview_stats` (paso 6) NO lo
    //    cubre: filtra por `topics.grade` y une con `subjects` solo por
    //    `education_level`, sin mirar nunca `subjects.grades`. Puede
    //    devolver temas > 0 con CERO materias en el catalogo del grado,
    //    y ese es exactamente el estado en que quedaba el alumno: sin
    //    materias y sin forma de recuperarlas desde la interfaz.
    //
    //    Se rechaza antes de escribir nada. Es peor dejar al alumno sin
    //    catalogo que no dejarlo cambiar de grado.
    const materias = await materiasParaGrado(admin, educationLevel, grade)
    if (materias.length === 0) {
      console.error(
        '[seats/change-grade] HUECO DE CATALOGO — sin materias para',
        educationLevel, grade
      )
      return NextResponse.json(
        { error: 'Todavia no tenemos materias dadas de alta para ese grado. Escribenos y te avisamos en cuanto esten.' },
        { status: 400 }
      )
    }

    // 6. 🔴 HUECO DE CONTENIDO — ¿esas materias tienen temas publicados?
    //
    //    Distinto del anterior a proposito: "no hay materias" es un
    //    hueco de catalogo y "hay materias sin temas" es un hueco de
    //    contenido. Son dos problemas de equipos distintos y el log
    //    tiene que decir cual es.
    //
    //    Un grado sin contenido es una promesa vacia — la misma que se
    //    cerro en s26 ocultando el bloque de Horda con conteo cero.
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
      console.error(
        '[seats/change-grade] HUECO DE CONTENIDO —', materias.length,
        'materias sin temas publicados para', educationLevel, grade
      )
      return NextResponse.json(
        { error: 'Todavia no tenemos contenido para ese grado. Escribenos y te avisamos en cuanto este.' },
        { status: 400 }
      )
    }

    // 7. La tematica. `user_subjects.theme_id` es NOT NULL, asi que sin
    //    esto el insert de la RPC truena entero.
    //
    //    El alumno eligio su tematica y NO cambia al subir de grado: se
    //    toma de las materias que ya tiene. Solo se miran las de
    //    `plan_type = 'grade'` — una materia personalizada puede tener
    //    otra tematica y no manda sobre el catalogo estandar.
    //
    //    Si no tiene ninguna, cae a `learners.theme_id`. Si tampoco, se
    //    ABORTA: inventar una tematica le cambiaria la experiencia
    //    entera al alumno sin que nadie lo pidiera.
    const { data: filaConTema, error: temaError } = await admin
      .from('user_subjects')
      .select('theme_id')
      .eq('learner_id', learnerId)
      .eq('plan_type', 'grade')
      .not('theme_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (temaError) {
      console.error('[seats/change-grade] lectura de tematica fallo:', temaError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const themeId = filaConTema?.theme_id ?? learner.theme_id ?? null
    if (!themeId) {
      console.error(
        '[seats/change-grade] SIN TEMATICA — learner', learnerId,
        'no tiene materias de grado ni theme_id propio'
      )
      return NextResponse.json(
        { error: 'Este alumno no tiene una tematica asignada. Escribenos para acomodarlo antes de cambiarle el grado.' },
        { status: 409 }
      )
    }

    // 8. 🔴 TODO EN UNA TRANSACCION.
    //
    //    Update de `learners` + borrado + insert de `user_subjects` +
    //    bitacora, atomico. Supabase JS no expone transacciones, y si el
    //    insert fallara despues del delete el alumno se quedaria sin
    //    materias y sin forma de recuperarlas: peor que el bug original.
    //    Por eso va en la RPC `resync_learner_grade` (migracion 046).
    //
    //    El calculo de QUE materias tocan NO se duplica en SQL: se manda
    //    ya resuelto por `materiasParaGrado`, que sigue siendo la unica
    //    definicion de la regla. La RPC solo aplica el conjunto.
    //
    //    Cambio respecto a antes: la bitacora ya no se puede fallar en
    //    silencio, porque ahora comparte transaccion con el cambio. Es
    //    el precio de la atomicidad y es el correcto: `reason` ya viene
    //    normalizado contra el CHECK de la tabla, asi que solo fallaria
    //    si algo mas grave ya hizo que no debiera aplicarse el cambio.
    const { data: resumen, error: rpcError } = await admin
      .rpc('resync_learner_grade', {
        p_learner_id: learnerId,
        p_education_level: educationLevel,
        p_grade: grade,
        p_subject_ids: materias.map((m) => m.id),
        p_theme_id: themeId,
        p_reason: reason,
      })
      .single()

    if (rpcError) {
      // Nada quedo escrito: la transaccion entera se revirtio.
      console.error('[seats/change-grade] resync_learner_grade fallo:', rpcError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const conteos = resumen as {
      borradas?: number
      insertadas?: number
      conservadas?: number
    } | null

    // La bitacora no tiene columna donde guardar estos conteos y no se
    // altera la tabla desde aqui. Van al log, que es donde se buscarian
    // si un cambio de grado sale raro.
    console.log(
      '[seats/change-grade] learner', learnerId,
      `${learner.education_level}/${learner.grade} → ${educationLevel}/${grade}`,
      '| materias -', conteos?.borradas ?? 0,
      '+', conteos?.insertadas ?? 0,
      '=', conteos?.conservadas ?? 0, 'intactas'
    )

    return NextResponse.json({
      ok: true,
      materias: {
        borradas: conteos?.borradas ?? 0,
        insertadas: conteos?.insertadas ?? 0,
        conservadas: conteos?.conservadas ?? 0,
      },
    })

  } catch (err) {
    console.error('[seats/change-grade] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
