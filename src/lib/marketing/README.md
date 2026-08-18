# `src/lib/marketing/`

Envío de eventos a Meta (Conversions API) y TikTok (Events API) **desde el
servidor**.

| Archivo | Qué es |
|---|---|
| `meta-capi.ts` | `sendMetaCapiEvent()` — POST a `graph.facebook.com`. Hashea el correo con SHA-256. |
| `tiktok-events.ts` | `sendTikTokEvent()` — POST a `business-api.tiktok.com`. |
| `track-event.ts` | **Código muerto.** Cero importaciones en todo `src/`. Ver abajo. |

Los dos helpers vivos tienen **dos** consumidores, y los dos los importan como
funciones, sin pasar por HTTP:

- `src/app/api/webhooks/stripe/route.ts` — `Subscribe` / `CompletePayment` tras
  cada pago, detrás de `cookie_consent_marketing === true`.
- `src/lib/analytics/track-server.ts` — la rama de marketing de `trackServer()`.

---

## 🔴 Hubo dos endpoints HTTP aquí. Se borraron en s40.

`POST /api/meta/capi` y `POST /api/tiktok/events` existieron desde junio y
**nunca los llamó nadie**: cero importaciones, cero `fetch` en todo el repo.

Aceptaban cualquier petición **sin autenticación de ningún tipo**. Lo único que
validaban era que `event_name` existiera. Con eso se podía:

- Inyectar conversiones falsas en el píxel (`Subscribe`, `value: 999999`).
- **Envenenar el modelo de optimización de las campañas** — más caro que el
  ruido en los informes, porque Meta empieza a buscar gente parecida a
  conversiones que no existen.
- Quemar la cuota de la Conversions API.
- Confirmar si un correo concreto está en la audiencia: quien llama elige el
  correo, y la respuesta devolvía el JSON crudo de Meta.

Se borraron en vez de protegerse porque **un endpoint que no existe no se puede
atacar**, y porque la protección habría sido en parte teatro: un rate limit en
memoria sobre Vercel no limita nada —cada instancia serverless tiene su propio
contador y se crean bajo carga— así que habría dado falsa sensación de
seguridad.

### El día que hagan falta, NO serán estos archivos

Esto es lo importante y por eso está escrito aquí y no en un commit que nadie
va a releer. Reponerlos **no es "recuperar lo borrado"**: es construir algo
distinto, porque aquellos dos no servían para el caso de uso real.

El caso real es mandar eventos **desde el navegador** hacia CAPI, para
complementar el píxel. Eso necesita dos cosas que aquellos no tenían:

1. **Autenticación de SESIÓN, no un secreto compartido.** `supabase.auth.getUser()`
   en el handler, igual que el resto de `/api/`. Un secreto en el navegador no
   es un secreto: viaja en el bundle.

2. **`event_id` compartido con el píxel.** Sin él, cada evento enviado por ahí
   se cuenta DOS VECES: una por el píxel del navegador y otra por CAPI.
   🔴 Y ese trabajo sigue pendiente aguas arriba: `sendMetaCapiEvent()` y
   `sendTikTokEvent()` **todavía no aceptan ese campo**. Es la misma razón por
   la que `checkout_completed` sigue fuera de `MAPEO_META` y `MAPEO_TIKTOK` en
   `src/lib/analytics/track.ts` — el webhook ya manda `Subscribe` y duplicarlo
   sin `event_id` sería contar dos ventas.

Es decir: **antes de reponer ningún endpoint hay que añadir `eventId` a los dos
helpers.** Mientras eso no exista, cualquier endpoint nuevo hereda el mismo
problema de doble conteo.

Los archivos borrados están en el historial de git (s40), pero servirán de poco:
eran 30 líneas sin autenticación ni deduplicación.

---

## `track-event.ts` está muerto

`trackEvent()` no lo importa nadie. Dispara a `window.fbq`, `window.ttq` y
`window.gtag` sin comprobar consentimiento, y usa un vocabulario cerrado de
nombres de Meta (`Subscribe`, `Lead`, …).

El camino vivo es `track()` de `src/lib/analytics/track.ts`: nombres canónicos
en snake_case, consentimiento por categoría, propiedades automáticas y
`event_id`. `track-event.ts` se conserva por si algún día sirve de referencia,
pero **no se debe usar**.
