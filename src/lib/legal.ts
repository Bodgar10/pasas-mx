/**
 * FUENTE ÚNICA del consentimiento legal.
 *
 * Lo usan:
 *   - src/components/legal/ConsentimientoLegal.tsx  (cliente, pinta los campos)
 *   - src/app/(auth)/registro/actions.ts            (servidor, alta por email)
 *   - src/app/legal/actions.ts                      (servidor, red para OAuth)
 *
 * Este archivo NO importa nada de `next/headers` ni de Supabase a propósito:
 * tiene que poder importarse desde un Client Component. La IP se calcula en el
 * servidor y se pasa como argumento.
 */

export const LEGAL_VERSION = process.env.NEXT_PUBLIC_TOS_VERSION ?? '1.0'

/** Edad cumplida a día de hoy. Devuelve null si la fecha no es parseable. */
export function calcularEdad(iso: string): number | null {
  if (!iso) return null
  const nacimiento = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(nacimiento.getTime())) return null

  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--
  }
  return edad
}

export type ConsentFields = {
  birthdate: string
  parent_name: string | null
  parent_email: string | null
  parental_consent_status: 'not_required' | 'pending'
  parental_consent_token: string | null
  parental_consent_token_expires_at: string | null
  tos_accepted_at: string
  tos_accepted_version: string
  tos_accepted_ip: string | null
  marketing_consent: boolean
  marketing_consent_at: string
}

export type ConsentResult =
  | { ok: false; error: string }
  | {
      ok: true
      esMenor: boolean
      token: string | null
      parentEmail: string | null
      fields: ConsentFields
    }

/**
 * Lee y valida los campos que pinta ConsentimientoLegal.
 *
 * La edad se recalcula AQUÍ, en el servidor, desde `birthdate`. El cálculo que
 * hace el componente en el cliente solo decide qué campos se muestran; no es
 * fuente de verdad y no se le hace caso.
 */
export function parseConsent(formData: FormData, ip: string | null): ConsentResult {
  const birthdate = ((formData.get('birthdate') as string | null) ?? '').trim()
  const tosAccepted = formData.get('tos_accepted') === 'on'
  const parentName = ((formData.get('parent_name') as string | null) ?? '').trim()
  const parentEmail = ((formData.get('parent_email') as string | null) ?? '')
    .trim()
    .toLowerCase()
  const parentalDeclared = formData.get('parental_declaration') === 'on'
  const marketing = formData.get('marketing_consent') === 'on'

  if (!tosAccepted) {
    return {
      ok: false,
      error:
        'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para continuar.',
    }
  }

  const edad = calcularEdad(birthdate)
  if (edad === null || edad < 0 || edad > 120) {
    return { ok: false, error: 'Escribe una fecha de nacimiento válida.' }
  }

  const esMenor = edad < 18

  if (esMenor) {
    if (!parentName) {
      return { ok: false, error: 'Escribe el nombre del padre, madre o tutor.' }
    }
    if (!parentEmail || !parentEmail.includes('@')) {
      return { ok: false, error: 'Escribe un correo válido del padre, madre o tutor.' }
    }
    if (!parentalDeclared) {
      return {
        ok: false,
        error: 'Falta la declaración bajo protesta del padre, madre o tutor.',
      }
    }
  }

  const ahora = new Date().toISOString()

  // Token de un solo uso para el enlace que autoriza el tutor.
  // randomUUID está disponible en Node y en el runtime Edge.
  const token = esMenor ? crypto.randomUUID() : null
  const expira = esMenor
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null

  return {
    ok: true,
    esMenor,
    token,
    parentEmail: esMenor ? parentEmail : null,
    fields: {
      birthdate,
      parent_name: esMenor ? parentName : null,
      parent_email: esMenor ? parentEmail : null,
      // 'pending' registra la realidad: el tutor todavía no autoriza.
      // OJO: hoy NADA bloquea a un usuario en 'pending'. El bloqueo llega
      // en el prompt s25-05, junto con el correo que le permite salir de ahí.
      // No agregues el bloqueo antes que el correo o dejas cuentas atoradas.
      parental_consent_status: esMenor ? 'pending' : 'not_required',
      parental_consent_token: token,
      parental_consent_token_expires_at: expira,
      tos_accepted_at: ahora,
      tos_accepted_version: LEGAL_VERSION,
      tos_accepted_ip: ip,
      marketing_consent: marketing,
      marketing_consent_at: ahora,
    },
  }
}
