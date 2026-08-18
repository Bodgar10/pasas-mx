/**
 * FUENTE ÚNICA del dominio canónico y de las rutas públicas.
 *
 * La consumen src/app/robots.ts, src/app/sitemap.ts y el `metadataBase` de
 * src/app/layout.tsx. Antes cada sitio que necesitaba el dominio lo escribía a
 * mano —hay siete 'https://pasas.mx' repartidos por el código— y basta uno
 * desactualizado para que un canonical apunte a un dominio muerto.
 */

/**
 * 🔴 SIN www Y SIN BARRA FINAL.
 *
 * `www.pasas.mx` ya responde 308 hacia aquí (configurado en Vercel, no en este
 * repo), así que el canónico es el desnudo. La barra final fuera porque estos
 * valores se concatenan con rutas que empiezan por '/'.
 *
 * El fallback es el mismo que ya usan create-session/route.ts y el webhook de
 * Stripe: si NEXT_PUBLIC_SITE_URL no está, el dominio de producción es la
 * respuesta correcta, no un localhost.
 */
export const SITIO = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pasas.mx').replace(/\/+$/, '')

/**
 * El host de Vercel, que sirve EXACTAMENTE el mismo sitio que pasas.mx.
 *
 * 🔴 Dos dominios sirviendo lo mismo parten la autoridad del dominio y Google
 * elige por su cuenta cuál es el bueno. Mientras no exista una redirección
 * —no se puede poner sin revisar los enlaces de Stripe y de los correos—,
 * robots.ts sirve `Disallow: /` cuando la petición llega por aquí.
 */
export const HOST_VERCEL = 'pasas-mx.vercel.app'

/**
 * Rutas públicas indexables. ESTA LISTA ES EL SITEMAP.
 *
 * 🔴 NO METAS AQUÍ NADA QUE ESTÉ TRAS LOGIN. Un sitemap que anuncia rutas
 * privadas es peor que no tener sitemap: le dice a Google exactamente qué
 * rastrear de lo que no debería ver. Todo el grupo (protected) y todo (auth)
 * llevan noindex en su layout y Disallow en robots; no pertenecen aquí.
 *
 * `prioridad` es relativa dentro del sitio, no una nota. La landing es lo que
 * queremos que se posicione; las legales existen por obligación y no compiten
 * por tráfico.
 *
 * No lleva `lastModified`: ver la nota de src/app/sitemap.ts.
 */
export const RUTAS_PUBLICAS = [
  { ruta: '/', prioridad: 1.0, frecuencia: 'weekly' },
  { ruta: '/ayuda', prioridad: 0.8, frecuencia: 'monthly' },
  { ruta: '/como-cancelar', prioridad: 0.5, frecuencia: 'yearly' },
  { ruta: '/reembolso', prioridad: 0.4, frecuencia: 'yearly' },
  { ruta: '/status', prioridad: 0.3, frecuencia: 'weekly' },
  { ruta: '/terminos', prioridad: 0.3, frecuencia: 'yearly' },
  { ruta: '/privacidad', prioridad: 0.3, frecuencia: 'yearly' },
] as const

/** URL absoluta de una ruta interna, con el dominio canónico. */
export function urlAbsoluta(ruta: string): string {
  return ruta === '/' ? SITIO : `${SITIO}${ruta}`
}
