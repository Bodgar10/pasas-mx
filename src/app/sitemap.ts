import type { MetadataRoute } from 'next'
import { RUTAS_PUBLICAS, urlAbsoluta } from '@/lib/seo'
import { temasPublicos } from '@/lib/horda-publica-server'
import { urlHordaPublica } from '@/lib/horda-publica'

/**
 * Sitemap del sitio: las ocho rutas fijas más una por cada tema con Horda
 * pública (historia, ver src/lib/horda-publica.ts).
 *
 * 🔴 CASI TODO EL CONTENIDO ESTÁ TRAS LOGIN. Las guías, los temas y el catálogo
 * entero viven bajo /guia y /dashboard, que exigen sesión. Lo público es
 * /arcade (reto diario) y la Horda pública de historia (/horda/...), que se
 * lee de la base. Las rutas fijas se añaden en RUTAS_PUBLICAS
 * (src/lib/seo.ts) y aparecen aquí solas.
 *
 * 🔴 SIN `lastModified`, Y ES DELIBERADO.
 *
 * La única fecha que este archivo podría poner es `new Date()`, y eso diría que
 * las ocho páginas cambiaron en el momento exacto en que Google pidió el
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
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = RUTAS_PUBLICAS.map(({ ruta, prioridad, frecuencia }) => ({
    url: urlAbsoluta(ruta),
    changeFrequency: frecuencia,
    priority: prioridad,
  }))

  // La Horda pública: una página por tema de historia (oleadas 1 a 3 sin
  // cuenta). Si la lectura falla, el sitemap sale con las fijas.
  let hordas: MetadataRoute.Sitemap = []
  try {
    hordas = (await temasPublicos()).map((t) => ({
      url: urlAbsoluta(urlHordaPublica(t.subjectSlug, t.topicSlug)),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  } catch (e) {
    console.error('[sitemap] temas de la Horda pública:', e)
  }

  return [...fijas, ...hordas]
}
