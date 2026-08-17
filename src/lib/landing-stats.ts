import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

/**
 * CONTEOS GLOBALES DEL CATÁLOGO — FUENTE ÚNICA DE LA LANDING
 * ---------------------------------------------------------------------------
 * Nueve cifras que estaban escritas a mano en landing-client.tsx y envejecían
 * en silencio. El caso que lo destapó: "4,070 audios" contra 6,234 reales, un
 * 35% por debajo. Antes había pasado con "676 ejercicios", que era el conteo
 * de otra cosa medido meses atrás.
 *
 * 🔴 CADA CIFRA EN LA UNIDAD QUE LA UI NUMERA, y no es la misma para todos los
 * tipos de sección. Verificado bloque por bloque en InteractiveBlocks.tsx:
 *
 *   solve     → "Ejercicio 1 de 3"  → se cuentan PREGUNTAS (data->questions)
 *   match     → "3 / 4 parejas"     → una sección es una partida
 *   steps     → "Paso 2 de 5"       → una sección es una secuencia
 *   scrubber  → (no numera)         → una sección es un simulador
 *   sort      → (no numera)         → una sección es una clasificación
 *
 * La función `landing_stats()` (migración 044) ya devuelve cada una en su
 * unidad. Aquí no se recalcula nada: si un número se ve raro, se arregla en la
 * migración, no en TypeScript.
 *
 * Corre con service role: `landing_stats` tiene EXECUTE revocado a `anon`,
 * igual que `preview_stats`. El cliente nunca habla con la base.
 *
 * `server-only` convierte en error de build cualquier import desde un
 * componente de cliente: aquí dentro está la service role key.
 */

export type LandingStats = {
  materias: number
  temas: number
  horda_temas: number
  horda_preguntas: number
  /** PREGUNTAS de Papel y Lápiz, no secciones. */
  papel_lapiz: number
  audios: number
  memoramas: number
  simuladores: number
  secuencias: number
  clasificaciones: number
}

/**
 * 🔴 MISMO PATRÓN QUE preview-stats.ts, con tag propio para poder invalidar
 * uno sin tumbar el otro.
 *
 * TTL de 3600 combinado con `export const revalidate = 3600` en la página: la
 * landing sigue siendo HTML estático servido desde CDN —no paga render por
 * visita, que en la página más visitada era el argumento decisivo— y se
 * regenera en segundo plano cada hora. La RPC medida tarda ~250ms, y ese coste
 * lo paga la regeneración, no el visitante.
 */
export const leerLandingStats = unstable_cache(
  async (): Promise<LandingStats | null> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase.rpc('landing_stats').single<LandingStats>()

    if (error) {
      console.error('[landing-stats] RPC falló:', error)
      return null
    }
    return data
  },
  ['landing-stats'],
  { revalidate: 3600, tags: ['landing-stats'] }
)
