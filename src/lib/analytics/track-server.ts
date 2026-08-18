/**
 * trackServer() — contraparte de `track()` para eventos que nacen en el
 * servidor: webhooks de Stripe, rutas de API, server actions.
 *
 * Misma idea que track(): un evento entra una vez y sale hacia los destinos
 * que correspondan, con las mismas propiedades y el MISMO `event_id`.
 *
 * ── Dos diferencias con track(), las dos obligadas ────────────────────
 *
 * 1. El consentimiento llega POR PARAMETRO. `lib/consent.ts` lee
 *    localStorage y aqui no hay navegador. La fuente de servidor son las
 *    columnas `users.cookie_consent_analytics` / `cookie_consent_marketing`
 *    (migracion 034), que son NULLABLE a proposito: NULL = nunca contesto
 *    el banner, y eso NO es un si. Ademas un visitante anonimo no tiene
 *    fila, asi que su consentimiento solo existe en su navegador y tiene
 *    que viajar hasta aca.
 *
 * 2. `event_id` es OBLIGATORIO cuando el evento tiene gemelo en el cliente.
 *    Es lo unico que impide que Meta y TikTok cuenten el mismo pago dos
 *    veces. Si no se pasa se genera uno, pero entonces no deduplica nada.
 *
 * ── Destinos ──────────────────────────────────────────────────────────
 *   PostHog  ✅ posthog-node (s35)
 *   GA4      ❌ falta el api_secret del Measurement Protocol
 *   Meta     ✅ CAPI, pero sin event_id todavia (ver abajo)
 *   TikTok   ✅ Events API, mismo caso
 */

import { PostHog } from 'posthog-node'
import { sendMetaCapiEvent } from '@/lib/marketing/meta-capi'
import { sendTikTokEvent } from '@/lib/marketing/tiktok-events'
import { MAPEO_META, MAPEO_TIKTOK, type PropiedadesEvento } from './track'

// ─────────────────────────────────────────────────────────────────────────
// TRANSPORTE DE POSTHOG
//
// 🔴 UN cliente de MODULO, no uno por llamada. En serverless la instancia se
// reutiliza entre invocaciones: crear un PostHog por evento abre un pool de
// conexiones nuevo cada vez y acaba agotando los sockets de la funcion.
//
// La clave se resuelve con respaldo a proposito. `NEXT_PUBLIC_POSTHOG_KEY` ya
// existe y ya funciona: exigir una variable nueva solo para el servidor es un
// despliegue que no manda nada y no falla —el `console.warn` se pierde entre
// los logs— hasta que alguien mira un dashboard vacio semanas despues.
// `POSTHOG_KEY` queda como override por si algun dia los eventos de servidor
// van a otro proyecto.
//
// La clave de proyecto de PostHog (phc_...) es publica por diseno: viaja en
// el bundle del navegador desde el primer dia. No hay nada que proteger aqui.
// ─────────────────────────────────────────────────────────────────────────

const POSTHOG_KEY = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST

let clientePostHog: PostHog | null = null
let avisoClienteEmitido = false

function obtenerClientePostHog(): PostHog | null {
  if (clientePostHog) return clientePostHog

  if (!POSTHOG_KEY || !POSTHOG_HOST) {
    // Mismo patron que meta-capi.ts y tiktok-events.ts: sin credenciales el
    // destino se salta en silencio. El aviso sale UNA vez y no en cada
    // evento, o un webhook con trafico llena los logs de ruido.
    if (!avisoClienteEmitido) {
      avisoClienteEmitido = true
      console.warn(
        '[trackServer] Falta POSTHOG_KEY/NEXT_PUBLIC_POSTHOG_KEY o el host — PostHog se salta'
      )
    }
    return null
  }

  try {
    clientePostHog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // 🔴 Sin buffer. El comportamiento por defecto —acumular hasta 20
      // eventos o 5 segundos— es correcto en un servidor de larga vida y
      // catastrofico en serverless: la funcion muere en cuanto responde y se
      // lleva el buffer entero. Un evento de cobro perdido no se recupera.
      flushAt: 1,
      flushInterval: 0,
    })
    return clientePostHog
  } catch (err) {
    console.warn('[trackServer] No se pudo crear el cliente de PostHog:', err)
    return null
  }
}

