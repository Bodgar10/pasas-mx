/**
 * seasonal-mode.ts
 * Retorna el modo estacional actual basado en el calendario SEP México.
 * Hardcoded por ciclo escolar 2026-2027 y 2027-2028.
 */

export type SeasonalMode = 'school' | 'winter_break' | 'summer_break'

interface DateRange {
  start: string // MM-DD
  end: string   // MM-DD
}

// Periodos de vacaciones SEP (aproximados, ajustar cada ciclo)
const WINTER_BREAKS: DateRange[] = [
  { start: '12-20', end: '01-08' }, // Vacaciones de invierno
]

const SUMMER_BREAKS: DateRange[] = [
  { start: '06-01', end: '08-20' }, // Vacaciones de verano
]

function isInRange(date: Date, range: DateRange): boolean {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const current = `${month}-${day}`

  // Manejar rangos que cruzan año (ej. 12-20 al 01-08)
  if (range.start > range.end) {
    return current >= range.start || current <= range.end
  }
  return current >= range.start && current <= range.end
}

export function getSeasonalMode(date: Date = new Date()): SeasonalMode {
  for (const range of WINTER_BREAKS) {
    if (isInRange(date, range)) return 'winter_break'
  }
  for (const range of SUMMER_BREAKS) {
    if (isInRange(date, range)) return 'summer_break'
  }
  return 'school'
}

export function isVacationMode(date: Date = new Date()): boolean {
  const mode = getSeasonalMode(date)
  return mode === 'winter_break' || mode === 'summer_break'
}

export function isWinterBreak(date: Date = new Date()): boolean {
  return getSeasonalMode(date) === 'winter_break'
}

export function isSummerBreak(date: Date = new Date()): boolean {
  return getSeasonalMode(date) === 'summer_break'
}

export function getSeasonalLabel(date: Date = new Date()): string {
  const mode = getSeasonalMode(date)
  const labels: Record<SeasonalMode, string> = {
    school: 'Ciclo escolar',
    winter_break: 'Modo Vacaciones',
    summer_break: 'Modo Verano',
  }
  return labels[mode]
}
