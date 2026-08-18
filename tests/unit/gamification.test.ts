import { describe, it, expect } from 'vitest'
import { xpToLevel, levelProgress, XP_PER_LEVEL } from '@/lib/gamification'

/**
 * U7 — El sistema de niveles.
 *
 * La constante 500 vivía repetida en cuatro sitios de dashboard-client antes
 * de mudarse aquí. Fijar la fórmula impide que vuelva a haber dos versiones:
 * un alumno que ve "nivel 3" en el dashboard y "nivel 2" en la barra de
 * materia no reporta un bug, asume que perdió su avance.
 */

describe('xpToLevel', () => {
  it('0 XP: nivel 1, barra vacía', () => {
    expect(xpToLevel(0)).toEqual({ level: 1, current: 0, total: 500, progress: 0 })
  })

  it('499 XP: todavía nivel 1, con la barra casi llena', () => {
    expect(xpToLevel(499)).toEqual({ level: 1, current: 499, total: 500, progress: 0.998 })
  })

  it('🔴 500 XP exactos: sube a nivel 2 y la barra se reinicia en 0', () => {
    // El borde. Un `>=` mal puesto aquí deja al alumno atorado en nivel 1 con
    // la barra llena, o lo sube un nivel antes de tiempo.
    expect(xpToLevel(500)).toEqual({ level: 2, current: 0, total: 500, progress: 0 })
    expect(xpToLevel(1000)).toEqual({ level: 3, current: 0, total: 500, progress: 0 })
  })

  it('XP negativo: se satura en 0, no produce un nivel 0 ni negativo', () => {
    expect(xpToLevel(-250)).toEqual({ level: 1, current: 0, total: 500, progress: 0 })
  })

  it('null o undefined: se trata como 0', () => {
    // La firma pide number, pero el cuerpo hace `xp ?? 0` a propósito: el
    // valor llega de la base y puede venir nulo.
    expect(xpToLevel(null as unknown as number)).toEqual({ level: 1, current: 0, total: 500, progress: 0 })
    expect(xpToLevel(undefined as unknown as number)).toEqual({ level: 1, current: 0, total: 500, progress: 0 })
  })

  it('el tamaño del nivel es la constante exportada, no un 500 escrito a mano', () => {
    expect(XP_PER_LEVEL).toBe(500)
    expect(xpToLevel(123).total).toBe(XP_PER_LEVEL)
  })
})

describe('levelProgress', () => {
  it('devuelve el avance dentro del nivel actual, siempre entre 0 y 1', () => {
    expect(levelProgress(0)).toBe(0)
    expect(levelProgress(250)).toBe(0.5)
    expect(levelProgress(499)).toBe(0.998)
    // Al cruzar el nivel, la barra de materia vuelve a empezar.
    expect(levelProgress(500)).toBe(0)
    expect(levelProgress(750)).toBe(0.5)
  })

  it('nunca pasa de 1, ni siquiera con valores absurdos', () => {
    // El Math.min es defensivo: el módulo ya garantiza < 500. Se prueba para
    // que siga siendo cierto si algún día cambia la fórmula.
    expect(levelProgress(999_999)).toBeLessThanOrEqual(1)
    expect(levelProgress(-100)).toBe(0)
  })
})
