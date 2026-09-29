import { NextResponse } from 'next/server'
import { temaPorSlugs } from '@/lib/horda-publica-server'
import { urlOnboarding } from '@/lib/horda-publica'

/**
 * GET /unete/[subject]/[topic] — el link corto del muro de la Horda pública.
 *
 * Lo abre el papá o la mamá (desde el mensaje del alumno) o el adulto que
 * tocó "Soy papá, mamá o tutor". Redirige al onboarding de siempre con nivel,
 * grado y quién registra ya puestos, así que solo falta el tema favorito.
 * El embudo de cobro que sigue no cambia.
 *
 * `?quien=adulto` marca que entró directo desde el muro y no por el mensaje.
 */
export async function GET(req: Request, { params }: { params: Promise<{ subject: string; topic: string }> }) {
  const { subject, topic } = await params
  const destino = new URL('/onboarding', req.url)

  const tema = await temaPorSlugs(subject, topic)
  if (tema) {
    const directo = new URL(req.url).searchParams.get('quien') === 'adulto'
    const url = urlOnboarding({
      nivel: tema.nivel,
      grado: tema.grado,
      tema: tema.topicName,
      origen: directo ? 'horda_muro' : 'horda_papa',
    })
    return NextResponse.redirect(new URL(url, req.url), 307)
  }
  return NextResponse.redirect(destino, 307)
}
