import { describe, it, expect } from 'vitest'
import { tieneAccesoVigente, rutaAlumno } from '@/lib/learners'

/**
 * U6 — Las dos funciones puras de learners.ts.
 *
 * El resto del archivo habla con Supabase y va a la capa de integración.
 * Estas dos no, y las dos deciden algo que se ve en pantalla: si un alumno
 * puede seguir estudiando, y a qué alumno lleva un enlace.
 */

const EN_UNA_HORA = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const HACE_UNA_HORA = new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe('tieneAccesoVigente', () => {
  it('active: vigente, mire o no la fecha', () => {
    expect(tieneAccesoVigente({ status: 'active', access_until: null })).toBe(true)
    expect(tieneAccesoVigente({ status: 'active', access_until: HACE_UNA_HORA })).toBe(true)
  })

  it('🔴 ending con fecha futura: SIGUE vigente — conserva el acceso que ya pagó', () => {
    // Filtrar por status = 'active' a secas sacaba al alumno del selector
    // mientras todavía podía estudiar. Es un caso real ya corregido.
    expect(tieneAccesoVigente({ status: 'ending', access_until: EN_UNA_HORA })).toBe(true)
  })

  it('ending con fecha pasada: se acabó', () => {
    expect(tieneAccesoVigente({ status: 'ending', access_until: HACE_UNA_HORA })).toBe(false)
  })

  it('ending sin access_until: false — no se asume acceso sin fecha que lo respalde', () => {
    expect(tieneAccesoVigente({ status: 'ending', access_until: null })).toBe(false)
  })

  it('cualquier otro status: false', () => {
    expect(tieneAccesoVigente({ status: 'paused', access_until: EN_UNA_HORA })).toBe(false)
    expect(tieneAccesoVigente({ status: 'cancelled', access_until: EN_UNA_HORA })).toBe(false)
    expect(tieneAccesoVigente({ status: '', access_until: EN_UNA_HORA })).toBe(false)
  })
})

describe('rutaAlumno', () => {
  it('slot 1: sin parámetro, para que las URLs de la mayoría queden limpias', () => {
    expect(rutaAlumno('/dashboard', 1)).toBe('/dashboard')
  })

  it('slot distinto de 1: agrega ?a=', () => {
    // 🔴 Un push que olvide el ?a= manda al usuario al alumno equivocado sin
    // ningún error visible: vería el avance de su hermano y creería que se
    // borró el suyo.
    expect(rutaAlumno('/dashboard', 2)).toBe('/dashboard?a=2')
    expect(rutaAlumno('/dashboard', 3)).toBe('/dashboard?a=3')
  })

  it('path que ya trae query: usa & en vez de ?', () => {
    expect(rutaAlumno('/guia/matematicas?tema=fracciones', 2)).toBe('/guia/matematicas?tema=fracciones&a=2')
  })
})
