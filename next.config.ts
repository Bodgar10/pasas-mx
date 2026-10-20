import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/image sirve AVIF a quien lo acepta y WebP al resto (el default es
  // solo WebP). Las capturas de la landing son PNG de 100–240 KB: en AVIF
  // pesan una fracción. El AVIF tarda más en codificarse la PRIMERA vez que
  // se pide cada tamaño; después sale de la caché del optimizador.
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Las imágenes del Arcade (vista previa y historia) leen sus fuentes .ttf
  // con readFile. El trazado automático no ve esas lecturas, así que se
  // incluyen a mano en las funciones de esas rutas.
  outputFileTracingIncludes: {
    "/arcade/**": ["./src/app/arcade/_og/fuentes/**/*"],
  },

  // s39 — /arcade?materia=historia sirve el reto más reciente de esa materia
  // (src/app/arcade/materia/[materia]). Es lo que llevan los anuncios por
  // materia. Va en `beforeFiles` porque /arcade existe como página: un rewrite
  // normal (afterFiles) nunca se aplicaría. La URL del navegador no cambia y
  // conserva sus UTM. /arcade sin ?materia= sigue igual (ISR de 60 s).
  async rewrites() {
    return {
      beforeFiles: [
        // s47 — "Verdadero o mentira": /arcade?juego=vom (con o sin materia)
        // va a su propia ruta ISR. Así el servidor ya sabe qué juego pintar y
        // no hay parpadeo de "¿Cuál sobra?" antes de cambiar. Van PRIMERO:
        // gana la primera regla que coincide.
        {
          source: "/arcade",
          has: [
            { type: "query", key: "juego", value: "vom" },
            { type: "query", key: "materia", value: "(?<materia>[^&]{1,40})" },
          ],
          destination: "/arcade/vom/materia/:materia",
        },
        {
          source: "/arcade",
          has: [{ type: "query", key: "juego", value: "vom" }],
          destination: "/arcade/vom",
        },
        {
          source: "/arcade",
          has: [{ type: "query", key: "materia", value: "(?<materia>[^&]{1,40})" }],
          destination: "/arcade/materia/:materia",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
