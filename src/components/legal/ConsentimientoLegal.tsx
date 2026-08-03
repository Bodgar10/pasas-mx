'use client'

import { useState } from 'react'
import { LEGAL_VERSION, calcularEdad } from '@/lib/legal'

/**
 * Campos de consentimiento legal compartidos por /registro y /legal.
 *
 * FUENTE ÚNICA: si hay que cambiar el texto de un checkbox, la leyenda
 * bajo protesta o la versión del Aviso, se cambia AQUÍ y en ningún otro lado.
 *
 * No incluye <form>. La pantalla que lo monta provee el form y la Server Action.
 * Los valores se leen del FormData por `name`:
 *   tos_accepted           'on' | ausente
 *   birthdate              'YYYY-MM-DD'
 *   parent_name            string | ausente
 *   parent_email           string | ausente
 *   parental_declaration   'on' | ausente
 *   marketing_consent      'on' | ausente
 */

export default function ConsentimientoLegal({
  registrante = 'alumno',
}: {
  /**
   * Quién llena el formulario.
   * 'tutor'  → el correo de la cuenta es el del tutor; no se pide aparte.
   * 'alumno' → se pide el correo del tutor explícitamente. Es el default
   *            porque es el caso que necesita más datos, y /legal (la red para
   *            Google OAuth) siempre cae aquí: ahí el correo lo pone Google y
   *            puede ser del menor.
   */
  registrante?: 'tutor' | 'alumno'
}) {
  const [birthdate, setBirthdate] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [parentalDeclared, setParentalDeclared] = useState(false)
  const [marketing, setMarketing] = useState(false)

  const edad = calcularEdad(birthdate)
  const esMenor = edad !== null && edad < 18
  const fechaInvalida = edad !== null && (edad < 0 || edad > 120)

  // Cotas del input: no se puede nacer mañana ni hace 120 años.
  const hoyISO = new Date().toISOString().slice(0, 10)
  const minISO = `${new Date().getFullYear() - 120}-01-01`

  return (
    <div className="space-y-5">
      <input type="hidden" name="registrante" value={registrante} />

      {/* ── Fecha de nacimiento (age gate) ── */}
      <div>
        <label
          htmlFor="birthdate"
          className="mb-2 block text-sm font-medium"
          style={{ color: '#a78bfa' }}
        >
          Fecha de nacimiento del alumno
        </label>
        <input
          id="birthdate"
          name="birthdate"
          type="date"
          required
          value={birthdate}
          max={hoyISO}
          min={minISO}
          onChange={(e) => setBirthdate(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#7c3aed]"
        />
        {fechaInvalida && (
          <p className="mt-2 text-sm text-amber-400">
            Revisa la fecha, no parece correcta.
          </p>
        )}
        {esMenor && !fechaInvalida && (
          <p className="mt-2 text-sm" style={{ color: '#a78bfa' }}>
            {registrante === 'tutor'
              ? 'Como el alumno es menor de edad, necesitamos tus datos como padre, madre o tutor.'
              : 'Como el alumno es menor de edad, necesitamos los datos de su padre, madre o tutor.'}
          </p>
        )}
      </div>

      {/* ── Menor intentando registrarse solo: camino inválido ── */}
      {esMenor && !fechaInvalida && registrante === 'alumno' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="mb-2 text-sm font-bold" style={{ color: '#fbbf24' }}>
            El registro lo debe hacer tu padre, madre o tutor
          </p>
          <p className="text-sm" style={{ color: '#c4b5fd' }}>
            Marcaste que tienes 18 años o más, pero la fecha indica que eres
            menor de edad. Pídele a tu padre, madre o tutor que haga el registro
            desde el inicio: la cuenta queda a su nombre y tú la usas para
            estudiar.
          </p>
        </div>
      )}

      {/* ── Datos del tutor (solo si es menor y registra el tutor) ── */}
      {esMenor && !fechaInvalida && registrante === 'tutor' && (
        <div className="space-y-5 rounded-xl border border-white/10 bg-white/5 p-5">
          <div>
            <label
              htmlFor="parent_name"
              className="mb-2 block text-sm font-medium"
              style={{ color: '#a78bfa' }}
            >
              {registrante === 'tutor'
                ? 'Tu nombre completo (padre, madre o tutor)'
                : 'Nombre completo del padre, madre o tutor'}
            </label>
            <input
              id="parent_name"
              name="parent_name"
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#7c3aed]"
            />
          </div>

          {/* Leyenda confirmada por el despacho. NO reescribir este texto. */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="parental_declaration"
              required
              checked={parentalDeclared}
              onChange={(e) => setParentalDeclared(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#7c3aed]"
            />
            <span className="text-sm" style={{ color: '#a78bfa' }}>
              Bajo protesta de decir verdad, manifiesto que los datos asentados
              son verdaderos y que ejerzo la patria potestad o tutela del menor.
              {registrante === 'tutor' && ' Usaré este correo para recibir avisos sobre la cuenta.'}
            </span>
          </label>
        </div>
      )}

      {/* ── Aceptación de T&C + Aviso ── */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="tos_accepted"
          required
          checked={tosAccepted}
          onChange={(e) => setTosAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#7c3aed]"
        />
        <span className="text-sm" style={{ color: '#a78bfa' }}>
          He leído y acepto los{' '}
          <a
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
            style={{ color: '#c4b5fd' }}
          >
            Términos y Condiciones
          </a>{' '}
          y el{' '}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
            style={{ color: '#c4b5fd' }}
          >
            Aviso de Privacidad
          </a>{' '}
          de Pasas.mx (Versión {LEGAL_VERSION}).
        </span>
      </label>

      {/* ── Marketing: separado, opcional, SIN premarcar ── */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="marketing_consent"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#7c3aed]"
        />
        <span className="text-sm" style={{ color: '#a78bfa' }}>
          Quiero recibir promociones, novedades y consejos de estudio por correo.
          Es opcional y puedo cancelarlo cuando quiera desde mi perfil.
        </span>
      </label>
    </div>
  )
}
