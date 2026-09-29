import { describe, it, expect } from 'vitest'
import {
  calcularResultados,
  codigoResultado,
  etiquetaPuntaje,
  leerCodigo,
  fechaLarga,
  formatoReloj,
  hoyMX,
  rondaDelPuente,
  segundosParaSiguienteReto,
  textoCompartir,
  urlHorda,
  type RetoArcade,
} from '@/lib/arcade'

/**
 * PASAS Arcade — piezas puras del reto diario.
 */

const ronda = (odd: number, topic: string) => ({
  id: topic,
  options: ['a', 'b', 'c', 'd'],
  odd,
  explanation: '',
  kind: 'text' as const,
  topic,
  topic_slug: topic.toLowerCase(),
  subject_slug: 'historia-mexico-2',
  horde_ready: true,
})

const reto: RetoArcade = {
  date: '2026-09-29',
  number: 1,
  rounds: [ronda(0, 'A'), ronda(1, 'B'), ronda(2, 'C'), ronda(3, 'D'), ronda(0, 'E')],
}

describe('hoyMX', () => {
  it('a las 7 PM de México ya es otro día en UTC, pero no en México', () => {
    // 2026-09-30 01:00 UTC = 2026-09-29 19:00 en la Ciudad de México
    expect(hoyMX(new Date('2026-09-30T01:00:00Z'))).toBe('2026-09-29')
  })
  it('cambia a medianoche de México (06:00 UTC)', () => {
    expect(hoyMX(new Date('2026-09-30T05:59:59Z'))).toBe('2026-09-29')
    expect(hoyMX(new Date('2026-09-30T06:00:00Z'))).toBe('2026-09-30')
  })
})

describe('segundosParaSiguienteReto', () => {
  it('a las 23:59:00 de México falta un minuto', () => {
    expect(segundosParaSiguienteReto(Date.parse('2026-09-30T05:59:00Z'))).toBe(60)
  })
  it('justo a medianoche falta un día entero', () => {
    expect(segundosParaSiguienteReto(Date.parse('2026-09-30T06:00:00Z'))).toBe(86400)
  })
})

describe('formato', () => {
  it('reloj con ceros', () => {
    expect(formatoReloj(3661)).toBe('01:01:01')
  })
  it('fecha larga en español con mayúscula inicial', () => {
    expect(fechaLarga('2026-09-29')).toBe('Martes 29 de septiembre')
  })
  it('etiquetas por puntaje', () => {
    expect(etiquetaPuntaje(5)).toBe('Perfecto')
    expect(etiquetaPuntaje(0)).toBe('Mañana hay revancha')
  })
})

describe('resultado y puente', () => {
  it('compara lo que tocó contra la que sobra', () => {
    expect(calcularResultados(reto, [0, 1, 0, 3, 1])).toEqual([true, true, false, true, false])
  })

  it('el texto para compartir va en primera persona, con el tema y sin la respuesta', () => {
    const txt = textoCompartir(12, [true, true, false, true, true], 'pasas.mx', 'La Reforma')
    expect(txt).toBe(
      'Saqué 4/5 en el reto de historia de hoy 🟩🟩🟥🟩🟩\nMe ganó La Reforma. ¿Tú?\npasas.mx/arcade/r/12-11011'
    )
  })

  it('texto de perfecto y de puntaje bajo', () => {
    expect(textoCompartir(3, [true, true, true, true, true], 'pasas.mx')).toBe(
      '5/5 en el reto de historia de hoy 🟩🟩🟩🟩🟩\nA ver si me igualas.\npasas.mx/arcade/r/3-11111'
    )
    expect(textoCompartir(3, [false, false, true, false, false], 'pasas.mx')).toContain(
      'Está más difícil de lo que parece.'
    )
  })

  it('el código del link ida y vuelta', () => {
    expect(codigoResultado(12, [true, false, true, true, false])).toBe('12-10110')
    expect(leerCodigo('12-10110')).toEqual({ numero: 12, resultados: [true, false, true, true, false] })
    expect(leerCodigo('12-1011')).toBeNull()
    expect(leerCodigo('abc')).toBeNull()
  })

  it('el puente lleva al primer tema fallado', () => {
    expect(rondaDelPuente(reto, [true, true, false, false, true]).topic).toBe('C')
  })

  it('si fue perfecto, lleva a la última ronda (la más difícil)', () => {
    expect(rondaDelPuente(reto, [true, true, true, true, true]).topic).toBe('E')
  })

  it('url de la horda del tema', () => {
    expect(urlHorda(reto.rounds[0])).toBe('/horda/historia-mexico-2/a')
  })
})
