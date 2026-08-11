/**
 * Ciclo escolar mexicano. Fuente unica.
 *
 * El ciclo va de agosto a julio: de agosto a diciembre pertenece al
 * ciclo que inicia ese año; de enero a julio, al que inicio el año
 * anterior.
 */
export function cicloActual(hoy = new Date()): string {
  const y = hoy.getFullYear()
  const inicia = hoy.getMonth() >= 7 ? y : y - 1  // getMonth: 7 = agosto
  return `${inicia}-${inicia + 1}`
}

/**
 * Ventana en que se propone el cambio de grado: 1 de julio al 30 de
 * septiembre. En junio todavia estan en clases; despues de septiembre
 * el año ya arranco y proponerlo confunde.
 */
export function enVentanaPromocion(hoy = new Date()): boolean {
  const m = hoy.getMonth()
  return m >= 6 && m <= 8  // julio(6), agosto(7), septiembre(8)
}

/**
 * Grado que sigue. Devuelve null cuando no hay siguiente dentro de la
 * plataforma.
 *
 * 3° de prepa no devuelve nada: quien termina prepa se va a la
 * universidad y ahi no hay contenido. Cuando exista el plan de examen
 * de universidad, ese sera su aviso, no este.
 */
export function siguienteGrado(
  nivel: string | null,
  grado: number | null
): { education_level: string; grade: number; etiqueta: string } | null {
  if (!nivel || grado == null) return null
  if (nivel === 'middle_school') {
    if (grado < 3) return { education_level: 'middle_school', grade: grado + 1, etiqueta: `${grado + 1}° de Secundaria` }
    return { education_level: 'high_school', grade: 1, etiqueta: '1° de Preparatoria' }
  }
  if (nivel === 'high_school' && grado < 3) {
    return { education_level: 'high_school', grade: grado + 1, etiqueta: `${grado + 1}° de Preparatoria` }
  }
  return null
}
