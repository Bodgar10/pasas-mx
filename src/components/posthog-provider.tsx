'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { COOKIE_CONSENT_EVENT, permiteAnalytics } from '@/lib/consent'

/**
 * 🔴 El init NO puede volver al ámbito del módulo.
 *
 * Antes corría con solo importar el archivo, antes de que montara nada,
 * así que era imposible condicionarlo al consentimiento. Ahora vive en
 * un efecto que solo corre si la persona aceptó "Análisis de uso".
 *
 * Esto importa más aquí que en GA4 o Clarity: PostHog GRABA SESIONES,
 * y una parte de los usuarios son menores de edad.
 *
 * Consecuencia asumida: quien rechaza no se mide. Los 18 eventos y los
 * funnels dejan de cubrir el 100% del tráfico.
 *
 * `iniciado` es de MÓDULO, no de instancia: así Strict Mode en desarrollo
 * no dispara dos init. El costo es que quien acepta y luego revoca sigue
 * capturado hasta que recargue la página — misma limitación que GA4 y
 * Clarity. Revocar surte efecto en la siguiente carga.
 */
let iniciado = false

function iniciarPostHog() {
  if (iniciado || typeof window === 'undefined') return
  if (!permiteAnalytics()) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
  })
  iniciado = true
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (iniciado && pathname && ph) {
      let url = window.origin + pathname
      if (searchParams?.toString()) url = url + '?' + searchParams.toString()
      ph.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, ph])

  useEffect(() => {
    // Sin consentimiento no se ejecuta nada de esto. La guarda va ANTES
    // de createClient(), no dentro del .then(): más abajo ya se habrían
    // disparado getUser() y las dos consultas a `users` y `subscriptions`
    // de alguien que dijo que no.
    if (!iniciado) return

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user && ph) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, education_level, grade, interests, xp_total, streak_days')
          .eq('id', user.id)
          .single()

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('current_period_end', { ascending: false })
          .limit(1)
          .maybeSingle()

        ph.identify(user.id, {
          email: user.email,
          created_at: user.created_at,
          name: profile?.full_name ?? '',
          education_level: profile?.education_level ?? '',
          grade: profile?.grade ?? null,
          theme: (profile?.interests as string[] | null)?.[0] ?? '',
          xp_total: profile?.xp_total ?? 0,
          streak_days: profile?.streak_days ?? 0,
          plan: subscription?.plan ?? 'no_subscription',
          subscription_status: subscription?.status ?? 'none',
        })
      }
    })
  }, [ph])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    iniciarPostHog()
    const alCambiar = () => iniciarPostHog()
    window.addEventListener(COOKIE_CONSENT_EVENT, alCambiar)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, alCambiar)
  }, [])

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  )
}
