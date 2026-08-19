/**
 * Sustituto de `server-only` para las pruebas.
 *
 * 🔴 NO ES UN PARCHE AL CÓDIGO: es que ese paquete no existe en node_modules.
 * Next lo resuelve con un alias interno de su bundler, y su único efecto es
 * romper el BUILD si un componente de cliente importa un módulo de servidor.
 * No tiene comportamiento en tiempo de ejecución.
 *
 * Fuera del bundler de Next hay que darle un destino, y este archivo vacío es
 * ese destino. `src/lib/payments/promo-checkout.ts` lo importa a propósito
 * —para que un import desde el cliente no compile— y esa protección sigue
 * intacta en el build real; aquí solo deja de estorbar.
 */
export {}
