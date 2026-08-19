import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Configuración de la capa de INTEGRACIÓN. Se corre con `npm run test:int`.
 *
 * 🔴 ES UN ARCHIVO APARTE Y ESA ES LA MITAD DE LA PROTECCIÓN.
 *
 * `vitest.config.mts` —el de la capa unitaria, el que corre el pre-push— no
 * carga credenciales de base de datos ni conoce la guarda. No es que esté
 * prohibido que toque una base: es que no tiene con qué. `npm test` no puede
 * escribir en ninguna parte ni equivocándose.
 *
 * Aquí, en cambio, sí hay credenciales, y por eso `setup-integracion.ts`
 * comprueba el destino antes de dejar correr nada.
 *
 * `fileParallelism: false` porque estas pruebas comparten una única base: en
 * paralelo, la limpieza de una borraría las filas que otra está usando. Es
 * más lento y es el precio correcto.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      /**
       * 🔴 `server-only` NO EXISTE EN node_modules.
       *
       * Next lo resuelve con un alias interno de su bundler, así que fuera de
       * Next cualquier import suyo revienta con "Cannot find package".
       * `src/lib/payments/promo-checkout.ts` lo importa a propósito —para que
       * un import desde un componente de cliente no compile— y esa protección
       * sigue intacta en el build real.
       *
       * Aquí se le da un destino vacío. Es configuración de pruebas, no un
       * parche al código.
       */
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integracion/**/*.test.ts'],
    setupFiles: ['./tests/setup-integracion.ts'],
    passWithNoTests: true,
    fileParallelism: false,
  },
})
