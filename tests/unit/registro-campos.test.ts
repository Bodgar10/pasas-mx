import { describe, expect, it } from 'vitest'
import { campoLleno, campoRegistro } from '@/lib/analytics/registro-campos'

/** s44 — medición del formulario de registro: nombres, nunca valores. */
describe('registro-campos', () => {
  it('nombra los campos que se miden y descarta el resto', () => {
    expect(campoRegistro('email')).toBe('correo')
    expect(campoRegistro('birthdate')).toBe('fecha')
    expect(campoRegistro('tos_accepted')).toBe('terminos')
    expect(campoRegistro('utm_data')).toBeNull()
    expect(campoRegistro('marketing_consent')).toBeNull()
    expect(campoRegistro(undefined)).toBeNull()
  })

  it('lleno: casilla marcada o texto no vacío', () => {
    expect(campoLleno({ type: 'checkbox', checked: true })).toBe(true)
    expect(campoLleno({ type: 'checkbox', checked: false })).toBe(false)
    expect(campoLleno({ type: 'email', value: '  ' })).toBe(false)
    expect(campoLleno({ type: 'email', value: 'a@b.mx' })).toBe(true)
  })
})
