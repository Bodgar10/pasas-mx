import 'server-only'

import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { FROM_EMAIL, SUPPORT_EMAIL } from '@/lib/email/resend'
import { SITIO } from '@/lib/seo'

/**
 * Recordatorio diario del reto por correo (s34-F5). Tabla
 * `arcade_suscriptores` (migración 055): doble opt-in, solo mayores de edad,
 * sin acceso desde el cliente.
 *
 * 🔴 Todo detrás de FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO: con el flag
 * apagado, las rutas responden 404 y el cron no toca la tabla.
 */

export function db(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

export const token = () => randomBytes(24).toString('base64url')

export function correoValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export const urlConfirmar = (t: string) => `${SITIO}/api/arcade/recordatorio/confirmar?t=${encodeURIComponent(t)}`
export const urlBaja = (t: string) => `${SITIO}/api/arcade/recordatorio/baja?t=${encodeURIComponent(t)}`
export const URL_RETO = `${SITIO}/arcade?utm_source=email&utm_medium=recordatorio&utm_campaign=reto`

const envolver = (cuerpo: string, baja?: string) => `<!doctype html><html><body style="margin:0;background:#0f0a1e;font-family:Arial,Helvetica,sans-serif;color:#e2d9f3">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<div style="font-weight:900;letter-spacing:2px;font-size:14px;margin-bottom:24px">PASAS<span style="color:#ec4899">·</span>ARCADE</div>
${cuerpo}
<p style="font-size:12px;color:#8f84b5;margin-top:32px;line-height:1.5">Recibes este correo porque te suscribiste al recordatorio del reto diario de pasas.mx.${
  baja ? ` <a href="${baja}" style="color:#a78bfa">Darme de baja</a>.` : ''
}</p></div></body></html>`

const boton = (href: string, texto: string) =>
  `<a href="${href}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">${texto}</a>`

export function correoConfirmacion(tConfirmar: string) {
  return {
    subject: 'Confirma tu recordatorio del reto diario',
    html: envolver(`<h1 style="font-size:22px;margin:0 0 12px">Un clic y listo</h1>
<p style="font-size:15px;line-height:1.55;margin:0 0 20px">Confirma que quieres recibir cada mañana el aviso de que salió el nuevo reto de historia <b>¿Cuál sobra?</b>. Si no fuiste tú, ignora este correo.</p>
${boton(urlConfirmar(tConfirmar), 'Confirmar')}`),
  }
}

export function correoDiario(numero: number, tBaja: string) {
  return {
    subject: `¿Cuál sobra? #${numero} ya está listo`,
    html: envolver(
      `<h1 style="font-size:22px;margin:0 0 12px">Reto #${numero}</h1>
<p style="font-size:15px;line-height:1.55;margin:0 0 20px">Cinco rondas, dos minutos. Tres tienen algo en común y una no. ¿Cuántas sacas hoy?</p>
${boton(URL_RETO, 'Jugar el reto de hoy')}`,
      urlBaja(tBaja)
    ),
    headers: {
      'List-Unsubscribe': `<${urlBaja(tBaja)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

/** Nunca lanza: el formulario no muestra errores de envío. */
export async function enviarConfirmacion(email: string, tConfirmar: string): Promise<boolean> {
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: SUPPORT_EMAIL,
      ...correoConfirmacion(tConfirmar),
    })
    if (error) console.error('[recordatorio] confirmación falló:', error)
    return !error
  } catch (e) {
    console.error('[recordatorio] confirmación lanzó:', e)
    return false
  }
}
