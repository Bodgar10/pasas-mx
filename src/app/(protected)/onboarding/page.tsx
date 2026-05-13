import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import OnboardingClient from './onboarding-client'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Create anonymous session if no user exists yet
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await supabase.auth.signInAnonymously()
  }

  // Use service role to read themes — they are public data, RLS should not block them
  // This fixes the issue where anonymous sessions cannot read themes due to RLS
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: themes } = await serviceClient
    .from('themes')
    .select('id, name, description, icon, subtitle')
    .eq('active', true)
    .order('created_at', { ascending: true })

  return <OnboardingClient themes={themes ?? []} />
}
