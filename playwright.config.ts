import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright — hoy solo el smoke de rutas.
 *
 * 🔴 SE CORRE CONTRA EL BUILD DE PRODUCCIÓN, no contra `next dev`.
 *
 * La guía de Next lo recomienda
 * (node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md) y aquí
 * hay una razón extra: en `dev` cada ruta se compila la primera vez que se
 * pide, así que un smoke de catorce rutas mediría tiempos de compilación en
 * vez de render. Con `start`, las catorce responden en milisegundos.
 *
 * `reuseExistingServer` evita repetir el build cuando ya hay un servidor
 * escuchando: si estás con `npm run start` en otra terminal, el smoke se
 * engancha a ese.
 *
 * 🔴 VARIABLES QUE NECESITA EL SERVIDOR.
 *
 * Next carga .env.local solo. Con lo que ese archivo tiene HOY, `npm run
 * build` FALLA: src/lib/payments/stripe.ts hace throw al importarse sin
 * STRIPE_SECRET_KEY, y la recolección de datos de /api/admin/promo/verify lo
 * dispara. Es un problema preexistente del entorno local, no del smoke.
 *
 * Hasta que .env.local la tenga, el smoke se corre así:
 *
 *   STRIPE_SECRET_KEY=sk_test_loquesea npm run test:e2e
 *
 * No hace falta que sea una llave válida: el build no llama a la API de
 * Stripe, solo construye el cliente. Cuando exista la cuenta sandbox, se
 * pone la de test y esta nota sobra.
 * Solo Chromium: el smoke verifica que las páginas RENDERIZAN, no que se vean
 * igual en tres motores. Correr los tres triplicaría el tiempo sin añadir una
 * sola señal nueva.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    // El build de este proyecto tarda; 3 minutos es holgado sin ser eterno.
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
