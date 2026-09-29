import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las imágenes del Arcade (vista previa y historia) leen sus fuentes .ttf
  // con readFile. El trazado automático no ve esas lecturas, así que se
  // incluyen a mano en las funciones de esas rutas.
  outputFileTracingIncludes: {
    "/arcade/**": ["./src/app/arcade/_og/fuentes/**/*"],
  },
};

export default nextConfig;
