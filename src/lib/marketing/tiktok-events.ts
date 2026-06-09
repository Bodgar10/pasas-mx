/**
 * TikTok Events API (server-side)
 * Documentación: https://business-api.tiktok.com/portal/docs?id=1771101027431425
 *
 * Variables de entorno necesarias:
 * - TIKTOK_PIXEL_ID
 * - TIKTOK_EVENTS_ACCESS_TOKEN
 */

export async function sendTikTokEvent(
  eventName: string,
  options: {
    email?: string
    value?: number
    currency?: string
    contentName?: string
    eventUrl?: string
  }
) {
  const pixelId = process.env.TIKTOK_PIXEL_ID
  const accessToken = process.env.TIKTOK_EVENTS_ACCESS_TOKEN

  if (!pixelId || !accessToken) {
    console.warn('[TikTok Events] Missing TIKTOK_PIXEL_ID or TIKTOK_EVENTS_ACCESS_TOKEN — skipping')
    return { ok: false, reason: 'missing_credentials' }
  }

  const event = {
    event: eventName,
    event_time: Math.floor(Date.now() / 1000),
    user: {
      ...(options.email ? { email: options.email } : {}),
    },
    properties: {
      ...(options.value !== undefined ? {
        value: options.value,
        currency: options.currency ?? 'MXN',
        content_name: options.contentName,
      } : {}),
    },
    page: {
      url: options.eventUrl ?? 'https://pasas.mx',
    },
  }

  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        pixel_code: pixelId,
        event_source: 'web',
        event_source_id: pixelId,
        data: [event],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[TikTok Events] Error:', data)
      return { ok: false, error: data }
    }

    return { ok: true, data }
  } catch (err) {
    console.error('[TikTok Events] Unexpected error:', err)
    return { ok: false, error: err }
  }
}
