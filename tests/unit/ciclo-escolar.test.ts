import { describe, it, expect } from 'vitest'
import { cicloActual, enVentanaPromocion, siguienteGrado } from '@/lib/ciclo-escolar'

/**
 * U8 — El calendario escolar mexicano.
 *
 * Las tres funciones aceptan la fecha como parámetro, así que se prueban sin
 * relojes falsos ni mocks: se les pasa el día exacto de cada frontera. Ese
 * diseño es lo que las hace baratas de probar, y conviene que siga así.
 *
 * `new Date(año, mes, día)` construye en hora local, igual que el
 * `new Date()` que usan por defecto. Los meses van de 0 a 11.
 */

describe('cicloActual', () => {
  it('🔴 frontera de julio a agosto: el ciclo cambia el día 1 de agosto', () => {
    // El ciclo escolar va de agosto a julio. En julio todavía se pertenece al
    // ciclo que arrancó el agosto anterior.
    expect(cicloActual(new Date(2026, 6, 31))).toBe('2025-2026') // 31 de julio
    expect(cicloActual(new Date(2026, 7, 1))).toBe('2026-2027') //  1 de agosto
  })

  it('de agosto a diciembre pertenece al ciclo que inicia ese año', () => {
    expect(cicloActual(new Date(2026, 11, 15))).toBe('2026-2027')
  })

  it('de enero a julio pertenece al ciclo que inició el año anterior', () => {
    expect(cicloActual(new Date(2027, 0, 15))).toBe('2026-2027')
    expect(cicloActual(new Date(2027, 5, 30))).toBe('2026-2027')
  })
})

describe('enVentanaPromocion', () => {
  it('🔴 los cuatro bordes: se abre el 1 de julio y se cierra el 30 de septiembre', () => {
    // En junio todavía están en clases; después de septiembre el año ya
    // arrancó y proponer el cambio de grado confunde.
    expect(enVentanaPromocion(new Date(2026, 5, 30))).toBe(false) // 30 de junio
    expect(enVentanaPromocion(new Date(2026, 6, 1))).toBe(true) //   1 de julio
    expect(enVentanaPromocion(new Date(2026, 8, 30))).toBe(true) // 30 de septiembre
    expect(enVentanaPromocion(new Date(2026, 9, 1))).toBe(false) //  1 de octubre
  })

  it('en pleno ciclo escolar está cerrada', () => {
    expect(enVentanaPromocion(new Date(2027, 1, 15))).toBe(false)
  })
})

describe('siguienteGrado', () => {
  it('dentro de secundaria avanza un grado', () => {
    expect(siguienteGrado('middle_school', 1)).toEqual({
      education_level: 'middle_school',
      grade: 2,
      etiqueta: '2° de Secundaria',
    })
  })

  it('🔴 3° de secundaria salta de NIVEL, no solo de grado', () => {
    expect(siguienteGrado('middle_school', 3)).toEqual({
      education_level: 'high_school',
      grade: 1,
      etiqueta: '1° de Preparatoria',
    })
  })

  it('dentro de preparatoria avanza un grado', () => {
    expect(siguienteGrado('high_school', 2)).toEqual({
      education_level: 'high_school',
      grade: 3,
      etiqueta: '3° de Preparatoria',
    })
  })

  it('🔴 3° de preparatoria: null — no hay a dónde promoverlo dentro de la plataforma', () => {
    // Quien termina prepa se va a la universidad y ahí no hay contenido.
    // Devolver un 4° de prepa inexistente le dejaría el catálogo vacío.
    expect(siguienteGrado('high_school', 3)).toBeNull()
  })

  it('nivel o grado ausentes: null', () => {
    expect(siguienteGrado(null, 2)).toBeNull()
    expect(siguienteGrado('middle_school', null)).toBeNull()
    expect(siguienteGrado('universidad', 1)).toBeNull()
  })
})
