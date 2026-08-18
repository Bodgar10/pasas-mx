import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { trackServer } from '@/lib/analytics/track-server'

/**
 * Banco de pruebas del transporte de servidor. TEMPORAL.
 *
 * 🔴 404 en produccion. Dispara un evento real contra PostHog, asi que
 * dejarla abierta seria dejar que cualquiera ensucie el proyecto.
 *
 * Para quitarlo: borrar la carpeta `src/app/dev/`. No lo importa nadie.
 *
 * El `distinct_id` sale de la sesion activa, no de un valor inventado: es lo
 * que permite comprobar que un evento de servidor y uno de navegador de la
 * MISMA persona caen en el mismo perfil de PostHog. Con `?distinct_id=` se
 * puede forzar otro para probar el caso contrario.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 })
  }

  const url = new URL(request.url)
  const forzado = url.searchParams.get('distinct_id')

  let userId = forzado ?? undefined
  if (!userId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  const resultado = await trackServer(
    'test_pipeline_servidor',
    { origen: 'ruta_dev' },
    {
      // Consentimiento explicito: este arnes no lee el banner porque corre
      // sin navegador. `marketing: false` a proposito — el evento no esta en
      // MAPEO_META ni en MAPEO_TIKTOK, asi que no habria a donde mandarlo.
      consent: { analytics: true, marketing: false },
      userId,
    }
  )

  return NextResponse.json({
    ...resultado,
    distinct_id_usado: userId ?? null,
    pista: userId
      ? 'Busca test_pipeline_servidor en PostHog y compara el distinct_id con el de un evento del navegador.'
      : 'Sin sesion: PostHog se salta con posthog:sin-user-id. Inicia sesion o usa ?distinct_id=...',
  })
}