export type ConsentimientoServidor = {
  analytics: boolean | null | undefined
  marketing: boolean | null | undefined
}

export type ContextoServidor = {
  /** Del banner (cliente) o de users.cookie_consent_*. */
  consent: ConsentimientoServidor
  /**
   * 🔴 EL MISMO `user.id` que usa posthog-provider como `distinct_id` en el
   * cliente. Sin el, un evento de servidor y uno de navegador de la misma
   * persona quedan como DOS personas en PostHog y el embudo se parte por la
   * mitad sin que nada lo delate.
   *
   * Opcional porque hay eventos sin usuario identificado (un pago de un
   * checkout anonimo, por ejemplo). Sin `userId` NO se manda a PostHog: un
   * distinct_id inventado es peor que la ausencia del evento.
   */
  userId?: string
  /** El MISMO que uso el cliente, si el evento tiene gemelo. */
  eventId?: string
  /** Sin hashear: cada destino lo hashea como pide su API. */
  email?: string
  /** Monto en unidades, NO en centavos. */
  value?: number
  currency?: string
  /** URL donde ocurrio, para atribucion. */
  eventUrl?: string
  clientIp?: string
  clientUserAgent?: string
}

/**
 * Fail-closed, igual que en el cliente: solo `=== true` es un si.
 * NULL y undefined son "no contesto", que se trata como no.
 */
function permite(valor: boolean | null | undefined): boolean {
  return valor === true
}

function nuevoEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* sin contexto seguro */
  }
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Manda un evento de servidor.
 *
 * @param evento  Nombre CANONICO en snake_case, el mismo que usa track().
 * @param propiedades  Lo especifico del evento.
 * @param ctx  Consentimiento, identidad y el event_id compartido.
 *
 * Nunca lanza: devuelve a que destinos llego y por que se salto el resto.
 */
