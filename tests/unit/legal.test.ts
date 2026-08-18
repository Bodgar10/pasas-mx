import { describe, it, expect } from 'vitest'
import { parseConsent, calcularEdad, LEGAL_VERSION } from '@/lib/legal'

/**
 * U4 — El consentimiento legal y la puerta de los menores.
 *
 * 🔴 Es la validación más delicada del alta. parseConsent corre ANTES del
 * signUp, así que un error suyo significa que no queda fila huérfana en
 * auth.users — pero también que un hueco aquí deja entrar a un menor como
 * titular de su propia cuenta, que es justo lo que la LFPDPPP no permite.
 *
 * La edad se recalcula en el servidor desde `birthdate`; lo que el cliente
 * haya decidido no se toma en cuenta. Estas pruebas atacan ese recálculo.
 */

/** Fecha de nacimiento, en ISO, de alguien que hoy tiene `años` (± días). */
function nacidoHace(años: number, díasExtra = 0): string {
  const hoy = new Date()
  const d = new Date(hoy.getFullYear() - años, hoy.getMonth(), hoy.getDate() + díasExtra)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** FormData del formulario de consentimiento, con los defaults de un adulto. */
function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

const IP = '187.190.1.1'

describe('parseConsent — caminos de error', () => {
  it('🔴 menor que dice ser el alumno: se rechaza, un menor no puede ser titular', () => {
    const r = parseConsent(
      form({ birthdate: nacidoHace(15), tos_accepted: 'on', registrante: 'alumno' }),
      IP
    )

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('El registro lo debe hacer tu padre, madre o tutor')
  })

  it('menor registrado por el tutor pero sin nombre del tutor: se rechaza', () => {
    const r = parseConsent(
      form({
        birthdate: nacidoHace(15),
        tos_accepted: 'on',
        registrante: 'tutor',
        parental_declaration: 'on',
      }),
      IP,
      'mama@ejemplo.mx'
    )

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toBe('Escribe el nombre del padre, madre o tutor.')
  })

  it('🔴 menor sin la declaración bajo protesta: se rechaza', () => {
    // Es una manifestación sobre la patria potestad de un menor. Sin ella no
    // se estampa nada, por más que todo lo demás venga bien.
    const r = parseConsent(
      form({
        birthdate: nacidoHace(15),
        tos_accepted: 'on',
        registrante: 'tutor',
        parent_name: 'María López',
      }),
      IP,
      'mama@ejemplo.mx'
    )

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toBe('Falta la declaración bajo protesta del padre, madre o tutor.')
  })

  it('sin aceptar T&C: se rechaza ANTES de mirar siquiera la edad', () => {
    // El orden importa: con una fecha de nacimiento inválida Y sin T&C, el
    // error que sale es el de T&C. Fijarlo evita que un reordenamiento futuro
    // deje pasar un alta sin consentimiento por devolver otro error primero.
    const r = parseConsent(form({ birthdate: 'no-es-fecha' }), IP)

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('Términos y Condiciones')
  })

  it('fecha de nacimiento no parseable: se rechaza', () => {
    const r = parseConsent(form({ birthdate: 'ayer', tos_accepted: 'on' }), IP)

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toBe('Escribe una fecha de nacimiento válida.')
  })

  it('edad mayor a 120 años: se rechaza', () => {
    const r = parseConsent(form({ birthdate: '1800-01-01', tos_accepted: 'on' }), IP)

    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toBe('Escribe una fecha de nacimiento válida.')
  })
})

describe('parseConsent — caminos de éxito', () => {
  it('🔴 registrante TUTOR: el correo del tutor es el de la cuenta, no se pide aparte', () => {
    const r = parseConsent(
      form({
        birthdate: nacidoHace(15),
        tos_accepted: 'on',
        registrante: 'tutor',
        parent_name: 'María López',
        parental_declaration: 'on',
      }),
      IP,
      'MAMA@Ejemplo.MX'
    )

    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.esMenor).toBe(true)
    expect(r.registrante).toBe('tutor')
    // Normalizado a minúsculas: es el correo con el que Supabase creará la
    // cuenta, y auth/callback compara `parent_email === user.email` para
    // decidir si manda al tutor a autorizar.
    expect(r.parentEmail).toBe('mama@ejemplo.mx')
    expect(r.fields.parent_email).toBe('mama@ejemplo.mx')
    expect(r.fields.parent_name).toBe('María López')
    expect(r.fields.parental_consent_status).toBe('pending')
    expect(r.token).toBeTypeOf('string')
    expect(r.fields.parental_consent_token).toBe(r.token)
  })

  it('el token de un menor caduca a los 7 días', () => {
    const r = parseConsent(
      form({
        birthdate: nacidoHace(15),
        tos_accepted: 'on',
        registrante: 'tutor',
        parent_name: 'María López',
        parental_declaration: 'on',
      }),
      IP,
      'mama@ejemplo.mx'
    )

    expect(r.ok).toBe(true)
    if (!r.ok) return

    const expira = new Date(r.fields.parental_consent_token_expires_at!).getTime()
    const sieteDias = Date.now() + 7 * 24 * 60 * 60 * 1000
    // Margen de un minuto: entre que se arma el objeto y se lee la aserción
    // pasa tiempo real.
    expect(Math.abs(expira - sieteDias)).toBeLessThan(60_000)
  })

  it('adulto: not_required, sin token y sin datos de tutor', () => {
    const r = parseConsent(
      form({
        birthdate: nacidoHace(30),
        tos_accepted: 'on',
        registrante: 'alumno',
        marketing_consent: 'on',
      }),
      IP,
      'adulto@ejemplo.mx'
    )

    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.esMenor).toBe(false)
    expect(r.token).toBeNull()
    expect(r.fields.parental_consent_status).toBe('not_required')
    expect(r.fields.parental_consent_token).toBeNull()
    expect(r.fields.parental_consent_token_expires_at).toBeNull()
    expect(r.fields.parent_name).toBeNull()
    expect(r.fields.parent_email).toBeNull()
    // La IP se calcula en el servidor y se pasa como argumento: es la
    // constancia de la aceptación.
    expect(r.fields.tos_accepted_ip).toBe(IP)
    expect(r.fields.tos_accepted_version).toBe(LEGAL_VERSION)
    expect(r.fields.marketing_consent).toBe(true)
  })
})

describe('calcularEdad', () => {
  it('🔴 borde de los 18: el día del cumpleaños ya son 18; un día antes son 17', () => {
    expect(calcularEdad(nacidoHace(18))).toBe(18)
    // Nacido 18 años atrás pero un día MÁS TARDE: el cumpleaños es mañana.
    expect(calcularEdad(nacidoHace(18, 1))).toBe(17)
  })

  it('cumpleaños hoy: cuenta el año cumplido, no el que viene', () => {
    expect(calcularEdad(nacidoHace(15))).toBe(15)
  })

  it('fecha no parseable o vacía: null', () => {
    expect(calcularEdad('no-es-fecha')).toBeNull()
    expect(calcularEdad('')).toBeNull()
  })
})
