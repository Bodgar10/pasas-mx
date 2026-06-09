/**
 * Meta Conversions API (server-side)
 * Documentación: https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * Variables de entorno necesarias:
 * - META_PIXEL_ID
 * - META_CAPI_ACCESS_TOKEN
 */

export interface MetaCapiEvent {
  event_name: string
  event_time: number
  user_data: {
    em?: string   // email hasheado con SHA256
    ph?: string   // teléfono hasheado
    client_ip_address?: string
    client_user_agent?: string
    fbc?: string  // click ID de Facebook
    fbp?: string  // browser ID de Facebook
  }
  custom_data?: {
    value?: number
    currency?: string
    content_name?: string
    [key: string]: unknown
  }
  event_source_url?: string
  action_source: 'website' | 'app' | 'email' | 'other'
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function sendMetaCapiEvent(
  eventName: string,
  options: {
    email?: string
    value?: number
    currency?: string
    contentName?: string
    eventSourceUrl?: string
    clientIp?: string
    clientUserAgent?: string
  }
) {
  const pixelId = process.env.META_PIXEL_ID
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN

  if (!pixelId || !accessToken) {
    console.warn('[Meta CAPI] Missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN — skipping')
    return { ok: false, reason: 'missing_credentials' }
  }

  const eventTime = Math.floor(Date.now() / 1000)

  const userData: MetaCapiEvent['user_data'] = {}
  if (options.email) {
    userData.em = await sha256(options.email)
  }
  if (options.clientIp) userData.client_ip_address = options.clientIp
  if (options.clientUserAgent) userData.client_user_agent = options.clientUserAgent

  const event: MetaCapiEvent = {
    event_name: eventName,
    event_time: eventTime,
    user_data: userData,
    action_source: 'website',
    ...(options.eventSourceUrl ? { event_source_url: options.eventSourceUrl } : {}),
    ...(options.value !== undefined ? {
      custom_data: {
        value: options.value,
        currency: options.currency ?? 'MXN',
        content_name: options.contentName,
      }
    } : {}),
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [event],
          test_event_code: process.env.META_CAPI_TEST_CODE, // opcional para testing
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) {
      console.error('[Meta CAPI] Error:', data)
      return { ok: false, error: data }
    }

    return { ok: true, data }
  } catch (err) {
    console.error('[Meta CAPI] Unexpected error:', err)
    return { ok: false, error: err }
  }
}
