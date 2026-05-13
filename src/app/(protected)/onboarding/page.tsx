import { createClient } from '@/utils/supabase/server'
import OnboardingClient from './onboarding-client'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Create anonymous session if no user exists yet
  const { data: { user } } = await supabase.auth.getUser()
  // signInAnonymously is called proactively from landing-client.tsx
  // This is only a fallback in case the user navigates directly to /onboarding
  if (!user) {
    await supabase.auth.signInAnonymously()
  }

  const { data: themes } = await supabase
    .from('themes')
    .select('id, name, description, icon, subtitle')
    .eq('active', true)
    .order('created_at', { ascending: true })

  return <OnboardingClient themes={themes ?? []} />
}
