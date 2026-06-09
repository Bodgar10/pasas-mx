import { NextRequest, NextResponse } from 'next/server'
import { sendTikTokEvent } from '@/lib/marketing/tiktok-events'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event_name, email, value, currency, content_name, event_url } = body

    if (!event_name) {
      return NextResponse.json({ error: 'event_name is required' }, { status: 400 })
    }

    const result = await sendTikTokEvent(event_name, {
      email,
      value,
      currency,
      contentName: content_name,
      eventUrl: event_url,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/tiktok/events] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
