import type { Metadata } from "next";
import { Orbitron, Nunito } from "next/font/google";
import "./globals.css";
import Starfield from "@/components/starfield";
import { PostHogProvider } from "@/components/posthog-provider";
import { Suspense } from "react";
import UTMPersistence from "@/components/global/UTMPersistence";
import Script from "next/script";

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
        {/* Google Analytics 4 */}
        {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}');
            `}</Script>
          </>
        )}

        <Script id="microsoft-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
        `}</Script>
        <Starfield />
        <Suspense>
          <UTMPersistence />
          <PostHogProvider>
            <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </div>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
