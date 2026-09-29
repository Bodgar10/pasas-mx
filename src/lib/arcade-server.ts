import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { CifrasArcade, RetoArcade } from '@/lib/arcade'

/**
 * Acceso a la base del Arcade. Service role porque las tablas no tienen
 * políticas para anon y las funciones tienen EXECUTE revocado (migración
 * 051): el navegador nunca habla con la base y no puede leer retos futuros.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * El reto de hoy. Si hoy no existe, la base lo arma en ese momento; si no
 * puede, devuelve el más reciente. null solo si el banco está vacío.
 */
export async function leerRetoDeHoy(): Promise<RetoArcade | null> {
  const { data, error } = await admin().rpc('arcade_reto')
  if (error) {
    console.error('[arcade] arcade_reto falló:', error)
    return null
  }
  return (data as RetoArcade | null) ?? null
}

/** Registra la partida (idempotente por día y navegador) y devuelve las cifras del día. */
export async function registrarPartida(
  fecha: string,
  anonId: string,
  picks: number[]
): Promise<CifrasArcade | null> {
  const { data, error } = await admin().rpc('arcade_registrar', {
    p_date: fecha,
    p_anon_id: anonId,
    p_picks: picks,
  })
  if (error) {
    console.error('[arcade] arcade_registrar falló:', error)
    return null
  }
  return (data as CifrasArcade | null) ?? null
}
