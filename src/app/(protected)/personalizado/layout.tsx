import { redirect } from 'next/navigation'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

/**
 * Este redirect sale como <meta http-equiv="refresh">, no como 307: el
 * shell ya se envió cuando el layout lo resuelve, así que no hay headers
 * donde poner el Location. force-dynamic NO lo arregla — se probó.
 *
 * Se acepta a propósito. El embudo queda cerrado igual: ninguna página
 * de abajo se monta y preview-ia no llega a Anthropic. El costo es ~1 s
 * de pantalla en blanco y un 200 para crawlers.
 *
 * Ese 200 sí importa: el sitio NO tiene noindex global (verificado — el
 * root layout no define robots y no existe robots.ts). De ahí el export
 * de metadata de abajo, que es lo que evita que estas tres rutas se
 * indexen como páginas vacías.
 *
 * Si algún día hace falta el 307 limpio, la vía es el middleware —
 * es lo que hace /guia/personalizado/* al mandar 307 a /login.
 */
export const metadata = {
  robots: { index: false, follow: false },
}

/**
 * Puerta del embudo del plan Personalizado.
 *
 * Las tres páginas de abajo (materia → diagnostico → preview-ia) ya no
 * están enlazadas desde ningún lado, pero seguían sirviéndose por URL
 * directa: historial, marcador, enlace compartido. Un usuario podía
 * recorrer el embudo completo —gastando llamadas a Anthropic en
 * preview-ia— y chocar contra el muro hasta el final.
 *
 * El layout corre antes que cualquier página anidada, así que un solo
 * archivo cierra las tres. Cuando se reactive el plan, basta con poner
 * NEXT_PUBLIC_ENABLE_PERSONALIZED_PLAN=true.
 *
 * OJO: esto NO afecta a /guia/personalizado/*, que es contenido de
 * clientes que ya pagaron y vive en otro árbol de rutas.
 */
export default function PersonalizadoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN) {
    redirect('/planes')
  }

  return <>{children}</>
}
