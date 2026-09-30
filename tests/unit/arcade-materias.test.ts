import { describe, it, expect } from 'vitest'
import { configMateria, materiaDelDia, materiaDeManana } from '@/lib/arcade/materias'

/** Espejo de arcade_materia_del_dia (056). Si falla, la base y la app dicen cosas distintas. */
describe('calendario de materias', () => {
  it('cada día de la semana su materia', () => {
    expect(materiaDelDia('2026-10-05')).toBe('historia') // lunes
    expect(materiaDelDia('2026-10-06')).toBe('biologia') // martes
    expect(materiaDelDia('2026-10-07')).toBe('geografia') // miércoles
    expect(materiaDelDia('2026-10-08')).toBe('ciencias') // jueves
    expect(materiaDelDia('2026-10-09')).toBe('espanol') // viernes
    expect(materiaDelDia('2026-10-10')).toBe('papas') // sábado
    expect(materiaDelDia('2026-10-11')).toBe('historia') // domingo
  })
  it('mañana', () => {
    expect(materiaDeManana('2026-10-05')).toBe('biologia')
    expect(materiaDeManana('2026-10-11')).toBe('historia')
  })
  it('materia desconocida cae a historia', () => {
    expect(configMateria('xyz').nombre).toBe('Historia')
    expect(configMateria(null).nombre).toBe('Historia')
  })
})
