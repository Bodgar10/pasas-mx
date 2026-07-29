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
