import { describe, expect, it } from 'vitest'
import { tematicaPorClave, urlGuia, urlOnboardingDesdeTema, urlTemaMuestra } from '@/lib/tema-muestra'

/** s42 — Del resultado del reto al tema exacto, sin cuenta. */
describe('tema-muestra', () => {
  it('el link del resultado lleva el tema y from=arcade', () => {
    expect(urlTemaMuestra('historia-mexico-1', 'la-conquista-de-mexico')).toBe(
      '/tema/historia-mexico-1/la-conquista-de-mexico?from=arcade'
    )
    expect(urlTemaMuestra('h', 't', { perfecto: true, tematica: 'kpop' })).toBe('/tema/h/t?from=arcade&r=5&tematica=kpop')
  })

  it('quien tiene cuenta va a su guía con from=arcade', () => {
    expect(urlGuia('h', 't')).toBe('/guia/h/t?from=arcade')
    expect(urlGuia('h', 't', true)).toBe('/guia/h/t?from=arcade&r=5')
  })

  it('solo acepta las 4 temáticas', () => {
    expect(tematicaPorClave('anime')?.nombre).toBe('Anime & Manga')
    expect(tematicaPorClave('futbol')?.nombre).toBe('Fútbol')
    expect(tematicaPorClave('otra')).toBeNull()
    expect(tematicaPorClave(null)).toBeNull()
  })

  it('el onboarding arranca con nivel, grado y temática, sin pisar el utm', () => {
    const url = new URL(
      urlOnboardingDesdeTema({ nivel: 'Secundaria', grado: '2°', tema: 'La Conquista', tematica: 'Fútbol' }),
      'https://pasas.mx'
    )
    expect(url.pathname).toBe('/onboarding')
    expect(url.searchParams.get('desde')).toBe('tema')
    expect(url.searchParams.get('level')).toBe('Secundaria')
    expect(url.searchParams.get('grade')).toBe('2°')
    expect(url.searchParams.get('theme')).toBe('Fútbol')
    expect(url.searchParams.get('registrante')).toBe('tutor')
    expect(url.searchParams.has('utm_source')).toBe(false)
  })
})
