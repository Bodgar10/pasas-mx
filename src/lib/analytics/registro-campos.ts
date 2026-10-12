/**
 * Medición del formulario de /registro campo por campo (s44).
 *
 * "2 empezaron el registro y 0 lo terminaron" no dice DÓNDE se van. Esto
 * nombra cada campo para contar cuántos lo llenan, cuál bloquea el envío
 * (validación del navegador) y en cuál estaba quien se fue.
 *
 * 🔴 Solo el NOMBRE del campo, nunca su valor: ni el correo, ni el nombre,
 * ni la fecha de nacimiento salen del navegador por aquí.
 */

/** name del input → etiqueta corta para la medición. El orden es el de pantalla. */
export const CAMPOS_REGISTRO: Record<string, string> = {
  full_name: 'nombre',
  email: 'correo',
  password: 'contrasena',
  birthdate: 'fecha',
  parent_name: 'tutor_nombre',
  parental_declaration: 'declaracion',
  tos_accepted: 'terminos',
}

/** Etiqueta del campo, o null si no se mide (ocultos, marketing…). */
export function campoRegistro(name: string | null | undefined): string | null {
  return (name && CAMPOS_REGISTRO[name]) || null
}

/** ¿El campo quedó lleno? Casillas: marcadas. Lo demás: con texto. */
export function campoLleno(el: { type?: string; checked?: boolean; value?: string }): boolean {
  if (el.type === 'checkbox') return !!el.checked
  return (el.value ?? '').trim().length > 0
}
