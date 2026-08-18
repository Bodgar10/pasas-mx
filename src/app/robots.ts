import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { HOST_VERCEL, SITIO, urlAbsoluta } from '@/lib/seo'

/**
 * 🔴 ES DINÁMICA A PROPÓSITO, Y NO SE PUEDE HACER DE OTRA FORMA.
 *
 * `headers()` es una API de tiempo de petición, así que este archivo deja de
 * cachearse y se resuelve en cada visita. Es exactamente lo que hace falta: el
 * contenido de robots.txt DEPENDE DEL HOST por el que entró la petición.
 *
 * `pasas-mx.vercel.app` sirve el mismo sitio que `pasas.mx`. Dos dominios con
 * el mismo contenido parten la autoridad y dejan que Google elija cuál indexa.
 * Como todavía no se puede redirigir uno al otro —los enlaces de Stripe y los
 * correos de Resend pueden apuntar al de Vercel—, la contención es que el
 * dominio de Vercel se declare cerrado a los buscadores.
 *
 * El coste de perder la caché de CDN aquí es irrelevante: este archivo solo lo
 * piden bots, unas cuantas veces al día.
 *
 * No hay forma declarativa de variar robots.txt por host con la API de Next 16
 * (el objeto Robots no tiene condicionales). Verificado en
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? ''

  /**
   * 🔴 CERRADO ENTERO EN EL DOMINIO DE VERCEL, y sin `sitemap`.
   *
   * Anunciar el sitemap aquí sería contradecirse: le estaríamos dando a Google
   * una lista de URLs canónicas de pasas.mx desde un dominio que acabamos de
   * declarar prohibido.
   */
  if (host === HOST_VERCEL) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    }
  }

  return {
    rules: {
      userAgent: '*',
      /**
       * Allow explícito de las públicas y no un `allow: '/'` a secas: así la
       * lista de lo que SÍ queremos rastreado queda escrita, y no depende de
       * que los Disallow de abajo cubran todo lo demás.
       */
      allow: ['/', '/ayuda', '/como-cancelar', '/reembolso', '/status', '/terminos', '/privacidad'],
      /**
       * 🔴 Estas rutas llevan TAMBIÉN noindex en el layout de su grupo. Las dos
       * cosas hacen falta y no son la misma: Disallow evita el rastreo, noindex
       * saca de resultados lo que ya se rastreó. Un Disallow por sí solo puede
       * dejar una URL indexada "a ciegas" si alguien la enlaza desde fuera.
       *
       * /auth cubre /auth/callback, que es un route handler que recibe tokens.
       * /api entero, que son 35 endpoints y ninguno es contenido.
       * /dev ya devuelve 404 en producción; va igual por si eso cambia.
       */
      disallow: [
        '/api/',
        '/admin',
        '/auth/',
        '/dev',
        '/dashboard',
        '/guia/',
        '/perfil',
        '/planes',
        '/onboarding',
        '/generando',
        '/agregar-alumno',
        '/personalizado/',
        '/login',
        '/registro',
        '/registro-bloqueado',
        '/recuperar',
        '/nueva-contrasena',
        '/bienvenida',
        '/legal',
        '/autorizar-menor/',
      ],
    },
    sitemap: urlAbsoluta('/sitemap.xml'),
    // Le dice a los buscadores cuál de los dos dominios es el bueno. Lo respeta
    // poca gente aparte de Yandex, pero no cuesta nada y es coherente con el
    // canonical del layout.
    host: SITIO,
  }
}
