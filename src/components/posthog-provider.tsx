'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

if (typeof window !== 'undefined') {
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
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname
      if (searchParams?.toString()) url = url + '?' + searchParams.toString()
      ph.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, ph])

  useEffect(() => {
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
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  )
}
