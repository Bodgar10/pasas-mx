'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { COOKIE_CONSENT_EVENT, permiteAnalytics } from '@/lib/consent'

/**
 * GA4 y Clarity. Antes vivían sueltos en layout.tsx y cargaban SIEMPRE,
 * sin preguntarle a nadie.
 *
 * 🔴 No devolver los <Script> a layout.tsx. Ahí no hay forma de leer el
 * consentimiento, que es cliente puro.
 *
 * El listener existe para que aceptar en el banner encienda los scripts
 * sin recargar. Sin él, quien acepta no queda medido hasta su siguiente
 * visita — y el número que verías estaría mal por abajo.
 *
 * No hay camino de vuelta: quien acepta y luego revoca sigue con el script
 * cargado hasta que recargue. Es una limitación conocida de gtag y clarity;
 * revocar deja de enviar en la siguiente carga.
 */
export default function AnalyticsScripts() {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    setOk(permiteAnalytics())
    const alCambiar = () => setOk(permiteAnalytics())
    window.addEventListener(COOKIE_CONSENT_EVENT, alCambiar)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, alCambiar)
  }, [])

  if (!ok) return null

  const ga4 = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const clarity = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

  return (
    <>
      {ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga4}');
          `}</Script>
        </>
      )}

      {clarity && (
        <Script id="microsoft-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${clarity}");
        `}</Script>
      )}
    </>
  )
}
