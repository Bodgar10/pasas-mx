import { createClient as createServiceClient } from '@supabase/supabase-js'
import OnboardingClient from './onboarding-client'

export default async function OnboardingPage() {
  // Use service role to read themes — public data, no auth needed
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
