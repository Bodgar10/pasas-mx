import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import MetricasClient from './metricas-client'

export default async function MetricasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()

  // 24h — rolling
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // 7d — rolling. Se calcula AQUI y no en el cliente para dos cosas: que la
  // consulta de `progress` alcance a cubrirlo (ver `periodoMasAntiguo`), y
  // que servidor y navegador usen exactamente la misma marca. Con un
  // `new Date()` en el cliente, el corte se movia unos milisegundos por
  // deriva de reloj y por el tiempo de render.
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Este mes — del 1 del mes actual a hoy
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Este trimestre — del 1 del primer mes del trimestre actual a hoy
  const currentQuarter = Math.floor(now.getMonth() / 3)
  const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString()

  // Este semestre — del 1 de enero o 1 de julio (según mitad del año)
  const currentSemester = now.getMonth() < 6 ? 0 : 6
  const startOfSemester = new Date(now.getFullYear(), currentSemester, 1).toISOString()

  const last30d = startOfMonth
  const last3m = startOfQuarter
  const last6m = startOfSemester

  // 🔴 El corte de la consulta de `progress` es el MAS ANTIGUO de los cuatro
  // periodos, no el del mes.
  //
  // Antes decia `.gte('created_at', last30d)`, y `last30d` —pese al nombre—
  // es el dia 1 del mes en curso. Consecuencia: al elegir "Este trimestre" o
  // "Este semestre", las tarjetas de XP otorgado y precision de quiz seguian
  // cubriendo solo el mes actual. No fallaba ni avisaba: devolvia un numero
  // mas chico y plausible. El periodo lo elige el cliente, asi que aqui hay
  // que traer el rango completo y dejar que el recorte fino lo haga alla.
  //
  // Se toma el minimo de TODOS los cortes y NO `last6m` a secas: en la
  // madrugada del 1 de enero o del 1 de julio, "ultimas 24h" empieza antes
  // que el semestre. `last7d` entra en el minimo aunque no sea un periodo
  // elegible — "Alumnos activos (7d)" se calcula sobre estas mismas filas, y
  // el 3 de enero los 7 dias se salen por abajo del semestre: sin esto la
  // tarjeta contaria de menos justo despues de cada cambio de semestre.
  //
  // Comparar como texto es correcto porque toISOString() siempre emite UTC
  // con el mismo formato, asi que el orden lexicografico coincide con el
  // cronologico.
  const periodoMasAntiguo = [last24h, last7d, last30d, last3m, last6m].reduce(
    (a, b) => (a < b ? a : b)
  )

  const [
    { data: allUsers },
    { data: allLearners },
    { data: allSubscriptions },
    { data: topicProgressData },
    { data: progressEvents },
    { data: allTopics },
    { data: allSubjects },
    { data: userSubjects },
  ] = await Promise.all([
    // Identidad y conversion: son de la CUENTA, se quedan en `users`.
    // Se cayeron `interests`, `grade`, `xp_total` y `streak_days`: las tres
    // ultimas viajaban por la red sin que nadie las leyera, y las cuatro
    // estan muertas o desincronizadas desde la migracion 035.
    serviceSupabase.from('users').select('id, email, created_at, onboarding_done, is_test'),
    // Todo lo del ALUMNO. Sin filtro por cuenta: el admin las quiere todas,
    // y `account_user_id` viaja como columna para poder agrupar en el cliente.
    serviceSupabase.from('learners').select('id, account_user_id, slot, display_name, is_primary, education_level, grade, theme_id, xp_total, streak_days, last_active_at, status, access_until'),
    serviceSupabase.from('subscriptions').select('id, user_id, plan, status, price_mxn, current_period_end, cancelled_at, created_at, is_test'),
    // `user_id` se conserva junto a `learner_id` a proposito: es lo que
    // permite descartar las filas de cuentas de prueba sin un segundo join.
    serviceSupabase.from('topic_progress').select('user_id, learner_id, topic_id, status, best_score, completed_at, updated_at'),
    serviceSupabase.from('progress').select('user_id, learner_id, event_type, xp_earned, created_at').gte('created_at', periodoMasAntiguo),
    serviceSupabase.from('topics').select('id, name, subject_id, grade'),
    serviceSupabase.from('subjects').select('id, name, slug'),
    serviceSupabase.from('user_subjects').select('user_id, learner_id, subject_id, theme_id, plan_type, xp'),
  ])

  return (
    <MetricasClient
      allUsers={allUsers ?? []}
      allLearners={allLearners ?? []}
      allSubscriptions={allSubscriptions ?? []}
      topicProgressData={topicProgressData ?? []}
      progressEvents={progressEvents ?? []}
      allTopics={allTopics ?? []}
      allSubjects={allSubjects ?? []}
      userSubjects={userSubjects ?? []}
      timestamps={{ last24h, last7d, last30d, last3m, last6m }}
    />
  )
}
