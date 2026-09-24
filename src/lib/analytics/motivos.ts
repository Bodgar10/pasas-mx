/**
 * MOTIVOS ESTABLES — los códigos que viajan en `motivo` de los eventos de
 * error del embudo.
 *
 * 🔴 Códigos, no mensajes. El texto que ve el usuario cambia cada vez que
 * alguien mejora una frase, y cada cambio parte en dos la serie histórica
 * del dashboard. Además hoy tres fallos distintos —cliente inexistente en
 * Stripe, tarjeta rechazada y caída de red— comparten el mismo texto ("No
 * pudimos calcular el costo"), así que el mensaje ni siquiera distingue.
 *
 * Nada de lo que sale de aquí lleva datos personales: son constantes.
 */

export type MotivoCheckout =
  | 'promo_no_encontrada'
  | 'customer_inexistente'
  | 'tarjeta'
  | 'red'
  | 'otro'

export type MotivoRegistro =
  | 'correo_existente'
  | 'validacion'
  | 'menor_sin_tutor'
  | 'promo_no_encontrada'
  | 'perfil_no_guardado'
  | 'desconocido'

/**
 * Clasifica un error de Stripe. Lee `type` y `code` del objeto de error de
 * la librería sin importarla: este helper también corre en sitios donde
 * `stripe` no está cargado, y un `instanceof` obligaría a arrastrarla.
 */
export function motivoCheckoutError(err: unknown): MotivoCheckout {
  const e = err as { type?: string; code?: string; message?: string } | null

  if (e?.code === 'resource_missing') return 'customer_inexistente'

  switch (e?.type) {
    case 'StripeCardError':
      return 'tarjeta'
    case 'StripeConnectionError':
    case 'StripeAPIError':
      return 'red'
    case 'StripeInvalidRequestError':
      // Un customer borrado en el dashboard llega por aquí sin `code`.
      return e?.message?.includes('No such customer') ? 'customer_inexistente' : 'otro'
    default:
      return 'otro'
  }
}

/**
 * Traduce el mensaje que devuelve `registroAction` a un código.
 *
 * Va contra el TEXTO porque la acción devuelve `{ error: string }` y nada
 * más: cambiar su firma tocaría el formulario, el estado y las cuatro
 * ramas de salida. Cuando esa firma crezca un campo `codigo`, esta función
 * se borra y el evento lo lee directo.
 */
export function motivoRegistroError(mensaje: string | undefined | null): MotivoRegistro {
  const m = (mensaje ?? '').toLowerCase()
  if (!m) return 'desconocido'
  if (m.includes('ya tiene una cuenta')) return 'correo_existente'
  if (m.includes('tutor') || m.includes('padre, madre')) return 'menor_sin_tutor'
  if (m.includes('promoción') || m.includes('promocion')) return 'promo_no_encontrada'
  if (m.includes('no pudimos guardar')) return 'perfil_no_guardado'
  if (
    m.includes('contraseña') ||
    m.includes('nombre') ||
    m.includes('fecha de nacimiento') ||
    m.includes('correo válido') ||
    m.includes('escribe') ||
    m.includes('acepta') ||
    m.includes('falta')
  ) {
    return 'validacion'
  }
  return 'desconocido'
}
