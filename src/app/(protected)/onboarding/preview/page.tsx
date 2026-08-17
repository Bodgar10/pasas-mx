import { Suspense } from 'react'
import PreviewClient from './preview-client'
import BloqueStats, { EsqueletoStats } from './bloque-stats'
import { esGrado, esNivel } from '@/lib/preview-stats'

/**
 * /onboarding/preview — componente de SERVIDOR.
 *
 * 🔴 POR QUÉ SE PARTIÓ. La pantalla entera era 'use client' y pedía los
 * conteos con un fetch dentro de un useEffect. Medido en `next start`: con la
 * caché caliente el endpoint contesta en 3-6ms y aun así el bloque tardaba
 * 1-2s en aparecer, porque el camino real era navegación → bundle →
 * hidratación → fetch → pintado. La query nunca fue el cuello de botella; la
 * cascada sí. Ahora los números se leen aquí y viajan en el HTML.
 *
 * Y se llama a `leerStats()` DIRECTO, no a /api/preview-stats: un fetch a tu
 * propio origen es un salto de red contra ti mismo. El endpoint sigue en pie
 * y con el mismo contrato, consumiendo la misma función.
 */

// Los mismos mapeos que usa registro/actions.ts para traducir las etiquetas
// del onboarding a los valores del enum de la base.
const NIVEL_DB: Record<string, string> = {
  Secundaria: 'middle_school',
  'Preparatoria / Bachillerato': 'high_school',
  'Examen de Preparatoria': 'high_school',
  'Examen de Universidad': 'high_school',
}
const GRADO_DB: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const leer = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null)

  const level = leer('level') ?? ''
  const grade = leer('grade')
  const esTutor = leer('registrante') === 'tutor'

  const nivelDb = NIVEL_DB[level]
  const gradoDb = grade ? GRADO_DB[grade] : null

  /**
   * 🔴 PRIMER CAMINO DE OCULTAMIENTO: sin nivel válido o sin grado no hay nada
   * que preguntar, y eso NO es un estado de carga — es una respuesta, y se
   * sabe aquí, antes de renderizar nada.
   *
   * Pasa de verdad con los niveles de examen, que entran sin grado
   * (needsGrade: false en el onboarding). Durante dos meses ese caso dejó
   * cuatro cajas vacías puestas indefinidamente, porque el efecto del cliente
   * salía antes de pedir y nadie marcaba que ya no vendría nada. Al devolver
   * null, PreviewClient no pinta ni el bloque ni su rótulo.
   *
   * Los otros dos caminos —lectura fallida y cero temas— los resuelve
   * BloqueStats, que es quien tiene los números.
   */
  const puedeConsultar = esNivel(nivelDb ?? '') && gradoDb != null && esGrado(gradoDb)

  const bloqueStats = puedeConsultar ? (
    /**
     * <Suspense> para que el bloque NO retenga el resto de la pantalla. En un
     * hit de caché (~5ms medidos) los números salen en el HTML inicial y el
     * fallback ni se ve; en un miss (~930ms) se transmite después y mientras
     * tanto queda el esqueleto, con el hueco ya reservado a su medida.
     */
    <Suspense fallback={<EsqueletoStats esTutor={esTutor} />}>
      <BloqueStats
        nivel={nivelDb as 'middle_school' | 'high_school'}
        grado={gradoDb as number}
        grade={grade}
        level={level}
        esTutor={esTutor}
      />
    </Suspense>
  ) : null

  return <PreviewClient bloqueStats={bloqueStats} />
}
