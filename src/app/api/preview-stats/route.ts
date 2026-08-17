import { NextResponse, type NextRequest } from 'next/server'
import { esGrado, esNivel, leerStats, type Nivel } from '@/lib/preview-stats'

/**
 * GET /api/preview-stats?nivel=middle_school&grado=2
 * ---------------------------------------------------------------------------
 * Conteos para /onboarding/preview.
 *
 * 🔴 EL CONTRATO NO CAMBIÓ: misma URL, mismos parámetros, mismos códigos y
 * mismo cuerpo de respuesta. Lo único que se movió es de dónde salen los
 * números — ahora de @/lib/preview-stats, que la página también usa desde el
 * servidor sin pasar por aquí.
 *
 * Se conserva aunque la página ya no lo llame: puede haber algo más que sí.
 *
 * Solo devuelve números. Ningún contenido, ninguna pregunta, ningún nombre de
 * tema. Si alguien llama este endpoint a mano, lo peor que obtiene es saber
 * cuántos ejercicios hay.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nivelRaw = searchParams.get('nivel') ?? ''
  const gradoRaw = Number(searchParams.get('grado'))

  // Validación estricta: solo dos niveles y tres grados existen.
  // Sin esto, cualquiera podría sondear la función con valores arbitrarios.
  if (!esNivel(nivelRaw)) {
    return NextResponse.json({ error: 'nivel inválido' }, { status: 400 })
  }
  if (!esGrado(gradoRaw)) {
    return NextResponse.json({ error: 'grado inválido' }, { status: 400 })
  }

  const stats = await leerStats(nivelRaw as Nivel, gradoRaw)

  if (!stats) {
    // Que falle en silencio: la pantalla simplemente no muestra los números.
    return NextResponse.json({ error: 'sin datos' }, { status: 503 })
  }

  return NextResponse.json(stats)
}
