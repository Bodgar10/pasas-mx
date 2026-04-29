import { createClient } from '@/utils/supabase/server'
import OnboardingClient from './onboarding-client'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: themes } = await supabase
    .from('themes')
    .select('id, name, description, icon, subtitle')
    .eq('active', true)
    .order('created_at', { ascending: true })

  return <OnboardingClient themes={themes ?? []} />
}
