/**
 * GUARDA — impide que una prueba escriba en una base que no sea la local.
 *
 * 🔴 EL PEOR RESULTADO POSIBLE de toda la infraestructura de pruebas es una
 * suite que borre usuarios en producción. Las pruebas de integración crean y
 * destruyen filas por diseño; lo único que decide si eso ocurre en un
 * contenedor de Docker o en la base de la que viven los clientes es una
 * variable de entorno. Este archivo es lo que hay entre las dos cosas.
 *
 * ── POR QUÉ ESTÁ SEPARADO DEL SETUP ───────────────────────────────────
 *
 * `verificarDestinoDb` es una función PURA que recibe la URL y lanza. No lee
 * `process.env` ni tiene efectos al importarse, y eso es deliberado: así se
 * puede probar. Quien la ejecuta de verdad es `tests/setup-integracion.ts`.
 *
 * Una guarda que nunca se ha visto disparar no es una guarda: es una
 * suposición. Ver `tests/unit/guarda-db.test.ts`, que la ve disparar en cada
 * `npm test` y por tanto en cada `git push`.
 */

/**
 * Las ÚNICAS URLs contra las que se permite correr.
 *
 * Lista blanca y no lista negra: la pregunta no es "¿es producción?" sino
 * "¿es exactamente la local?". Un proyecto de staging nuevo tampoco pasa, y
 * eso es lo correcto — que alguien tenga que añadirlo aquí a mano y a
 * conciencia, no que entre por defecto por no estar prohibido.
 *
 * El puerto va incluido: 54321 es el que expone `supabase start`.
 */
export const URLS_PERMITIDAS = [
  'http://127.0.0.1:54321',
  'http://localhost:54321',
] as const

/**
 * Referencia del proyecto de PRODUCCIÓN.
 *
 * Redundante con la lista blanca a propósito: si algún día alguien la relaja
 * "un momento para probar algo", este candado sigue de pie, y además da un
 * mensaje que nombra el peligro en vez de uno genérico.
 */
export const REF_PRODUCCION = 'uxtmdhbqiphvmixtxlox'

/**
 * Lanza si la URL no es la base local. No devuelve nada: o pasa, o revienta.
 *
 * 🔴 LANZA, NO ADVIERTE. Un `console.warn` en una suite de veinte archivos no
 * lo lee nadie, y menos cuando el resto sale en verde.
 */
export function verificarDestinoDb(url: string | undefined | null): void {
  const encontrada = (url ?? '').trim()

  // Candado 2 — lista negra nominal. Va PRIMERO para que, cuando el peligro
  // sea real, el mensaje lo diga con todas las letras en vez de hablar de
  // formatos de URL.
  if (encontrada.includes(REF_PRODUCCION)) {
    throw new Error(
      '\n\n🔴🔴🔴 ABORTADO: ESTÁS APUNTANDO A PRODUCCIÓN 🔴🔴🔴\n\n' +
        `  NEXT_PUBLIC_SUPABASE_URL = ${encontrada}\n\n` +
        `  Esa URL contiene "${REF_PRODUCCION}", que es el proyecto de\n` +
        '  producción de Pasas.mx. Las pruebas de integración CREAN Y BORRAN\n' +
        '  filas: correrlas contra esa base destruiría datos de clientes\n' +
        '  reales.\n\n' +
        '  Arranca la base local con `supabase start` y comprueba que\n' +
        '  .env.test apunta a http://127.0.0.1:54321\n'
    )
  }

  // Candado 1 — lista blanca.
  if (!URLS_PERMITIDAS.some((permitida) => encontrada.startsWith(permitida))) {
    throw new Error(
      '\n\n🔴 ABORTADO: la base de destino no es la local.\n\n' +
        `  encontrada: ${encontrada === '' ? '(vacía o sin definir)' : encontrada}\n` +
        `  esperada:   ${URLS_PERMITIDAS.join('  o  ')}\n\n` +
        '  Las pruebas de integración solo corren contra el Supabase local.\n' +
        '  Levántalo con `supabase start` y revisa NEXT_PUBLIC_SUPABASE_URL\n' +
        '  en .env.test\n'
    )
  }
}
