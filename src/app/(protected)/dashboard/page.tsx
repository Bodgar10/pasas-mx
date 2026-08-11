import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import DashboardClient from './dashboard-client'
import { xpToLevel } from '@/lib/gamification'
import { resolveLearner, getAccountLearners } from '@/lib/learners'
import { cicloActual, enVentanaPromocion, siguienteGrado } from '@/lib/ciclo-escolar'

/** Etiqueta legible del grado en curso, para el copy del modal. */
const NIVEL_ETIQUETA: Record<string, string> = {
  middle_school: 'Secundaria',
  high_school: 'Preparatoria',
}

export type SubscriptionStatus = 'no_subscription' | 'expired' | 'active'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile and active subscription in parallel — both only need user.id
  const now = new Date().toISOString()
  const [{ data: profile }, learner, { data: subscription }, todosLosAlumnos] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, onboarding_done, interests')
      .eq('id', user.id)
      .single(),
    resolveLearner(supabase, user.id, sp),
    supabase
      .from('subscriptions')
      .select('status, current_period_end, plan, trial_ends_at, cancelled_at, billing_cycle, paused_until')
      .eq('user_id', user.id)
      .in('status', ['trialing', 'active', 'past_due', 'paused'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAccountLearners(supabase, user.id),
  ])

  // 🔴 La MISMA derivación que hace el middleware. No leer el flag a secas.
  //
  // `onboarding_done` es una caché que puede nacer en false aunque los datos
  // estén completos. Cuando este guardia leía solo el flag y el middleware
  // sí derivaba, los dos discrepaban y el usuario rebotaba entre /dashboard
  // y /onboarding sin fin: el middleware lo dejaba pasar, esta línea lo
  // devolvía, y vuelta a empezar.
  //
  // Si algún día cambia la regla, cambia en los DOS sitios.
  const datosCompletos = !!learner?.education_level && learner?.grade != null

  // `!profile` va aparte y NO forma parte de la derivacion: la regla de
  // `datosCompletos` tiene que seguir siendo identica a la del middleware,
  // o los dos discrepan y vuelve el bucle entre /dashboard y /onboarding.
  //
  // Sin fila en `users` no hay nombre ni consentimiento registrado, asi que
  // el dashboard no deberia pintarse aunque el alumno este completo.
  if (!profile || (!profile.onboarding_done && !datosCompletos)) redirect('/onboarding')

  // Determine subscription status
  let subscriptionStatus: SubscriptionStatus = 'no_subscription'
  if (subscription) {
    const isActive = new Date(subscription.current_period_end) > new Date(now)
    subscriptionStatus = isActive ? 'active' : 'expired'
  }

  // Check if there's any past subscription (for expired state)
  let hasEverSubscribed = false
  if (subscriptionStatus === 'no_subscription') {
    const { data: pastSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    hasEverSubscribed = !!pastSub
    if (hasEverSubscribed) subscriptionStatus = 'expired'
  }

  // Cache subjects — they rarely change, safe to cache 5 minutes
  const getCachedSubjects = unstable_cache(
    async (educationLevel: string, grade: number) => {
      const { data } = await supabase
        .from('subjects')
        .select('id, slug, name, display_order')
        .eq('education_level', educationLevel)
        .contains('grades', [grade])
        .order('display_order')
      return data ?? []
    },
    [`subjects-${learner?.education_level}-${learner?.grade}`],
    { revalidate: 300, tags: ['subjects'] }
  )

  // Fetch user-specific data + cached subjects in parallel
  const [
    subjects,
    { data: userSubjects },
    { data: lastActiveRows, error: lastActiveError },
    { data: temaDelAlumno },
  ] = await Promise.all([
    getCachedSubjects(learner?.education_level ?? 'middle_school', learner?.grade ?? 1),
    supabase.from('user_subjects').select('subject_id, xp, theme_id').eq('learner_id', learner?.id ?? ''),
    supabase.rpc('get_last_active_topic', { p_learner_id: learner?.id ?? null }),
    // La tematica vive en el ALUMNO. `users.interests` es de la cuenta y
    // pintaba la del titular en el dashboard de todos.
    learner?.theme_id
      ? supabase.from('themes').select('name').eq('id', learner.theme_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (lastActiveError) {
    console.error('[dashboard] get_last_active_topic fallo:', lastActiveError)
  }

  const lastActiveRow = lastActiveRows?.[0] ?? null
  const lastActiveTopic: {
    topicName: string
    topicSlug: string
    subjectName: string
    subjectSlug: string
  } | null = lastActiveRow
    ? {
        topicName: lastActiveRow.topic_name,
        topicSlug: lastActiveRow.topic_slug,
        subjectName: lastActiveRow.subject_name,
        subjectSlug: lastActiveRow.subject_slug,
      }
    : null

  // Aviso de cambio de grado. Solo dentro de la ventana julio-septiembre,
  // una vez por ciclo escolar, si hay un grado siguiente dentro de la
  // plataforma y la suscripcion esta activa: no se le propone un tramite
  // a quien no puede usarlo.
  const siguiente = siguienteGrado(learner?.education_level ?? null, learner?.grade ?? null)
  const promocion =
    learner &&
    siguiente &&
    subscriptionStatus === 'active' &&
    enVentanaPromocion() &&
    learner.promocion_vista_ciclo !== cicloActual()
      ? {
          learnerId: learner.id,
          learnerName: learner.display_name,
          gradoActual: `${learner.grade}° de ${NIVEL_ETIQUETA[learner.education_level ?? ''] ?? ''}`.trim(),
          siguiente,
        }
      : null

  const isPaused = subscription?.status === 'paused'
  const isPersonalized = subscription?.plan === 'ai_personalized' && subscriptionStatus === 'active' && !isPaused
  const trialEndsAt = subscription?.trial_ends_at ?? null
  const isCancelled = !!subscription?.cancelled_at
  const periodEnd = subscription?.current_period_end ?? null
  const billingCycle = subscription?.billing_cycle ?? null
  const pausedUntil = subscription?.paused_until ?? null

  return (
    <DashboardClient
      levelUp={
        xpToLevel(learner?.xp_total ?? 0).level > (learner?.last_level_seen ?? 1)
          ? {
              from: learner?.last_level_seen ?? 1,
              to: xpToLevel(learner?.xp_total ?? 0).level,
            }
          : null
      }
      profile={{
        name: learner?.display_name ?? profile.full_name ?? user.email?.split('@')[0] ?? 'Estudiante',
        xp_total: learner?.xp_total ?? 0,
        streak_days: learner?.streak_days ?? 0,
        education_level: learner?.education_level ?? null,
        grade: learner?.grade ?? null,
        // El respaldo a `users.interests` es para el alumno primario de
        // cuentas viejas, cuyo theme_id puede estar en null porque el
        // onboarding guardaba el NOMBRE ahi y no el uuid.
        interests: temaDelAlumno?.name ? [temaDelAlumno.name] : ((profile.interests as string[] | null) ?? []),
      }}
      subscriptionStatus={subscriptionStatus}
      totalLearners={todosLosAlumnos.length}
      learners={todosLosAlumnos}
      activeSlot={learner?.slot ?? 1}
      promocion={promocion}
      subjects={subjects ?? []}
      userSubjects={userSubjects ?? []}
      lastActiveTopic={lastActiveTopic}
      isPersonalized={isPersonalized}
      trialEndsAt={trialEndsAt}
      isCancelled={isCancelled}
      periodEnd={periodEnd}
      billingCycle={billingCycle}
      isPaused={isPaused}
      pausedUntil={pausedUntil}
    />
  )
}
