import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { REF_PRODUCCION } from '../guarda-db'

/**
 * 🔴 LA GUARDA, VISTA DISPARAR DE VERDAD.
 *
 * El otro archivo (guarda-db.test.ts) prueba la FUNCIÓN. Este prueba la
 * CADENA COMPLETA: lanza el runner de integración de verdad, con una URL de
 * producción en el entorno, y comprueba que la suite se niega a arrancar.
 *
 * Es la diferencia entre "la función lanza si la llamas" y "el sistema
 * aborta". Entre las dos cosas hay un setupFile, un orden de carga y un
 * `override: true` en dotenv — cualquiera de los tres podría estar mal y las
 * pruebas de la función seguirían pasando.
 *
 * Tarda unos segundos porque arranca otro proceso de Vitest. Es el único
 * caso lento de la capa unitaria y se gana su sitio: sin él, la afirmación
 * "una prueba no puede tocar producción" es una suposición.
 */

const RAIZ = resolve(__dirname, '../..')

/** Corre `npm run test:int` con el entorno que se le indique. */
function correrIntegracionCon(env: Record<string, string>): { code: number; salida: string } {
  try {
    const salida = execFileSync('npx', ['vitest', 'run', '--config', 'vitest.config.integracion.mts'], {
      cwd: RAIZ,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...env },
    })
    return { code: 0, salida }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { code: e.status ?? 1, salida: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

describe('la guarda, de punta a punta', () => {
  it(
    '🔴 con una URL de PRODUCCIÓN, la suite de integración ABORTA',
    () => {
      const { code, salida } = correrIntegracionCon({
        NEXT_PUBLIC_SUPABASE_URL: `https://${REF_PRODUCCION}.supabase.co`,
      })

      // No basta con que falle: tiene que fallar POR ESTO.
      expect(code).not.toBe(0)
      expect(salida).toContain('ESTÁS APUNTANDO A PRODUCCIÓN')
      expect(salida).toContain(REF_PRODUCCION)
    },
    60_000
  )

  it(
    'con la URL local, la suite arranca con normalidad',
    () => {
      // El contrapeso. Sin este caso, una guarda que abortara SIEMPRE —por un
      // error tonto— también pasaría la prueba de arriba, y nadie podría
      // correr nunca las pruebas de integración.
      //
      // Requiere la base local levantada (`supabase start`).
      const { code, salida } = correrIntegracionCon({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      })

      expect(salida).not.toContain('ESTÁS APUNTANDO A PRODUCCIÓN')
      expect(code).toBe(0)
    },
    60_000
  )
})
