import { Suspense } from 'react'
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

  /**
   * 🔴 EL <Suspense> ES OBLIGATORIO, NO DECORATIVO.
   *
   * OnboardingClient llama a useSearchParams (reenvía el ?promo= al siguiente
   * paso). Esta ruta se prerenderiza, y sin boundary propio `next build` falla
   * con "Missing Suspense boundary with useSearchParams".
   *
   * Antes lo cubría el <Suspense> del layout raíz, el mismo que dejaba el HTML
   * de TODO el sitio vacío. Al partirlo, esta ruta se quedó sin red y necesita
   * la suya.
   *
   * `fallback={null}`, no un esqueleto: así el comportamiento de /onboarding
   * queda EXACTAMENTE igual que antes —HTML inicial vacío, render en cliente—
   * en vez de introducir un estado de carga que nunca existió. Es una pantalla
   * del embudo tras la landing, no una página que Google deba leer; de hecho
   * lleva noindex.
   */
  return (
    <Suspense fallback={null}>
      <OnboardingClient themes={themes ?? []} />
    </Suspense>
  )
}
