export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { topicId, topicName, subjectName, themeId, themeName, sections } = await req.json()

  const client = new Anthropic()

  const analogyContent = sections?.find((s: {type: string, content: string}) => s.type === 'analogy')?.content ?? ''
  const exampleContent = sections?.find((s: {type: string, content: string}) => s.type === 'example')?.content ?? ''

  const diagramPrompt = `Genera un diagrama SVG educativo que ilustre visualmente
el concepto "${topicName}" de ${subjectName} usando elementos visuales de "${themeName}".

CONTEXTO IMPORTANTE — el alumno ya leyó estas secciones, el diagrama debe ser coherente con ellas:
ANALOGÍA: ${analogyContent.substring(0, 300)}
EJEMPLO: ${exampleContent.substring(0, 300)}

El diagrama debe usar los MISMOS personajes, situaciones o elementos que aparecen
en la analogía y el ejemplo — no inventes contexto nuevo.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con el código SVG — nada más, sin explicación, sin markdown
- Empieza directamente con <svg y termina con </svg>
- viewBox="0 0 560 300"
- Agrega rect fill="#0f0a1e" width="560" height="300" como primer elemento
- Colores permitidos ÚNICAMENTE: #7c3aed #ec4899 #06b6d4 #fbbf24 #10b981 #e2d9f3 #a78bfa #1a1035 #0f0a1e
- Incluir los mismos elementos visuales de "${themeName}" que aparecen en las secciones
- Mostrar el concepto matemático/académico con flechas, etiquetas y fórmulas
- font-size mínimo 12 en todos los textos
- Sin imágenes externas, sin URLs, solo SVG puro autocontenido`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: diagramPrompt }],
    })

    const rawSvg = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    console.log('Raw SVG response length:', rawSvg.length)
    console.log('Raw SVG first 200 chars:', rawSvg.substring(0, 200))

    const svgMatch = rawSvg.match(/<svg[\s\S]*?<\/svg>/i)
      || rawSvg.match(/<svg[\s\S]*/i)

    if (!svgMatch) {
      console.error('No SVG found in response:', rawSvg.substring(0, 300))
      return NextResponse.json({ error: 'No SVG generated' }, { status: 500 })
    }

    let diagramSvg = svgMatch[0]

    // Ensure it closes properly
    if (!diagramSvg.includes('</svg>')) {
      diagramSvg = diagramSvg + '</svg>'
    }

    console.log('Extracted SVG length:', diagramSvg.length)

    // Delete existing diagram section for this topic+theme
    await supabase
      .from('sections')
      .delete()
      .eq('topic_id', topicId)
      .eq('theme_id', themeId)
      .eq('type', 'diagram')

    // Insert new diagram section
    const { data: insertedDiagram, error } = await supabase
      .from('sections')
      .insert({
        topic_id: topicId,
        theme_id: themeId,
        user_id: null,
        type: 'diagram',
        title: `Diagrama — ${topicName}`,
        content: diagramSvg,
        display_order: 4,
        interests_used: [themeName],
      })
      .select()
      .single()

    if (error) {
      console.error('Diagram insert error:', error)
      return NextResponse.json({ error: 'Failed to save diagram' }, { status: 500 })
    }

    return NextResponse.json({ diagram: insertedDiagram })
  } catch (error) {
    console.error('Diagram generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
