import type { Metadata } from "next";
import { Orbitron, Nunito } from "next/font/google";
import "./globals.css";
import Starfield from "@/components/starfield";
import { PostHogProvider } from "@/components/posthog-provider";
import { Suspense } from "react";
import UTMPersistence from "@/components/global/UTMPersistence";
import AnalyticsScripts from "@/components/global/AnalyticsScripts";
import CookieConsent from "@/components/global/CookieConsent";

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

export const metadata: Metadata = {
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
      lang="en"
      className={`${orbitron.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ position: 'relative' }}>
        {/* GA4 y Clarity viven en AnalyticsScripts: solo cargan con
            consentimiento. NO devolverlos aquí. */}
        <AnalyticsScripts />
        <Starfield />
        <Suspense>
          <UTMPersistence />
          <PostHogProvider>
            <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </div>
          </PostHogProvider>
        </Suspense>
        {/* Al final del body y position:fixed — se pinta sobre todo,
            incluidas las pantallas legales y el WhatsApp flotante. */}
        <CookieConsent />
      </body>
    </html>
  );
}
