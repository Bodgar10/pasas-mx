import type { Metadata } from "next";
import { Orbitron, Nunito } from "next/font/google";
import "./globals.css";
import Starfield from "@/components/starfield";
import { PostHogProvider } from "@/components/posthog-provider";
import { Suspense } from "react";
import UTMPersistence from "@/components/global/UTMPersistence";
import PromoPersistence from "@/components/global/PromoPersistence";
import AnalyticsScripts from "@/components/global/AnalyticsScripts";
import CookieConsent from "@/components/global/CookieConsent";
import { SITIO } from "@/lib/seo";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["700", "900"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

/**
 * 🔴 `metadataBase` ES LO QUE HACE QUE LOS CANONICAL FUNCIONEN.
 *
 * Sin él, cualquier ruta que declare `alternates.canonical: '/algo'` —una ruta
 * relativa— revienta el build. Con él, cada página escribe su canonical en
 * relativo y Next lo compone contra el dominio canónico.
 *
 * También arregla las URL de Open Graph: hasta ahora `og:url` estaba escrito a
 * mano en page.tsx porque no había base contra la que resolver.
 *
 * El canonical de la raíz va aquí y no en page.tsx porque este layout es el
 * único sitio por el que pasan todas las rutas; cada ruta pública declara el
 * suyo y sobreescribe este.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: "Pasas.mx",
  description: "Guías de estudio personalizadas para estudiantes mexicanos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${orbitron.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ position: 'relative' }}>
        {/* GA4 y Clarity viven en AnalyticsScripts: solo cargan con
            consentimiento. NO devolverlos aquí. */}
        <AnalyticsScripts />
        <Starfield />
        {/*
          🔴 UN <Suspense> POR COMPONENTE, Y `children` FUERA DE TODOS.

          Aquí había UN SOLO <Suspense> envolviendo a los tres persistidores
          MÁS `{children}`. Los tres llaman a useSearchParams, y eso hace que
          Next renderice en cliente todo el subárbol hasta el <Suspense> más
          cercano. Ese boundary era el de la página entera, así que el HTML
          inicial de TODO EL SITIO —landing, términos, privacidad, ayuda— era
          literalmente esto:

              <div hidden=""><!--$--><!--/$--></div>

          Cero texto. Los Términos servían 110 KB de HTML con 0 caracteres de
          contenido. Google no veía una palabra de ninguna página.

          Ahora cada persistidor tiene su propio boundary. Los tres devuelven
          `null`, así que el bailout no les cuesta nada: no hay nada visible
          dentro que dejar de prerenderizar. Y `children` ya no está dentro de
          ninguno, así que las páginas vuelven a salir en el HTML.

          🔴 NO vuelvas a meter `children` dentro de un <Suspense> junto a algo
          que lea la URL. Es exactamente el bug que esto arregla, y no da
          ningún síntoma visible: la página se ve igual en el navegador.

          El <Suspense> de PostHogPageView vive dentro de posthog-provider.tsx,
          no aquí: PHProvider tiene que seguir envolviendo a `children` para
          darles el contexto del cliente de PostHog.
        */}
        <Suspense fallback={null}>
          <UTMPersistence />
        </Suspense>
        <Suspense fallback={null}>
          <PromoPersistence />
        </Suspense>
        <PostHogProvider>
          <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </PostHogProvider>
        {/* Al final del body y position:fixed — se pinta sobre todo,
            incluidas las pantallas legales y el WhatsApp flotante. */}
        <CookieConsent />
      </body>
    </html>
  );
}
