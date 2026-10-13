import { describe, expect, it } from 'vitest'
import { normalizarMateria } from '@/lib/arcade/alias-materia'

describe('normalizarMateria', () => {
  it('acepta acentos, mayúsculas y sinónimos', () => {
    expect(normalizarMateria('Historia')).toBe('historia')
    expect(normalizarMateria('biolog%C3%ADa')).toBe('biologia')
    expect(normalizarMateria('Química')).toBe('ciencias')
    expect(normalizarMateria('español')).toBe('espanol')
  })
  it('lo que no es materia es null', () => {
    expect(normalizarMateria('{{materia}}')).toBeNull()
    expect(normalizarMateria('')).toBeNull()
  })
})
