export async function POST(request: Request) {
  try {
    const { name, type } = await request.json()
    if (!name) return Response.json({ emoji: null })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: `Respond with only a single emoji that best represents this academic ${type === 'subject' ? 'subject' : 'topic'} for Mexican secondary school students: "${name}". Only one emoji, nothing else.`,
          },
        ],
      }),
    })

    const data = await response.json()
    const emoji = data?.content?.[0]?.text?.trim()
    return Response.json({ emoji: emoji ?? null })
  } catch {
    return Response.json({ emoji: null })
  }
}
