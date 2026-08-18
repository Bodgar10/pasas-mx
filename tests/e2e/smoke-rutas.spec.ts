import { test, expect } from '@playwright/test'

/**
 * E1 — SMOKE DE RUTAS.
 *
 * 🔴 QUÉ CLASE DE FALLO ATACA.
 *
 * Un layout nuevo en un grupo de rutas rompiendo el render de una página
 * vecina. Es exactamente la forma que tienen los cambios de SEO de hacer
 * daño: `metadata`, `robots` y los layouts de grupo se tocan en un archivo y
 * el efecto aparece en otro, sin error de compilación y sin que nadie lo
 * note hasta que alguien recorre la ruta a mano.
 *
 * No prueba comportamiento. Prueba que la página EXISTE, responde 200 y pinta
 * su encabezado — y que las protegidas siguen protegidas. Eso es poco, pero
 * es lo que hoy no comprueba nadie, y corre en segundos sin base de datos de
 * prueba.
 *
 * ── SOBRE LOS TEXTOS ──────────────────────────────────────────────────
 * Donde el H1 es estable y significativo (las legales) se afirma el texto
 * exacto: si "Aviso de Privacidad" desaparece, eso importa. Donde el H1 es
 * decorativo o tiene variantes A/B (la landing, el logo de /login) solo se
 * exige que exista y no esté vacío — acoplarse a esas palabras haría fallar
 * la prueba en cada cambio de copy sin aportar una sola señal.
 *
 * ── ESTA PRUEBA LEE DE LA BASE DE PRODUCCIÓN ──────────────────────────
 * No escribe nada: navega sin sesión, igual que un visitante. La landing y
 * /status hacen sus lecturas de siempre. Cuando exista un proyecto de
 * prueba, basta apuntar las variables de entorno del servidor a él.
 */

/** Rutas públicas indexables — la lista es RUTAS_PUBLICAS de src/lib/seo.ts. */
const PUBLICAS: { ruta: string; h1: string | null }[] = [
  // La landing tiene tres variantes de hero según utm_source (detectAudience),
  // así que su H1 no es una constante.
  { ruta: '/', h1: null },
  { ruta: '/ayuda', h1: 'Preguntas frecuentes' },
  { ruta: '/como-cancelar', h1: 'Cómo cancelar tu suscripción' },
  { ruta: '/reembolso', h1: 'Política de Reembolso' },
  { ruta: '/status', h1: 'Estado del sistema' },
  { ruta: '/terminos', h1: 'Términos y Condiciones Generales de Uso' },
  { ruta: '/privacidad', h1: 'Aviso de Privacidad' },
]

/**
 * Rutas que responden a un anónimo pero NO son indexables.
 *
 * 🔴 /planes y /agregar-alumno están aquí y no entre las protegidas, y eso
 * NO es un descuido de la prueba: el middleware solo cubre /dashboard, /guia,
 * /perfil y /admin (PROTECTED_PREFIXES). El resto del grupo (protected)
 * responde 200 sin sesión — lo dice el propio layout del grupo, que por eso
 * lleva noindex. La prueba fija el comportamiento REAL de hoy.
 */
const SIN_SESION: { ruta: string; h1: string | null }[] = [
  { ruta: '/login', h1: null },
  { ruta: '/registro', h1: null },
  { ruta: '/recuperar', h1: null },
  { ruta: '/nueva-contrasena', h1: null },
  { ruta: '/bienvenida', h1: null },
  { ruta: '/registro-bloqueado', h1: 'El registro lo debe hacer tu padre, madre o tutor' },
  { ruta: '/planes', h1: 'Elige tu plan' },
]

/** Las cuatro de PROTECTED_PREFIXES en src/middleware.ts. */
const PROTEGIDAS = ['/dashboard', '/perfil', '/admin', '/guia/matematicas']

test.describe('rutas públicas', () => {
  for (const { ruta, h1 } of PUBLICAS) {
    test(`${ruta} responde 200 y pinta su H1`, async ({ page }) => {
      const respuesta = await page.goto(ruta)

      expect(respuesta?.status(), `${ruta} no respondió 200`).toBe(200)
      expect(new URL(page.url()).pathname, `${ruta} redirigió`).toBe(ruta)

      const encabezado = page.locator('h1').first()
      await expect(encabezado).toBeVisible()

      if (h1) {
        await expect(encabezado).toHaveText(h1)
      } else {
        // Sin texto no hay página: es la señal de que el render se cayó.
        await expect(encabezado).not.toBeEmpty()
      }
    })
  }
})

test.describe('rutas accesibles sin sesión', () => {
  for (const { ruta, h1 } of SIN_SESION) {
    test(`${ruta} responde 200 y pinta su H1`, async ({ page }) => {
      const respuesta = await page.goto(ruta)

      expect(respuesta?.status(), `${ruta} no respondió 200`).toBe(200)

      const encabezado = page.locator('h1').first()
      await expect(encabezado).toBeVisible()

      if (h1) {
        await expect(encabezado).toHaveText(h1)
      } else {
        await expect(encabezado).not.toBeEmpty()
      }
    })
  }
})

test.describe('rutas protegidas', () => {
  for (const ruta of PROTEGIDAS) {
    test(`${ruta} redirige a /login sin sesión`, async ({ page }) => {
      await page.goto(ruta)

      // El middleware devuelve un 307 y el navegador lo sigue: lo que se
      // comprueba es dónde se acabó, no el código intermedio.
      expect(new URL(page.url()).pathname, `${ruta} NO redirigió a /login`).toBe('/login')
    })
  }
})

test.describe('archivos de SEO', () => {
  // Los dos que produjo el cambio de la semana pasada. Si robots.ts o
  // sitemap.ts revientan, hoy nadie se entera: no los abre ningún humano.
  test('/robots.txt se sirve y no cierra el sitio entero', async ({ page }) => {
    const respuesta = await page.goto('/robots.txt')

    expect(respuesta?.status()).toBe(200)
    const cuerpo = await respuesta!.text()
    expect(cuerpo).toContain('User-Agent: *')
    // En el dominio bueno se sirve el sitemap. Un `Disallow: /` a secas aquí
    // significaría que el host se está leyendo mal y el sitio se cerró solo.
    expect(cuerpo).toContain('Sitemap:')
  })

  test('/sitemap.xml lista las siete rutas públicas', async ({ page }) => {
    const respuesta = await page.goto('/sitemap.xml')

    expect(respuesta?.status()).toBe(200)
    const cuerpo = await respuesta!.text()
    expect(cuerpo.match(/<url>/g) ?? []).toHaveLength(PUBLICAS.length)
    // 🔴 Ninguna ruta tras login puede acabar en el sitemap.
    expect(cuerpo).not.toContain('/dashboard')
    expect(cuerpo).not.toContain('/autorizar-menor')
  })
})
