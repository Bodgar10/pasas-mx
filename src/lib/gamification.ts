/**
 * FUENTE UNICA DE VERDAD del sistema de niveles.
 *
 * Antes vivia inline en dashboard-client.tsx y la constante 500 estaba
 * repetida en 3 lugares mas del mismo archivo. Si se cambia el tamano del
 * nivel, se cambia AQUI y aplica en todos lados.
 *
 * NUNCA hardcodear 500 ni la formula de nivel en un componente.
 */

export const XP_PER_LEVEL = 500

export interface LevelInfo {
  level: number
  current: number
  total: number
  progress: number
}

export function xpToLevel(xp: number): LevelInfo {
  const safe = Math.max(0, xp ?? 0)
  const level = Math.floor(safe / XP_PER_LEVEL) + 1
  const current = safe % XP_PER_LEVEL
  return {
    level,
    current,
    total: XP_PER_LEVEL,
    progress: current / XP_PER_LEVEL,
  }
}

/** Progreso 0-1 dentro del nivel actual. Para barras de materia. */
export function levelProgress(xp: number): number {
  return Math.min((Math.max(0, xp ?? 0) % XP_PER_LEVEL) / XP_PER_LEVEL, 1)
}

// ─────────────────────────────────────────────────────────────────────────
// RACHAS — s33
//
// 🔴 La racha se ESCRIBE en la base (trigger `learner_activity_from_progress`,
// migración 050) y se LEE con estas dos funciones. Nunca al revés: el trigger
// no puede saber qué día es cuando nadie estudia, así que `streak_days` de
// una cuenta abandonada se queda para siempre en el último valor que tuvo.
//
// Sin la regla de lectura, un alumno que se fue hace tres meses sigue viendo
// "12 días de racha" y el admin lo cuenta como racha viva. El número no está
// mal guardado: está muerto, y quien lo pinta es quien tiene que saberlo.
// ─────────────────────────────────────────────────────────────────────────

const ZONA_MEXICO = 'America/Mexico_City'

/**
 * Día calendario en hora de México, como 'YYYY-MM-DD'.
 *
 * La misma zona que usa el trigger. Con UTC —lo que hacía el código viejo—
 * todo lo que ocurre después de las 18:00 de México cuenta como el día
 * siguiente, así que una sesión a las 19:00 y otra a las 21:00 del mismo día
 * podían caer en días distintos y regalar un día de racha.
 */
export function diaMexico(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (Number.isNaN(d.getTime())) return null
  // 'en-CA' da exactamente YYYY-MM-DD, que es comparable como texto.
  return d.toLocaleDateString('en-CA', { timeZone: ZONA_MEXICO })
}

/**
 * La racha que se le puede enseñar a alguien sin mentirle.
 *
 * `streak_days` tal cual es el último valor alcanzado, no el vigente. Vale
 * solo si la última actividad fue HOY o AYER en hora de México; con más
 * hueco, la racha está rota y lo honesto es un 0.
 *
 * Un solo helper para las tres pantallas que la pintan (dashboard, perfil,
 * admin): repartida, se arregla en una y se queda mintiendo en las otras.
 */
export function rachaVisible(
  streakDays: number | null | undefined,
  lastActiveAt: string | Date | null | undefined
): number {
  const racha = streakDays ?? 0
  if (racha <= 0) return 0

  const ultimo = diaMexico(lastActiveAt)
  if (!ultimo) return 0

  const hoy = diaMexico(new Date())
  if (!hoy) return racha

  const ayer = diaMexico(new Date(Date.now() - 24 * 60 * 60 * 1000))
  return ultimo === hoy || ultimo === ayer ? racha : 0
}
