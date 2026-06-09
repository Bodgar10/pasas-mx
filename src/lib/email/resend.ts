import { Resend } from 'resend'

export const FROM_EMAIL = 'Pasas.mx <hola@pasas.mx>'
export const SUPPORT_EMAIL = 'soporte@pasas.mx'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailOptions) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      replyTo: replyTo ?? SUPPORT_EMAIL,
    })

    if (error) {
      console.error('[Resend] Error sending email:', error)
      return { ok: false, error }
    }

    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[Resend] Unexpected error:', err)
    return { ok: false, error: err }
  }
}