export async function trackServer(
  evento: string,
  propiedades: PropiedadesEvento | undefined,
  ctx: ContextoServidor
): Promise<{ eventId: string; enviados: string[]; omitidos: string[] }> {
  const eventId = ctx.eventId ?? nuevoEventId()
  const enviados: string[] = []
  const omitidos: string[] = []

  try {
    // ── analytics ────────────────────────────────────────────────────
    //
    // PostHog YA tiene transporte de servidor (posthog-node, s35). GA4 sigue
    // sin el: necesita el Measurement Protocol con un `api_secret` que no
    // existe en el entorno, y eso es otra decision, no un detalle de aqui.
    if (!permite(ctx.consent.analytics)) {
      omitidos.push('posthog:sin-consentimiento', 'ga4:sin-consentimiento')
    } else {
      omitidos.push('ga4:sin-transporte-servidor')

      if (!ctx.userId) {
        // Sin identidad no se manda. Un distinct_id inventado crearia una
        // persona fantasma en PostHog por cada evento, y esas no se pueden
        // fusionar despues con la real.
        omitidos.push('posthog:sin-user-id')
      } else {
        const cliente = obtenerClientePostHog()
        if (!cliente) {
          omitidos.push('posthog:sin-credenciales')
        } else {
          try {
            cliente.capture({
              // 🔴 EL MISMO id que `ph.identify(user.id, …)` del cliente en
              // posthog-provider. Si estos dos dejan de coincidir, los
              // eventos de servidor y de navegador de la misma persona
              // quedan en dos perfiles y el embudo se corta a la mitad.
              distinctId: ctx.userId,
              event: evento,
              properties: {
                ...(propiedades ?? {}),
                event_id: eventId,
                // Marca el origen para poder separarlos en PostHog. El
                // cliente no manda esta propiedad, asi que su ausencia
                // identifica a los de navegador.
                $lib: 'posthog-node',
                origen_evento: 'servidor',
              },
            })

            // 🔴 flush() EXPLICITO Y ESPERADO.
            //
            // `flushAt: 1` encola y dispara el envio, pero la peticion HTTP
            // es asincrona: en serverless la funcion puede devolver y morir
            // antes de que salga. Con el await, el evento esta entregado
            // cuando trackServer() resuelve.
            //
            // NO se llama a _shutdown(): eso cierra el cliente de modulo y
            // la siguiente invocacion sobre la misma instancia caliente se
            // quedaria sin transporte.
            await cliente.flush()
            enviados.push('posthog')
          } catch (err) {
            // Nunca lanza. Esto corre dentro del webhook de cobro: una caida
            // de PostHog no puede tumbar el registro de una suscripcion.
            console.warn('[trackServer] posthog fallo:', err)
            omitidos.push('posthog:error')
          }
        }
      }
    }

    // ── marketing ────────────────────────────────────────────────────
    if (!permite(ctx.consent.marketing)) {
      omitidos.push('meta:sin-consentimiento', 'tiktok:sin-consentimiento')
      return { eventId, enviados, omitidos }
    }

    const nombreMeta = MAPEO_META[evento]
    const nombreTikTok = MAPEO_TIKTOK[evento]

    if (!nombreMeta) omitidos.push('meta:sin-equivalente')
    if (!nombreTikTok) omitidos.push('tiktok:sin-equivalente')

    if (nombreMeta || nombreTikTok) {
      // 🔴 DEDUPLICACION INCOMPLETA — pendiente de un cambio de una linea.
      //
      // `sendMetaCapiEvent` y `sendTikTokEvent` no aceptan `eventId`: sus
      // firmas no tienen el campo, asi que el id se queda aqui y NO viaja.
      // Consecuencia real: si un evento sale del pixel Y de aqui, Meta y
      // TikTok lo cuentan DOS VECES.
      //
      // Por eso MAPEO_META/MAPEO_TIKTOK nacen sin `checkout_completed`: es
      // el unico evento que hoy sale de los dos lados. Mientras la tabla no
      // lo incluya no hay doble conteo, pero el aviso se emite igual para
      // que no se destape la tabla sin arreglar antes los dos helpers.
      //
      // Se avisa en cada envio, no una sola vez, porque un warning que solo
      // sale al arrancar el proceso no lo ve nadie en produccion.
      console.warn(
        `[trackServer] "${evento}" sale a marketing SIN event_id (${eventId}): ` +
          'meta-capi.ts y tiktok-events.ts todavia no aceptan ese campo. ' +
          'No agregar este evento a MAPEO_* hasta arreglarlo o se contara doble.'
      )
    }

    const tareas: Promise<unknown>[] = []

    if (nombreMeta) {
      tareas.push(
        sendMetaCapiEvent(nombreMeta, {
          email: ctx.email,
          value: ctx.value,
          currency: ctx.currency,
          contentName: typeof propiedades?.content_name === 'string' ? propiedades.content_name : undefined,
          eventSourceUrl: ctx.eventUrl,
          clientIp: ctx.clientIp,
          clientUserAgent: ctx.clientUserAgent,
        })
          .then(() => {
            enviados.push('meta')
          })
          .catch((err) => {
            console.warn('[trackServer] meta fallo:', err)
            omitidos.push('meta:error')
          })
      )
    }

    if (nombreTikTok) {
      tareas.push(
        sendTikTokEvent(nombreTikTok, {
          email: ctx.email,
          value: ctx.value,
          currency: ctx.currency,
          contentName: typeof propiedades?.content_name === 'string' ? propiedades.content_name : undefined,
          eventUrl: ctx.eventUrl,
        })
          .then(() => {
            enviados.push('tiktok')
          })
          .catch((err) => {
            console.warn('[trackServer] tiktok fallo:', err)
            omitidos.push('tiktok:error')
          })
      )
    }

    await Promise.all(tareas)
  } catch (err) {
    console.warn('[trackServer] fallo no atrapado:', err)
  }

  return { eventId, enviados, omitidos }
}
