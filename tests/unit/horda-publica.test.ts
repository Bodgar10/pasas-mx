import { describe, it, expect } from 'vitest'
import {
  esMateriaPublica,
  gradoOnboarding,
  mensajePapa,
  resultadoOleada,
  urlOnboarding,
} from '@/lib/horda-publica'

/**
 * Horda pública — reglas de oleada, materias abiertas y el prellenado del
 * onboarding (que debe hablar EXACTAMENTE el vocabulario de onboarding-client).
 */

describe('resultadoOleada', () => {
  it('mismas reglas que la Horda de adentro', () => {
    expect(resultadoOleada(5)).toBe('avanza')
    expect(resultadoOleada(4)).toBe('avanza')
    expect(resultadoOleada(3)).toBe('repite')
    expect(resultadoOleada(2)).toBe('reinicia')
    expect(resultadoOleada(0)).toBe('reinicia')
  })
})

describe('materias públicas', () => {
  it('solo historia', () => {
    expect(esMateriaPublica('historia-mexico-2')).toBe(true)
    expect(esMateriaPublica('historia-arte')).toBe(true)
    expect(esMateriaPublica('matematicas-sec-1')).toBe(false)
  })
})

describe('prellenado del onboarding', () => {
  it('grado en el formato de GRADES (1°, 2°, 3°)', () => {
    expect(gradoOnboarding(2)).toBe('2°')
    expect(gradoOnboarding(0)).toBeNull()
    expect(gradoOnboarding(null)).toBeNull()
  })

  it('arma la URL con desde=horda, registrante tutor y utm', () => {
    const url = new URL(
      urlOnboarding({ nivel: 'Preparatoria / Bachillerato', grado: '2°', tema: 'La Revolución Mexicana', origen: 'horda_papa' }),
      'https://pasas.mx'
    )
    expect(url.pathname).toBe('/onboarding')
    expect(url.searchParams.get('desde')).toBe('horda')
    expect(url.searchParams.get('registrante')).toBe('tutor')
    expect(url.searchParams.get('level')).toBe('Preparatoria / Bachillerato')
    expect(url.searchParams.get('grade')).toBe('2°')
    expect(url.searchParams.get('utm_source')).toBe('horda_papa')
  })

  it('el mensaje al papá lleva el tema y el link', () => {
    const m = mensajePapa('La Revolución Mexicana', 'pasas.mx/unete/a/b')
    expect(m).toContain('3 de 6 oleadas de La Revolución Mexicana')
    expect(m).toContain('pasas.mx/unete/a/b')
  })
})
