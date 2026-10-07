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

/**
 * s39 — El reto más reciente de una materia (hoy o hasta 7 días atrás). Lo usa
 * /arcade?materia=historia: quien llega de un anuncio de Historia juega
 * Historia aunque hoy toque otra materia. null si no hay ninguno o si la
 * materia no existe; la página cae entonces al reto de hoy.
 */
export async function leerRetoDeMateria(materia: string): Promise<RetoArcade | null> {
  const { data, error } = await admin().rpc('arcade_reto_materia', { p_materia: materia })
  if (error) {
    console.error('[arcade] arcade_reto_materia falló:', error)
    return null
  }
  return (data as RetoArcade | null) ?? null
}

/** Canal y UTMs de primer contacto (lib/arcade/canal.ts). La base valida los valores. */
export type AtribucionServidor = {
  canal: string | null
  utm_source: string | null
  utm_campaign: string | null
}

/**
 * 🔴 Firma nueva (migración 053) con reintento a la vieja (052). El deploy
 * puede llegar antes de que se aplique la 053: sin el reintento, PostgREST
 * responde PGRST202 ("no existe una función con esos parámetros") y la
 * partida NO se guardaría. Con él, se guarda sin canal hasta que se aplique.
 */
export function faltaFirmaNueva(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === 'PGRST202' || /Could not find the function/i.test(error.message ?? ''))
}

/** Registra la partida (idempotente por día y navegador) y devuelve las cifras del día. */
export async function registrarPartida(
  fecha: string,
  anonId: string,
  picks: number[],
  origen: string | null = null,
  atribucion: AtribucionServidor | null = null
): Promise<CifrasArcade | null> {
  const base = { p_date: fecha, p_anon_id: anonId, p_picks: picks, p_origen: origen }
  let { data, error } = await admin().rpc('arcade_registrar', {
    ...base,
    p_canal: atribucion?.canal ?? null,
    p_utm_source: atribucion?.utm_source ?? null,
    p_utm_campaign: atribucion?.utm_campaign ?? null,
  })
  if (faltaFirmaNueva(error)) {
    ;({ data, error } = await admin().rpc('arcade_registrar', base))
  }
  if (error) {
    console.error('[arcade] arcade_registrar falló:', error)
    return null
  }
  return (data as CifrasArcade | null) ?? null
}
