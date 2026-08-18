'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { COOKIE_CONSENT_EVENT, permiteAnalytics, permiteMarketing } from '@/lib/consent'

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
 *
 * ── s32: también los pixels de Meta y TikTok ──────────────────────────
 * Van detrás de `permiteMarketing()`, que es OTRA categoría: quien aceptó
 * "Análisis de uso" no ha aceptado transferencias a terceros. Por eso hay
 * dos estados y cada bloque lleva su propia guarda, en vez del `return null`
 * único que había antes — con uno solo, aceptar marketing sin analítica no
 * habría cargado nada.
 *
 * Sin pixel de navegador, el `event_id` de lib/analytics/track.ts no tiene
 * contra qué deduplicar y Meta pierde `fbp`/`fbc`, que es la mitad de la
 * atribución.
 */
export default function AnalyticsScripts() {
  const [ok, setOk] = useState(false)
  // Categoría SEPARADA. Meta y TikTok son transferencias a terceros
  // (art. 35 LFPDPPP), no medición propia: quien acepta "Análisis de uso"
  // NO ha aceptado esto. Por eso es otro estado y no el mismo `ok`.
  const [okMarketing, setOkMarketing] = useState(false)

  useEffect(() => {
    setOk(permiteAnalytics())
    const alCambiar = () => setOk(permiteAnalytics())
    window.addEventListener(COOKIE_CONSENT_EVENT, alCambiar)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, alCambiar)
  }, [])

  useEffect(() => {
    setOkMarketing(permiteMarketing())
    const alCambiar = () => setOkMarketing(permiteMarketing())
    window.addEventListener(COOKIE_CONSENT_EVENT, alCambiar)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, alCambiar)
  }, [])

  const ga4 = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const clarity = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
  const metaPixel = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const tiktokPixel = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

  return (
    <>
      {ok && ga4 && (
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

      {ok && clarity && (
        <Script id="microsoft-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${clarity}");
        `}</Script>
      )}

      {okMarketing && metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${metaPixel}');
          fbq('track', 'PageView');
        `}</Script>
      )}

      {okMarketing && tiktokPixel && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
            ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
            ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
            for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
            ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
            ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
            ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
            ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");
            o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
            var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
            ttq.load('${tiktokPixel}');
            ttq.page();
          }(window, document, 'ttq');
        `}</Script>
      )}
    </>
  )
}
