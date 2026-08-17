import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

/**
 * CONTEOS DE /onboarding/preview — FUENTE ÚNICA
 * ---------------------------------------------------------------------------
 * Vivía dentro de api/preview-stats/route.ts. Se sacó aquí para que el server
 * component de la página pueda llamarla DIRECTO, sin hacerse un fetch a su
 * propio origen: un salto de red contra ti mismo que además obligaba a
 * esperar a la hidratación del cliente para empezar a pedir.
 *
 * 🔴 El endpoint NO desapareció ni cambió su contrato. Sigue existiendo con la
 * misma URL, los mismos parámetros y las mismas respuestas; ahora consume esta
 * función en vez de tener la suya. Puede haber algo llamándolo.
 *
 * Corre con service role porque `horde_questions` no tiene RLS para `anon`
 * —protección anti-trampa, no se toca— y la función `preview_stats` tiene
 * EXECUTE revocado a `anon`. El cliente nunca habla con la base.
 *
 * `server-only` convierte en error de build cualquier import desde un
 * componente de cliente: aquí dentro está la service role key.
 */

export const NIVELES = ['middle_school', 'high_school'] as const
export type Nivel = (typeof NIVELES)[number]

export const GRADOS = [1, 2, 3] as const

export type Stats = {
  materias: number
  temas: number
  bloques_leccion: number
  interactivos: number
  papel_lapiz: number
  audios: number
  horda_temas: number
  horda_preguntas: number
}

export function esNivel(valor: string): valor is Nivel {
  return (NIVELES as readonly string[]).includes(valor)
}

export function esGrado(valor: number): boolean {
  return (GRADOS as readonly number[]).includes(valor)
}

/**
 * 🔴 LA CACHÉ ES LO QUE HACE VIABLE ESTO. Medido en `next start`: la primera
 * llamada de cada combinación tarda ~930ms y las siguientes ~5ms. Con
 * `revalidate: 3600` y solo 6 combinaciones posibles (2 niveles × 3 grados),
 * el coste total es de 6 misses por hora, no uno por visita.
 *
 * La clave NO es solo `['preview-stats']`: la doc de Next 16 lo dice en
 * unstable_cache.md — "already uses the arguments and the stringified version
 * of your function as the cache key". El array es un sufijo. Verificado
 * midiendo: cada par (nivel, grado) tiene su propio miss y su propio valor.
 *
 * TTL y clave se conservan tal cual estaban en el route handler. Cambiarlos
 * aquí cambia el comportamiento de las dos puertas a la vez.
 */
export const leerStats = unstable_cache(
  async (nivel: Nivel, grado: number): Promise<Stats | null> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .rpc('preview_stats', { p_nivel: nivel, p_grado: grado })
      .single<Stats>()

    if (error) {
      console.error('[preview-stats] RPC falló:', error)
      return null
    }
    return data
  },
  ['preview-stats'],
  { revalidate: 3600, tags: ['preview-stats'] }
)

/**
 * ¿Estos números merecen pintarse?
 *
 * 🔴 Cero temas NO se pinta. Una tarjeta que promete "lo que vas a encontrar"
 * y enseña ceros vende en contra: es exactamente el vacío que preview_stats
 * vino a tapar en s26. Se trata igual que un fallo de lectura — se oculta el
 * bloque entero.
 *
 * Vive aquí y no en la página para que el endpoint y el server component
 * apliquen el mismo criterio.
 */
export function statsUtilizables(stats: Stats | null): stats is Stats {
  return !!stats && Number(stats.temas) > 0
}
