import { NextResponse, type NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

/**
 * Conteos para /onboarding/preview.
 *
 * Corre con service role porque `horde_questions` no tiene RLS para `anon`
 * —protección anti-trampa, no se toca— y la función `preview_stats` tiene
 * EXECUTE revocado a `anon`. El cliente nunca habla con la base.
 *
 * Solo devuelve números. Ningún contenido, ninguna pregunta, ningún nombre de
 * tema. Si alguien llama este endpoint a mano, lo peor que obtiene es saber
 * cuántos ejercicios hay.
 */

const NIVELES = ['middle_school', 'high_school'] as const
type Nivel = (typeof NIVELES)[number]

const leerStats = unstable_cache(
  async (nivel: Nivel, grado: number) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .rpc('preview_stats', { p_nivel: nivel, p_grado: grado })
      .single()

    if (error) {
      console.error('[preview-stats] RPC falló:', error)
      return null
    }
    return data
  },
  ['preview-stats'],
  { revalidate: 3600, tags: ['preview-stats'] }
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nivelRaw = searchParams.get('nivel') ?? ''
  const gradoRaw = Number(searchParams.get('grado'))

  // Validación estricta: solo dos niveles y tres grados existen.
  // Sin esto, cualquiera podría sondear la función con valores arbitrarios.
  if (!NIVELES.includes(nivelRaw as Nivel)) {
    return NextResponse.json({ error: 'nivel inválido' }, { status: 400 })
  }
  if (![1, 2, 3].includes(gradoRaw)) {
    return NextResponse.json({ error: 'grado inválido' }, { status: 400 })
  }

  const stats = await leerStats(nivelRaw as Nivel, gradoRaw)

  if (!stats) {
    // Que falle en silencio: la pantalla simplemente no muestra los números.
    return NextResponse.json({ error: 'sin datos' }, { status: 503 })
  }

  return NextResponse.json(stats)
}
