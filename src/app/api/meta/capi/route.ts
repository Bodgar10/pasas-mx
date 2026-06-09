import { NextRequest, NextResponse } from 'next/server'
import { sendMetaCapiEvent } from '@/lib/marketing/meta-capi'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event_name, email, value, currency, content_name, event_url } = body

    if (!event_name) {
      return NextResponse.json({ error: 'event_name is required' }, { status: 400 })
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined
    const clientUserAgent = req.headers.get('user-agent') ?? undefined

    const result = await sendMetaCapiEvent(event_name, {
      email,
      value,
      currency,
      contentName: content_name,
      eventSourceUrl: event_url,
      clientIp,
      clientUserAgent,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/meta/capi] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
