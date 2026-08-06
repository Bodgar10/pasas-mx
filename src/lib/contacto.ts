/**
 * FUENTE ÚNICA de los datos de contacto de soporte.
 *
 * Antes el número vivía en WhatsAppButton.tsx con un comentario que decía
 * "cambiar SOLO aquí", pero el dashboard tenía su propio enlace hardcodeado:
 * al poner el número real se quedó con el placeholder y apuntaba a un número
 * inexistente. Por eso vive aquí y no dentro de un componente.
 *
 * 55 2714 9106 es el canal oficial de atención según la cláusula 7.1 de los
 * Términos y Condiciones. Si cambia, se cambia en este archivo y punto.
 */

/** Formato wa.me para México: 52 + 1 + los 10 dígitos. */
export const WA_NUMBER = '5215527149106'

export const SOPORTE_EMAIL = 'soporte@pasas.mx'

/** Enlace de WhatsApp con mensaje precargado. El texto se codifica aquí. */
export function waLink(mensaje: string): string {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(mensaje)}`
}
