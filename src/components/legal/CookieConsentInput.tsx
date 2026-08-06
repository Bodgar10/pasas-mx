'use client'

import { useEffect, useState } from 'react'
import { leerConsentimiento } from '@/lib/consent'

/**
 * Input oculto con el consentimiento de cookies para el formulario de /legal.
 *
 * Existe porque /legal es un Server Component y no puede leer localStorage.
 * En /registro no hace falta: esa página ya es cliente y llama a
 * leerConsentimiento() directo.
 *
 * Va vacío si la persona nunca contestó el banner. El servidor lo trata como
 * "sin consentimiento" y deja las cinco columnas en NULL — que es distinto
 * de false y hay que poder distinguirlo.
 */
export default function CookieConsentInput() {
  const [valor, setValor] = useState('')

  useEffect(() => {
    const consent = leerConsentimiento()
    if (consent) setValor(JSON.stringify(consent))
  }, [])

  return <input type="hidden" name="cookie_consent" value={valor} />
}
