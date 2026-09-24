/**
 * TRÁFICO INTERNO — la marca que separa a Bodgar de un visitante real.
 *
 * El problema que resuelve: una visita propia sin sesión iniciada es
 * indistinguible de una real. `users.is_test` solo existe para cuentas
 * creadas; el 82% del embudo ocurre ANTES de que haya cuenta, que es
 * justo donde más duele contarse a uno mismo.
 *
 * Cómo se marca: `?interno=1` una vez por dispositivo. Queda en
 * localStorage —no sessionStorage— porque tiene que sobrevivir a cerrar
 * la pestaña: se pone una vez y vale para siempre en ese navegador.
 * `?interno=0` lo borra, para poder volver a ver el sitio como lo ve
 * alguien de fuera sin tener que limpiar el almacenamiento a mano.
 *
 * 🔴 Esto NO es consentimiento ni oculta nada: solo agrega la propiedad
 * `interno` a los eventos que ya se iban a mandar. Si la persona rechazó
 * la analítica, no se manda nada igualmente.
 */

export const CLAVE_INTERNO = 'pasas_interno'
const PARAM_INTERNO = 'interno'

/**
 * Lee el `?interno=` de la URL actual y persiste la decisión.
 *
 * Devuelve el estado YA resuelto para que quien la llama no tenga que
 * volver a leer localStorage en la misma vuelta.
 */
export function sincronizarInterno(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const valor = new URLSearchParams(window.location.search).get(PARAM_INTERNO)
    if (valor === '1') {
      window.localStorage.setItem(CLAVE_INTERNO, '1')
      return true
    }
    if (valor === '0') {
      window.localStorage.removeItem(CLAVE_INTERNO)
      return false
    }
    return window.localStorage.getItem(CLAVE_INTERNO) === '1'
  } catch {
    // Safari en navegación privada lanza al escribir. Un dispositivo sin
    // marca cuenta como externo: es el valor que menos miente de los dos.
    return false
  }
}

/** Solo lectura. No toca la URL ni escribe nada. */
export function esInterno(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CLAVE_INTERNO) === '1'
  } catch {
    return false
  }
}
