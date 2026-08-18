import { defineConfig } from 'vitest/config'

/**
 * Configuración de Vitest — SOLO la capa unitaria.
 *
 * 🔴 `environment: 'node'` y NO 'jsdom'. La guía de Next
 * (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md) instala
 * jsdom, @vitejs/plugin-react y testing-library porque su ejemplo renderiza
 * componentes. Aquí no se renderiza ninguno: los 9 archivos de prueba
 * importan módulos de TypeScript puro. Un entorno de navegador falso sería
 * peso muerto y tres dependencias más que mantener.
 *
 * 🔴 `resolve.tsconfigPaths` y NO el plugin vite-tsconfig-paths. Vite lo
 * resuelve de forma nativa desde su versión 7 —lo avisa él mismo en cada
 * corrida si el plugin está puesto—, así que el paquete sobraba. Esto es lo
 * que hace que `@/lib/...` funcione en las pruebas, leyendo los `paths` de
 * tsconfig.json sin duplicarlos aquí.
 *
 * 🔴 `include` apunta SOLO a tests/unit. Por defecto Vitest recoge también
 * `**\/*.spec.ts`, que es justo el patrón de los archivos de Playwright:
 * sin esta línea, `npm test` intentaría correr el smoke con el runner
 * equivocado y fallaría con un error que no dice nada.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/setup-env.ts'],
  },
})
