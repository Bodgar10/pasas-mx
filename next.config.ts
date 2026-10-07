import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
