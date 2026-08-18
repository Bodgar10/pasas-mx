import type { MetadataRoute } from 'next'
import { RUTAS_PUBLICAS, urlAbsoluta } from '@/lib/seo'

/**
 * Sitemap del sitio. Siete URLs, y ese número es correcto.
 *
 * 🔴 TODO EL CONTENIDO ESTÁ TRAS LOGIN. Las guías, los temas y el catálogo
 * entero viven bajo /guia y /dashboard, que exigen sesión: no hay una sola
 * ruta pública dinámica que generar. El sitemap son las siete públicas y ya.
 * Si algún día se abre una parte del catálogo, se añade en RUTAS_PUBLICAS
 * (src/lib/seo.ts) y aparece aquí sola.
 *
 * 🔴 SIN `lastModified`, Y ES DELIBERADO.
 *
 * La única fecha que este archivo podría poner es `new Date()`, y eso diría que
 * las siete páginas cambiaron en el momento exacto en que Google pidió el
 * sitemap — cada vez que lo pida. Un sitemap que afirma que todo cambió hoy no
 * es información, es ruido, y Google aprende a ignorar el campo.
 *
 * La fecha real de cada página no está en ninguna parte a la que este código
 * pueda llegar: las legales tienen su versión en la base (documentos legales
 * versionados), la landing se regenera cada hora por ISR sin que su contenido
 * cambie, y /status es estática. Omitir el campo es la respuesta honesta.
 * `lastModified` es opcional en la spec y en la API de Next.
 *
 * Cuando haya de dónde sacarlas de verdad —la tabla de versiones legales para
 * /terminos y /privacidad, por ejemplo—, se añaden solo a esas.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return RUTAS_PUBLICAS.map(({ ruta, prioridad, frecuencia }) => ({
    url: urlAbsoluta(ruta),
    changeFrequency: frecuencia,
    priority: prioridad,
  }))
}
