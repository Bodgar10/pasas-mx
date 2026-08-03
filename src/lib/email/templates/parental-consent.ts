import { Resend } from 'resend'

/**
 * Correo al padre, madre o tutor para que autorice la cuenta de un menor.
 *
 * El cliente de Resend se instancia DENTRO de la función a propósito: a nivel
 * de módulo el build de Vercel truena al colectar la ruta.
 */
export async function sendParentalConsentEmail({
  to,
  parentName,
  studentName,
  token,
}: {
  to: string
  parentName: string
  studentName: string
  token: string
}) {
  // Sin llave, el constructor de Resend LANZA (no devuelve { error } como
  // Supabase). Si eso sube por la Server Action, revienta el alta y deja al
  // menor bloqueado sin correo. Se comprueba antes.
  if (!process.env.RESEND_API_KEY) {
    console.error('[parental-consent] Falta RESEND_API_KEY — no se envió el correo')
    return { ok: false as const }
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasas.mx'
  const enlace = `${base}/autorizar-menor/${token}`

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
      <h1 style="font-size:20px;margin:0 0 16px">Autoriza la cuenta de ${studentName}</h1>
      <p style="font-size:15px;line-height:1.6">Hola ${parentName}:</p>
      <p style="font-size:15px;line-height:1.6">
        ${studentName} creó una cuenta en Pasas.mx, una plataforma de estudio para
        secundaria y preparatoria. Como es menor de edad, necesitamos tu
        autorización antes de activarla.
      </p>
      <p style="font-size:15px;line-height:1.6">
        Antes de autorizar, te pedimos leer nuestro
        <a href="${base}/privacidad" style="color:#7c3aed">Aviso de Privacidad</a>,
        donde explicamos qué datos tratamos y cómo puedes ejercer tus derechos.
      </p>
      <p style="margin:28px 0">
        <a href="${enlace}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;display:inline-block">
          Revisar y autorizar
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280;line-height:1.6">
        El enlace vence en 7 días. Si no reconoces esta solicitud, ignora este
        correo y la cuenta no se activará.
      </p>
      <p style="font-size:13px;color:#6b7280;line-height:1.6">
        ¿Dudas? Escríbenos a soporte@pasas.mx
      </p>
    </div>
  `

  // try/catch además del if: Resend puede lanzar por red o por llave inválida,
  // y puede devolver { error } por rechazo del destinatario. Son dos caminos
  // distintos y los dos tienen que terminar en { ok: false }, nunca en una
  // excepción que suba a la Server Action.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'Pasas.mx <hola@pasas.mx>',
      to,
      subject: `Autoriza la cuenta de ${studentName} en Pasas.mx`,
      html,
    })

    if (error) {
      console.error('[parental-consent] Resend rechazó el envío:', error)
      return { ok: false as const }
    }
    return { ok: true as const }
  } catch (e) {
    console.error('[parental-consent] Resend lanzó:', e)
    return { ok: false as const }
  }
}
