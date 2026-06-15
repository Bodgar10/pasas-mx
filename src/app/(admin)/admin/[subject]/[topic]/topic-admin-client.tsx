'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ScrubberBlock, StepsBlock, SortBlock, CollapsibleText, RevealOnScroll } from '@/components/guia/InteractiveBlocks'

type SectionType =
  | 'explanation' | 'analogy' | 'example' | 'key_fact' | 'tip' | 'diagram'
  | 'scrubber' | 'steps' | 'sort'

interface Section {
  id: string
  type: SectionType
  title: string | null
  content: string
  data: Record<string, unknown> | null
  display_order: number
}

interface QuizQuestion {
  id: string
  question: string
  options: { letter: string; text: string }[]
  correct_answer: string
  explanation: string | null
  difficulty: number
  xp_reward: number
}

interface Theme {
  id: string
  name: string
}

interface Props {
  subject: { id: string; name: string; slug: string }
  topic: {
    id: string
    name: string
    slug: string
    difficulty: number
    xp_reward: number
    published: boolean
  }
  sections: Section[]
  quizQuestions: QuizQuestion[]
  themes: Theme[]
  selectedThemeId: string
  grade: number
  level: string
  completedCount: number
}

function renderContent(text: string): React.ReactNode {
  // If content is SVG, render it directly
  if (text.trim().startsWith('<svg')) {
    return (
      <div
        style={{ width: '100%', overflowX: 'auto' }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    )
  }
  // Otherwise render markdown bold
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ fontWeight: 800, color: '#e2d9f3' }}>
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function slugifyTheme(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveThemeKey(
  key: string,
  themeList: { id: string; name: string }[]
): { themeId: string | null; themeName: string } | null {
  const norm = key.trim().toLowerCase()
  if (norm === 'base') return { themeId: null, themeName: 'base' }
  const slug = slugifyTheme(key)
  for (const t of themeList) {
    if (t.id === key || t.name.toLowerCase() === norm || slugifyTheme(t.name) === slug) {
      return { themeId: t.id, themeName: t.name }
    }
  }
  return null
}


const SECTION_ICONS: Partial<Record<Section['type'], string>> = {
  explanation: '📘',
  analogy: '🎮',
  example: '🔢',
  key_fact: '📌',
  tip: '💡',
  diagram: '🎨',
}

const SECTION_TYPE_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  borderColor: string
  headerBg: string
}> = {
  analogy: {
    label: 'Analogía',
    icon: '🎭',
    color: '#ec4899',
    borderColor: 'rgba(236,72,153,0.25)',
    headerBg: 'rgba(236,72,153,0.06)',
  },
  explanation: {
    label: 'Explicación',
    icon: '📘',
    color: '#a78bfa',
    borderColor: 'rgba(167,139,250,0.25)',
    headerBg: 'rgba(167,139,250,0.06)',
  },
  example: {
    label: 'Ejemplo resuelto',
    icon: '🔢',
    color: '#06b6d4',
    borderColor: 'rgba(6,182,212,0.25)',
    headerBg: 'rgba(6,182,212,0.06)',
  },
  key_fact: {
    label: 'Dato clave',
    icon: '📌',
    color: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.25)',
    headerBg: 'rgba(251,191,36,0.06)',
  },
  tip: {
    label: 'Tip para el examen',
    icon: '💡',
    color: '#10b981',
    borderColor: 'rgba(16,185,129,0.25)',
    headerBg: 'rgba(16,185,129,0.06)',
  },
  diagram: {
    label: 'Diagrama',
    icon: '🎨',
    color: '#06b6d4',
    borderColor: 'rgba(6,182,212,0.25)',
    headerBg: 'rgba(6,182,212,0.06)',
  },
  scrubber: {
    label: 'Pruébalo',
    icon: '🎮',
    color: '#ec4899',
    borderColor: 'rgba(236,72,153,0.25)',
    headerBg: 'rgba(236,72,153,0.06)',
  },
  steps: {
    label: 'Resuélvelo conmigo',
    icon: '🧩',
    color: '#06b6d4',
    borderColor: 'rgba(6,182,212,0.25)',
    headerBg: 'rgba(6,182,212,0.06)',
  },
  sort: {
    label: 'Clasifica',
    icon: '📊',
    color: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.25)',
    headerBg: 'rgba(251,191,36,0.06)',
  },
}

export default function TopicAdminClient({
  subject,
  topic,
  sections: initialSections,
  quizQuestions: initialQuizQuestions,
  themes,
  selectedThemeId: initialThemeId,
  grade,
  level,
  completedCount,
}: Props) {
  const router = useRouter()

  // Student view state
  const [activeTab, setActiveTab] = useState<'guia' | 'quiz' | 'resumen'>('guia')
  const [sessionXp, setSessionXp] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [xpPerQuestion, setXpPerQuestion] = useState<Record<string, number>>({})
  const [comboAtAnswer, setComboAtAnswer] = useState<Record<string, number>>({})

  // Admin state
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(initialQuizQuestions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editQuestionData, setEditQuestionData] = useState<{
    question: string
    options: { letter: string; text: string }[]
    correct_answer: string
    explanation: string
  } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [themeChanging, setThemeChanging] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [manualJson, setManualJson] = useState('')
  const [manualJsonError, setManualJsonError] = useState<string | null>(null)
  const [savingManual, setSavingManual] = useState(false)
  const [copied, setCopied] = useState(false)
  const [batchJson, setBatchJson] = useState('')
  const [batchError, setBatchError] = useState<string | null>(null)
  const [savingBatch, setSavingBatch] = useState(false)
  const [batchCopied, setBatchCopied] = useState(false)
  const [batchResults, setBatchResults] = useState<
    { theme: string; status: 'saved' | 'skipped' | 'error'; detail?: string }[]
  >([])
  const [generatingDiagram, setGeneratingDiagram] = useState(false)
  const [diagramError, setDiagramError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState(initialThemeId)
  const [published, setPublished] = useState(topic.published && initialSections.length > 0)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setThemeChanging(false)
    setSections(initialSections)
  }, [initialSections])

  useEffect(() => {
    setPublished(topic.published && initialSections.length > 0)
  }, [selectedThemeId, topic.published, initialSections])

  useEffect(() => {
    setQuizQuestions(initialQuizQuestions)
  }, [initialQuizQuestions])

  const LESSON_ORDER: Record<string, number> = {
    analogy: 1, scrubber: 2, explanation: 3, example: 4,
    steps: 5, sort: 6, diagram: 7, key_fact: 8, tip: 9,
  }
  const orderedSections = [...sections].sort(
    (a, b) =>
      (LESSON_ORDER[a.type] ?? 99) - (LESSON_ORDER[b.type] ?? 99) ||
      a.display_order - b.display_order
  )

  const summaryItems = orderedSections.filter((s) => s.type === 'key_fact' || s.type === 'tip')
  const resumenSections = summaryItems.length > 0 ? summaryItems : orderedSections

  // Student quiz handler
  function handleAnswer(questionId: string, selectedLetter: string, question: QuizQuestion) {
    if (answers[questionId]) return
    const isCorrect = selectedLetter === question.correct_answer
    const newCombo = isCorrect ? combo + 1 : 0
    const multiplier = newCombo >= 3 ? 2 : newCombo >= 2 ? 1.5 : 1
    const xpEarned = isCorrect ? Math.round(question.xp_reward * multiplier) : 0
    setAnswers((prev) => ({ ...prev, [questionId]: selectedLetter }))
    setCombo(newCombo)
    setXpPerQuestion((prev) => ({ ...prev, [questionId]: xpEarned }))
    setComboAtAnswer((prev) => ({ ...prev, [questionId]: newCombo }))
    if (isCorrect) {
      setScore((prev) => prev + 1)
      setSessionXp((prev) => prev + xpEarned)
    }
  }

  // Admin section CRUD
  function startEdit(id: string, content: string) {
    setEditingId(id)
    setEditContent(content)
  }

  async function handleSaveSection(sectionId: string) {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('sections').update({ content: editContent }).eq('id', sectionId)
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content: editContent } : s))
    )
    setEditingId(null)
    setSaving(false)
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm('¿Eliminar esta sección?')) return
    const supabase = createClient()
    await supabase.from('sections').delete().eq('id', sectionId)
    setSections((prev) => prev.filter((s) => s.id !== sectionId))
  }

  // Admin question CRUD
  function startEditQuestion(question: QuizQuestion) {
    setEditingQuestionId(question.id)
    setEditQuestionData({
      question: question.question,
      options: question.options.map((o) => ({ ...o })),
      correct_answer: question.correct_answer,
      explanation: question.explanation ?? '',
    })
  }

  async function handleSaveQuestion(questionId: string) {
    if (!editQuestionData) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('quiz_questions')
      .update({
        question: editQuestionData.question,
        options: editQuestionData.options,
        correct_answer: editQuestionData.correct_answer,
        explanation: editQuestionData.explanation,
      })
      .eq('id', questionId)
    setQuizQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, ...editQuestionData } : q
      )
    )
    setEditingQuestionId(null)
    setEditQuestionData(null)
    setSaving(false)
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    const supabase = createClient()
    await supabase.from('quiz_questions').delete().eq('id', questionId)
    setQuizQuestions((prev) => prev.filter((q) => q.id !== questionId))
  }

  async function togglePublish() {
    const supabase = createClient()
    await supabase.from('topics').update({ published: !published }).eq('id', topic.id)
    setPublished((prev) => !prev)
  }

  function handleGenerate() {
    setShowGenerateModal(true)
    setManualJson('')
    setManualJsonError(null)
    setGenerateError(null)
  }

  async function handleGenerateInternal() {
    setShowGenerateModal(false)
    setGenerating(true)
    setGenerateError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 55000)

      const res = await fetch('/api/admin/generate-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topicId: topic.id,
          topicName: topic.name,
          topicSlug: topic.slug,
          subjectName: subject.name,
          themeId: selectedThemeId,
          themeName: themes.find((t) => t.id === selectedThemeId)?.name,
          grade,
          level,
        }),
      })

      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.error) {
        setGenerateError(`Error del servidor: ${data.error}`)
        return
      }
      if (data.sections) setSections(data.sections)
      if (data.quizQuestions) setQuizQuestions(data.quizQuestions)
      setPublished(false)
    } catch (err) {
      setGenerateError(`Error de red: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setGenerating(false)
    }
  }

  function buildOpusPrompt(): string {
    const educationContextLabel =
      level === 'middle_school' ? `${grade}° de secundaria` :
      level === 'high_school'   ? `${grade}° de preparatoria` :
      level === 'exam_prepa'    ? `preparación para examen de ingreso a preparatoria (COMIPEMS)` :
      level === 'exam_uni'      ? `preparación para examen de ingreso a universidad (UNAM/IPN)` :
      `${grade}° grado`
    const themeName = themes.find((t) => t.id === selectedThemeId)?.name ?? ''
    const isExam = level === 'exam_prepa' || level === 'exam_uni'

    return `Eres un experto en educación mexicana y storytelling pedagógico.
Tu tarea es generar contenido educativo inmersivo para estudiantes mexicanos de ${educationContextLabel}.

REGLA MÁS IMPORTANTE: La temática "${themeName}" no es un adorno — es el MUNDO donde ocurre todo el contenido.
El alumno debe sentir que está aprendiendo DENTRO de "${themeName}", no que alguien lo menciona de pasada.

ANTES DE ESCRIBIR CUALQUIER SECCIÓN, identifica mentalmente:
1. Los 5 personajes, figuras o elementos MÁS FAMOSOS y reconocibles de "${themeName}" a nivel mundial en 2024-2025
2. Las 3 situaciones o contextos MÁS ICÓNICOS de "${themeName}" que cualquier fan reconocería al instante
3. Los términos, mecánicas o conceptos MÁS USADOS por la comunidad real de "${themeName}"

Usa SIEMPRE lo más famoso, no lo más oscuro. Un alumno promedio de 13-18 años en México debe reconocer inmediatamente cada referencia.
Nada genérico. Nada inventado. Solo referencias reales y populares de "${themeName}".

Adapta vocabulario y complejidad a ${educationContextLabel}.
${isExam ? 'Enfócate en conceptos frecuentes en exámenes de admisión, con distractores plausibles en el quiz.' : ''}
Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional.

---

Genera contenido educativo inmersivo para:
- Tema: "${topic.name}"
- Materia: "${subject.name}"
- Nivel: ${educationContextLabel}
- Temática: "${themeName}"

INSTRUCCIÓN CRÍTICA: Cada sección debe desarrollar una situación REAL y ESPECÍFICA de "${themeName}".

Genera este JSON exacto:

{
  "sections": [
    {
      "type": "analogy",
      "title": "título que mencione algo específico de ${themeName}",
      "content": "Empieza con una situación concreta y detallada de ${themeName}. Describe el escenario, los personajes o elementos involucrados. Plantea el problema que surge naturalmente en ese contexto. Usa detalles específicos de ${themeName} — nombres, mecánicas, situaciones reales del universo de ${themeName}. Mínimo 100 palabras. El concepto académico debe emerger naturalmente de la situación, no al revés.",
      "display_order": 1
    },
    {
      "type": "explanation",
      "title": "título que conecte la situación anterior con el concepto formal",
      "content": "Arranca con 'Lo que acabas de ver en [situación de ${themeName}] es exactamente [concepto].' Luego explica el concepto formal usando **negritas** para términos clave. Conecta cada parte del concepto con elementos de la situación anterior. Máximo 100 palabras.",
      "display_order": 2
    },
    {
      "type": "example",
      "title": "Ejemplo resuelto — situación diferente de ${themeName}",
      "content": "Plantea un problema NUEVO dentro de ${themeName}, diferente al de la analogía. Resuélvelo paso a paso con **pasos numerados**. Los datos del problema deben venir del universo de ${themeName}. Muestra la operación completa. Máximo 120 palabras.",
      "display_order": 3
    },
    {
      "type": "key_fact",
      "title": "Lo que debes recordar",
      "content": "La definición formal del concepto en 1-2 oraciones con **negritas** en lo más crítico. Incluye la fórmula o regla principal si aplica.",
      "display_order": 4
    },
    {
      "type": "tip",
      "title": "${isExam ? 'Tip para el examen de admisión' : 'Tip para no fallar en el examen'}",
      "content": "${isExam ? 'Consejo estratégico específico para resolver este tipo de pregunta rápido en COMIPEMS/UNAM. Menciona el tipo de trampa más común en las opciones.' : 'Truco práctico para recordar el concepto o evitar el error más común.'} Máximo 50 palabras.",
      "display_order": 5
    }
  ],
  "quiz_questions": [
    {
      "question": "pregunta de dificultad básica — puede tener contexto de ${themeName}",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "A",
      "explanation": "por qué es correcta y cuál es el error típico de las otras opciones. Máximo 50 palabras.",
      "difficulty": 1,
      "xp_reward": 20
    },
    {
      "question": "pregunta de dificultad media — requiere aplicar el concepto",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "B",
      "explanation": "por qué es correcta. Máximo 50 palabras.",
      "difficulty": 2,
      "xp_reward": 30
    },
    {
      "question": "pregunta difícil — requiere razonamiento, no memorización",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "C",
      "explanation": "por qué es correcta y por qué los distractores son plausibles. Máximo 50 palabras.",
      "difficulty": 3,
      "xp_reward": 50
    },
    {
      "question": "pregunta de dificultad media — aplica el concepto en contexto diferente de ${themeName}",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "D",
      "explanation": "por qué es correcta y cuál es el error típico. Máximo 50 palabras.",
      "difficulty": 2,
      "xp_reward": 30
    },
    {
      "question": "pregunta difícil — combina conceptos o requiere varios pasos de razonamiento",
      "options": [
        { "letter": "A", "text": "opción" },
        { "letter": "B", "text": "opción" },
        { "letter": "C", "text": "opción" },
        { "letter": "D", "text": "opción" }
      ],
      "correct_answer": "A",
      "explanation": "por qué es correcta y por qué los distractores son plausibles. Máximo 50 palabras.",
      "difficulty": 3,
      "xp_reward": 50
    }
  ]}

ADEMÁS de las 5 secciones de texto, agrega al MISMO array "sections" entre 1 y 3 BLOQUES INTERACTIVOS sobre el mismo concepto, dentro del mundo de "${themeName}". No llevan texto largo: llevan un objeto "data". Continúa el display_order después de 5. Elige el tipo según el contenido y NO repitas el mismo tipo:
- "steps": proceso paso a paso o acumulación de una cantidad. "visual":"bar" si hay un número que sube/baja (cada paso lleva "delta" numérico) más "start" inicial; "visual":"chain" para pasos narrativos (cada paso solo "text").
- "sort": clasificar en 2 categorías (máx 3). 4 a 6 items; cada item lleva "b" = índice de la cubeta correcta (0,1,...).
- "scrubber": un eje/continuo (recta numérica, línea del tiempo, escala). "min" < "max", "start" en rango, 2 a 5 "points" con valor "v" y etiqueta "l".

No inventes datos ni números; si hay matemáticas, deben ser exactos. Formato EXACTO de cada bloque interactivo:
{ "type": "scrubber", "title": "Pruébalo", "content": "frase corta de respaldo", "display_order": 6, "data": { "intro": "1-2 frases con la temática", "unit": "qué se mide", "min": -64, "max": 120, "start": 64, "points": [ { "v": 64, "l": "etiqueta" } ], "question": "opcional" } }
{ "type": "sort", "title": "Clasifica", "content": "frase corta de respaldo", "display_order": 7, "data": { "prompt": "instrucción en una frase", "buckets": ["A","B"], "items": [ { "t": "texto", "b": 0 } ] } }
{ "type": "steps", "title": "Resuélvelo conmigo", "content": "frase corta de respaldo", "display_order": 8, "data": { "intro": "1-2 frases con la temática", "visual": "bar", "start": 75, "steps": [ { "text": "qué pasa", "delta": -40 } ] } }`
  }

  async function handleSaveManualJson() {
    setManualJsonError(null)
    setSavingManual(true)

    let parsed: { sections?: unknown[]; quiz_questions?: unknown[] }
    try {
      let clean = manualJson.replace(/```json|```/g, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (jsonMatch) clean = jsonMatch[0]
      parsed = JSON.parse(clean)
    } catch {
      setManualJsonError('El JSON no es válido. Asegúrate de copiar todo el texto que te dio Opus, sin agregar nada.')
      setSavingManual(false)
      return
    }

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      setManualJsonError('El JSON no tiene la estructura correcta — falta el array "sections".')
      setSavingManual(false)
      return
    }

    try {
      const res = await fetch('/api/admin/save-generated-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          themeId: selectedThemeId,
          themeName: themes.find((t) => t.id === selectedThemeId)?.name,
          sections: parsed.sections,
          quiz_questions: parsed.quiz_questions ?? [],
        }),
      })

      const data = await res.json()
      if (data.error) {
        setManualJsonError(`Error al guardar: ${data.error}`)
        setSavingManual(false)
        return
      }

      if (data.sections) setSections(data.sections)
      if (data.quizQuestions) setQuizQuestions(data.quizQuestions)
      setPublished(false)
      setShowGenerateModal(false)
      setManualJson('')
    } catch (err) {
      setManualJsonError(`Error de red: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setSavingManual(false)
    }
  }

  function buildOpusBatchPrompt(): string {
    const educationContextLabel =
      level === 'middle_school' ? `${grade}° de secundaria` :
      level === 'high_school'   ? `${grade}° de preparatoria` :
      level === 'exam_prepa'    ? `preparación para examen de ingreso a preparatoria (COMIPEMS)` :
      level === 'exam_uni'      ? `preparación para examen de ingreso a universidad (UNAM/IPN)` :
      `${grade}° grado`
    const isExam = level === 'exam_prepa' || level === 'exam_uni'

    const themeList = themes
      .map((t) => `- key: "${slugifyTheme(t.name)}"  →  temática: "${t.name}"`)
      .join('\n')

    return `Eres un experto en educación mexicana y storytelling pedagógico.
Vas a generar contenido educativo inmersivo para estudiantes mexicanos de ${educationContextLabel}.

Vas a generar contenido para VARIAS temáticas a la vez. Para CADA temática, esa temática NO es un adorno — es el MUNDO donde ocurre todo el contenido. El alumno debe sentir que aprende DENTRO de esa temática, no que alguien la menciona de pasada.

ANTES DE ESCRIBIR cada temática, identifica mentalmente:
1. Los 5 personajes/elementos MÁS FAMOSOS de esa temática a nivel mundial (2024-2025)
2. Las 3 situaciones MÁS ICÓNICAS que cualquier fan reconocería al instante
3. Los términos/mecánicas MÁS USADOS por la comunidad real de esa temática

Usa SIEMPRE lo más famoso, no lo más oscuro. Un alumno de 13-18 años en México debe reconocer cada referencia. Nada genérico. Nada inventado.
Adapta vocabulario y complejidad a ${educationContextLabel}.
${isExam ? 'Enfócate en conceptos frecuentes en exámenes de admisión, con distractores plausibles en el quiz.' : ''}

TEMA A EXPLICAR (el mismo para todas las temáticas):
- Tema: "${topic.name}"
- Materia: "${subject.name}"
- Nivel: ${educationContextLabel}

TEMÁTICAS A GENERAR (genera un grupo por cada una, usando su "key" EXACTA en el campo "theme"):
${themeList}

Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional, con esta estructura EXACTA:

{
  "topic_slug": "${topic.slug}",
  "groups": [
    {
      "theme": "<la key EXACTA de la temática, copiada de la lista de arriba>",
      "sections": [
        { "type": "analogy", "title": "título con algo específico de la temática", "content": "Situación concreta y detallada de la temática: escenario, personajes y el problema que surge naturalmente. Detalles reales (nombres, mecánicas). Mínimo 100 palabras. El concepto académico debe emerger de la situación, no al revés.", "display_order": 1 },
        { "type": "explanation", "title": "conecta la situación con el concepto formal", "content": "Arranca con 'Lo que acabas de ver en [situación] es exactamente [concepto].' Explica el concepto formal con **negritas** en términos clave. Máximo 100 palabras.", "display_order": 2 },
        { "type": "example", "title": "Ejemplo resuelto — situación diferente de la temática", "content": "Problema NUEVO dentro de la temática, distinto al de la analogía. Resuelto paso a paso con **pasos numerados**. Los datos vienen del universo de la temática. Máximo 120 palabras.", "display_order": 3 },
        { "type": "key_fact", "title": "Lo que debes recordar", "content": "Definición formal en 1-2 oraciones con **negritas** en lo crítico. Incluye fórmula o regla si aplica.", "display_order": 4 },
        { "type": "tip", "title": "${isExam ? 'Tip para el examen de admisión' : 'Tip para no fallar en el examen'}", "content": "${isExam ? 'Consejo estratégico para resolver rápido en COMIPEMS/UNAM. Menciona la trampa más común en las opciones.' : 'Truco práctico para recordar el concepto o evitar el error más común.'} Máximo 50 palabras.", "display_order": 5 }
      ],
      "quiz_questions": [
        { "question": "básica — puede usar contexto de la temática", "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}], "correct_answer": "A", "explanation": "por qué es correcta y el error típico. Máx 50 palabras.", "difficulty": 1, "xp_reward": 20 },
        { "question": "media — aplica el concepto", "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}], "correct_answer": "B", "explanation": "por qué es correcta. Máx 50 palabras.", "difficulty": 2, "xp_reward": 30 },
        { "question": "difícil — requiere razonamiento, no memorización", "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}], "correct_answer": "C", "explanation": "por qué es correcta y por qué los distractores son plausibles. Máx 50 palabras.", "difficulty": 3, "xp_reward": 50 },
        { "question": "media — aplica en contexto diferente de la temática", "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}], "correct_answer": "D", "explanation": "por qué es correcta y el error típico. Máx 50 palabras.", "difficulty": 2, "xp_reward": 30 },
        { "question": "difícil — combina conceptos o varios pasos", "options": [{"letter":"A","text":"opción"},{"letter":"B","text":"opción"},{"letter":"C","text":"opción"},{"letter":"D","text":"opción"}], "correct_answer": "A", "explanation": "por qué es correcta y por qué los distractores son plausibles. Máx 50 palabras.", "difficulty": 3, "xp_reward": 50 }
      ],
      "interactive_note": "Agrega también de 1 a 3 bloques interactivos a este mismo array 'sections' (display_order 6,7,8), ver reglas abajo."
    }
  ]
}

IMPORTANTE:
- Genera EXACTAMENTE un grupo por cada temática de la lista (${themes.length} grupos en total).
- Usa la key EXACTA de cada temática en el campo "theme". No inventes temáticas que no estén en la lista.
- Cada grupo: 5 secciones de texto (analogy, explanation, example, key_fact, tip) y 5 preguntas de quiz.
- Mantén "topic_slug" tal cual: "${topic.slug}".

BLOQUES INTERACTIVOS (además de las 5 secciones de texto, en CADA grupo):
- Agrega de 1 a 3 bloques interactivos al MISMO array "sections", con display_order 6, 7, 8. No repitas el mismo tipo dentro de un grupo. No inventes datos; si hay matemáticas, deben ser exactos. Mantén la temática.
- "steps": proceso o acumulación. "visual":"bar" si un número sube/baja (cada paso con "delta") más "start"; "visual":"chain" para pasos narrativos (cada paso solo "text").
- "sort": clasificar en 2 categorías (máx 3). 4 a 6 items; cada item con "b" = índice de cubeta correcta.
- "scrubber": un eje/continuo. "min" < "max", "start" en rango, 2 a 5 "points" con "v" y "l".
- Formato EXACTO de cada bloque interactivo:
{ "type": "scrubber", "title": "Pruébalo", "content": "respaldo", "display_order": 6, "data": { "intro": "...", "unit": "...", "min": -64, "max": 120, "start": 64, "points": [ { "v": 64, "l": "etiqueta" } ], "question": "opcional" } }
{ "type": "sort", "title": "Clasifica", "content": "respaldo", "display_order": 7, "data": { "prompt": "...", "buckets": ["A","B"], "items": [ { "t": "texto", "b": 0 } ] } }
{ "type": "steps", "title": "Resuélvelo conmigo", "content": "respaldo", "display_order": 8, "data": { "intro": "...", "visual": "bar", "start": 75, "steps": [ { "text": "qué pasa", "delta": -40 } ] } }`
  }

  async function handleSaveBatchJson() {
    setBatchError(null)
    setBatchResults([])
    setSavingBatch(true)

    let parsed: { topic_slug?: string; groups?: unknown[] }
    try {
      let clean = batchJson.replace(/```json|```/g, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (jsonMatch) clean = jsonMatch[0]
      parsed = JSON.parse(clean)
    } catch {
      setBatchError('El JSON no es válido. Copia TODO el texto que te dio Opus, sin agregar nada.')
      setSavingBatch(false)
      return
    }

    if (!parsed.groups || !Array.isArray(parsed.groups) || parsed.groups.length === 0) {
      setBatchError('El JSON no tiene la estructura correcta — falta el array "groups".')
      setSavingBatch(false)
      return
    }

    if (parsed.topic_slug && parsed.topic_slug !== topic.slug) {
      setBatchError(`Este JSON es del tema "${parsed.topic_slug}", pero estás en "${topic.slug}". No se guardó nada.`)
      setSavingBatch(false)
      return
    }

    const results: { theme: string; status: 'saved' | 'skipped' | 'error'; detail?: string }[] = []

    for (const rawGroup of parsed.groups) {
      const group = rawGroup as { theme?: string; sections?: unknown[]; quiz_questions?: unknown[] }
      const keyLabel = group.theme ?? '(sin theme)'

      if (!group.theme || !group.sections || !Array.isArray(group.sections) || group.sections.length === 0) {
        results.push({ theme: keyLabel, status: 'skipped', detail: 'sin theme o sin sections' })
        continue
      }

      const resolved = resolveThemeKey(group.theme, themes)
      if (!resolved) {
        results.push({ theme: keyLabel, status: 'skipped', detail: 'temática no reconocida' })
        continue
      }

      if (resolved.themeId === null) {
        results.push({ theme: resolved.themeName, status: 'skipped', detail: 'base aún no soportado (pendiente endpoint)' })
        continue
      }

      try {
        const res = await fetch('/api/admin/save-generated-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicId: topic.id,
            themeId: resolved.themeId,
            themeName: resolved.themeName,
            sections: group.sections,
            quiz_questions: group.quiz_questions ?? [],
          }),
        })
        const data = await res.json()
        if (data.error) {
          results.push({ theme: resolved.themeName, status: 'error', detail: data.error })
        } else {
          results.push({ theme: resolved.themeName, status: 'saved' })
          if (resolved.themeId === selectedThemeId) {
            if (data.sections) setSections(data.sections)
            if (data.quizQuestions) setQuizQuestions(data.quizQuestions)
            setPublished(false)
          }
        }
      } catch (err) {
        results.push({ theme: resolved.themeName, status: 'error', detail: err instanceof Error ? err.message : 'red' })
      }
    }

    setBatchResults(results)
    setSavingBatch(false)
    if (results.filter((r) => r.status === 'saved').length === 0) {
      setBatchError('No se guardó ninguna temática. Revisa el JSON.')
    }
  }

  async function handleGenerateDiagram() {
    setGeneratingDiagram(true)
    setDiagramError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 55000)

      const res = await fetch('/api/admin/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topicId: topic.id,
          topicName: topic.name,
          subjectName: subject.name,
          themeId: selectedThemeId,
          themeName: themes.find((t) => t.id === selectedThemeId)?.name,
          sections: sections.map((s) => ({ type: s.type, content: s.content })),
        }),
      })

      clearTimeout(timeoutId)
      const data = await res.json()

      if (data.error) {
        setDiagramError(`Error: ${data.error}`)
        return
      }

      if (data.diagram) {
        setSections((prev) => {
          const filtered = prev.filter((s) => s.type !== 'diagram')
          const newSection = { ...data.diagram }
          const inserted = [...filtered, newSection]
          return inserted.sort((a, b) => a.display_order - b.display_order)
        })
      }
    } catch (err) {
      setDiagramError(`Error: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setGeneratingDiagram(false)
    }
  }

  const ADMIN_TOOLBAR_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: -12,
    right: 8,
    zIndex: 10,
    display: 'flex',
    gap: 6,
    background: '#0f0a1e',
    borderRadius: 50,
    padding: '4px 8px',
    border: '1px solid rgba(124,58,237,0.3)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  }

  const TOOLBAR_BTN_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 4px',
  }

  return (
    <div style={{ fontFamily: 'var(--font-nunito)', color: '#e2d9f3', minHeight: '100vh', maxWidth: isDesktop ? 1100 : '100%', margin: '0 auto' }}>
      {generating && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(15,10,30,0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '3px solid rgba(124,58,237,0.2)',
            borderTop: '3px solid #7c3aed',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 15,
            color: '#e2d9f3',
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            Generando contenido...
          </div>
          <div style={{
            fontSize: 14,
            color: '#a78bfa',
            fontWeight: 600,
            maxWidth: 280,
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Claude está creando las secciones y preguntas. Esto tarda unos 30 segundos.
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      {generatingDiagram && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(15,10,30,0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '3px solid rgba(6,182,212,0.2)',
            borderTop: '3px solid #06b6d4',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 15,
            color: '#e2d9f3',
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            Generando diagrama...
          </div>
          <div style={{
            fontSize: 14,
            color: '#a78bfa',
            fontWeight: 600,
            maxWidth: 260,
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Claude está creando el diagrama visual. Esto tarda unos 30 segundos.
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      {/* ─── MODAL: ELEGIR MODO DE GENERACIÓN ─── */}
      {showGenerateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(15,10,30,0.95)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflowY: 'auto',
          padding: '24px 16px',
        }}>
          <div style={{
            background: '#1a1035',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 580,
            marginTop: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#e2d9f3',
                  marginBottom: 4,
                }}>
                  Generar contenido
                </div>
                <div style={{ fontSize: 13, color: '#a78bfa' }}>
                  {topic.name} · {themes.find(t => t.id === selectedThemeId)?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid #2D2048',
                  borderRadius: 10,
                  color: '#a78bfa',
                  fontSize: 18,
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              background: '#1C1033',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#e2d9f3' }}>Claude Sonnet (automático)</div>
                  <div style={{ fontSize: 13, color: '#a78bfa' }}>Genera y guarda en un clic. Más rápido.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateInternal}
                style={{
                  width: '100%',
                  minHeight: 44,
                  background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: 0.5,
                }}
              >
                Generar con Sonnet →
              </button>
            </div>

            <div style={{
              background: '#1C1033',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 14,
              padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>👑</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>Claude Opus (manual)</div>
                  <div style={{ fontSize: 13, color: '#a78bfa' }}>Mejor calidad. Copia el prompt → pégalo en claude.ai → pega aquí el resultado.</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#a78bfa',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                }}>
                  Paso 1 — Copia este prompt y pégalo en claude.ai con Opus
                </div>
                <div style={{
                  background: '#0f0a1e',
                  border: '1px solid #2D2048',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  color: '#a78bfa',
                  fontFamily: 'monospace',
                  maxHeight: 120,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}>
                  {buildOpusPrompt().substring(0, 300)}...
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(buildOpusPrompt())
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2500)
                  }}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.1)',
                    border: copied ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(251,191,36,0.3)',
                    borderRadius: 10,
                    color: copied ? '#10b981' : '#fbbf24',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)',
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? '✓ Prompt copiado' : '📋 Copiar prompt completo'}
                </button>
              </div>

              <div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#a78bfa',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                }}>
                  Paso 2 — Pega aquí el JSON que te dio Opus
                </div>
                <textarea
                  value={manualJson}
                  onChange={(e) => {
                    setManualJson(e.target.value)
                    setManualJsonError(null)
                  }}
                  placeholder={'{\n  "sections": [...],\n  "quiz_questions": [...]\n}'}
                  style={{
                    width: '100%',
                    minHeight: 140,
                    background: '#0f0a1e',
                    border: manualJsonError ? '1.5px solid #ef4444' : '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 13,
                    padding: '10px 12px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                />
                {manualJsonError && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    color: '#fca5a5',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {manualJsonError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSaveManualJson}
                  disabled={savingManual || manualJson.trim().length < 10}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    marginTop: 10,
                    background: 'rgba(251,191,36,0.15)',
                    border: '1px solid rgba(251,191,36,0.4)',
                    borderRadius: 12,
                    color: '#fbbf24',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: (savingManual || manualJson.trim().length < 10) ? 'not-allowed' : 'pointer',
                    opacity: (savingManual || manualJson.trim().length < 10) ? 0.5 : 1,
                    fontFamily: 'var(--font-nunito)',
                  }}
                >
                  {savingManual ? '⏳ Guardando...' : '💾 Guardar contenido de Opus'}
                </button>
              </div>
            </div>

            {/* ─── CARD: OPUS LOTE (todas las temáticas) ─── */}
            <div style={{
              background: '#1C1033',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 14,
              padding: 18,
              marginTop: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🚀</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#67e8f9' }}>Opus — todas las temáticas (lote)</div>
                  <div style={{ fontSize: 13, color: '#a78bfa' }}>Un solo prompt genera las {themes.length} temáticas de este tema. Pega el JSON y se guarda cada una en su lugar.</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Paso 1 — Copia este prompt y pégalo en claude.ai con Opus
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(buildOpusBatchPrompt())
                    setBatchCopied(true)
                    setTimeout(() => setBatchCopied(false), 2500)
                  }}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    background: batchCopied ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.1)',
                    border: batchCopied ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(6,182,212,0.3)',
                    borderRadius: 10,
                    color: batchCopied ? '#10b981' : '#67e8f9',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)',
                  }}
                >
                  {batchCopied ? '✓ Prompt de lote copiado' : `📋 Copiar prompt de lote (${themes.length} temáticas)`}
                </button>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Paso 2 — Pega aquí el JSON de lote que te dio Opus
                </div>
                <textarea
                  value={batchJson}
                  onChange={(e) => {
                    setBatchJson(e.target.value)
                    setBatchError(null)
                  }}
                  placeholder={'{\n  "topic_slug": "...",\n  "groups": [ ... ]\n}'}
                  style={{
                    width: '100%',
                    minHeight: 140,
                    background: '#0f0a1e',
                    border: batchError ? '1.5px solid #ef4444' : '1.5px solid #2D2048',
                    borderRadius: 10,
                    color: '#e2d9f3',
                    fontSize: 13,
                    padding: '10px 12px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                />
                {batchError && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    color: '#fca5a5',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {batchError}
                  </div>
                )}
                {batchResults.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {batchResults.map((r, i) => (
                      <div key={i} style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: r.status === 'saved' ? '#6ee7b7' : r.status === 'skipped' ? '#fbbf24' : '#fca5a5',
                      }}>
                        {r.status === 'saved' ? '✓' : r.status === 'skipped' ? '⚠️' : '✕'} {r.theme}{r.detail ? ` — ${r.detail}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSaveBatchJson}
                  disabled={savingBatch || batchJson.trim().length < 10}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    marginTop: 10,
                    background: 'rgba(6,182,212,0.15)',
                    border: '1px solid rgba(6,182,212,0.4)',
                    borderRadius: 12,
                    color: '#67e8f9',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: (savingBatch || batchJson.trim().length < 10) ? 'not-allowed' : 'pointer',
                    opacity: (savingBatch || batchJson.trim().length < 10) ? 0.5 : 1,
                    fontFamily: 'var(--font-nunito)',
                  }}
                >
                  {savingBatch ? '⏳ Guardando temáticas...' : '💾 Guardar todas las temáticas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADMIN TOP BANNER ─── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: '#1e1040',
          borderBottom: '2px solid rgba(124,58,237,0.4)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Left */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#1a1035',
              border: '1px solid #2D2048',
              cursor: 'pointer',
              color: '#a78bfa',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <span
            style={{
              fontSize: 13,
              color: '#a78bfa',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {subject.name}
          </span>
          <span style={{ color: '#2D2048', fontSize: 14 }}>›</span>
          <span
            style={{
              fontSize: 15,
              color: '#e2d9f3',
              fontWeight: 800,
              fontFamily: 'var(--font-orbitron)',
            }}
          >
            {topic.name}
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={selectedThemeId}
            onChange={(e) => {
              if (!published && sections.length > 0) {
                const confirm = window.confirm(
                  '⚠️ Este contenido aún no está publicado.\n\n¿Seguro que quieres cambiar de temática? El contenido generado ya está guardado en la base de datos y podrás volver a verlo cuando regreses a esta temática.'
                )
                if (!confirm) return
              }
              setThemeChanging(true)
              setPublished(false)
              setSelectedThemeId(e.target.value)
              const url = new URL(window.location.href)
              url.searchParams.set('themeId', e.target.value)
              router.push(url.pathname + '?' + url.searchParams.toString())
            }}
            style={{
              background: '#1C1033',
              border: '1px solid #2D2048',
              borderRadius: 10,
              color: '#e2d9f3',
              padding: '6px 12px',
              fontSize: 14,
              fontFamily: 'var(--font-nunito)',
              cursor: 'pointer',
            }}
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 13, color: '#a78bfa' }}>
            {completedCount} alumnos completaron
          </span>

          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 50,
              padding: '4px 12px',
              ...(published
                ? {
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                  }
                : {
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    color: '#fbbf24',
                  }),
            }}
          >
            {published ? '● Publicado' : sections.length === 0 ? '○ Sin contenido' : '○ Listo para publicar'}
          </span>

          <button
            type="button"
            onClick={togglePublish}
            disabled={!published && sections.length === 0}
            style={{
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: 14,
              fontWeight: 800,
              fontFamily: 'var(--font-nunito)',
              cursor: (!published && sections.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!published && sections.length === 0) ? 0.4 : 1,
              ...(published
                ? {
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444',
                  }
                : {
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                  }),
            }}
          >
            {published ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* ─── STUDENT VIEW ─── */}
      <div style={{ maxWidth: isDesktop ? 780 : 440, margin: '0 auto' }}>
        {themeChanging && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(15,10,30,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid rgba(124,58,237,0.2)',
              borderTop: '3px solid #7c3aed',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 14,
              color: '#a78bfa',
              fontWeight: 700,
              letterSpacing: 1,
            }}>
              Cargando temática...
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
        {/* Student top bar */}
        <div
          style={{
            position: 'sticky',
            top: 56,
            background: '#0f0a1e',
            borderBottom: '1px solid rgba(124,58,237,0.15)',
            padding: '18px 16px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/guia/${subject.slug}`)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#1a1035',
              border: '1px solid #2D2048',
              cursor: 'pointer',
              color: '#a78bfa',
              fontSize: 16,
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: '#a78bfa',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              {subject.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 15,
                fontWeight: 900,
                color: '#e2d9f3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {topic.name}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 50,
              padding: '4px 10px',
              fontSize: 13,
              fontWeight: 800,
              color: '#fbbf24',
              flexShrink: 0,
            }}
          >
            ⚡ +{sessionXp} XP
          </div>
        </div>

        {/* Tabs row */}
        <div
          style={{
            display: 'flex',
            padding: '0 16px',
            borderBottom: '1px solid rgba(124,58,237,0.15)',
          }}
        >
          {(
            [
              { key: 'guia', label: '📖 Guía' },
              { key: 'quiz', label: '🎮 Quiz' },
              { key: 'resumen', label: '⚡ Resumen' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: '10px 0',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                background: 'none',
                fontFamily: 'var(--font-nunito)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'color 0.2s',
                color: activeTab === key ? '#e2d9f3' : '#a78bfa',
                borderBottom:
                  activeTab === key ? '2.5px solid #7c3aed' : '2.5px solid transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── TAB: GUÍA ─── */}
        <div style={{ display: activeTab === 'guia' ? 'block' : 'none', padding: 16 }}>
          {sections.length === 0 ? (
            <div
              style={{
                background: '#1a1035',
                border: '2px dashed rgba(124,58,237,0.3)',
                borderRadius: 20,
                padding: '40px 24px',
                textAlign: 'center',
                margin: '16px 0',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 16,
                  color: '#a78bfa',
                  marginBottom: 8,
                }}
              >
                Sin contenido para esta temática
              </div>
              <div style={{ fontSize: 15, color: '#a78bfa', marginBottom: 20 }}>
                Genera las secciones y preguntas de quiz con un solo clic
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  minHeight: 52,
                  padding: '0 32px',
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                }}
              >
                {generating ? '⏳ Generando...' : '✨ Generar contenido con Claude'}
              </button>
              {generating && (
                <div style={{ fontSize: 14, color: '#a78bfa', marginTop: 12 }}>
                  Generando... esto toma unos segundos
                </div>
              )}
              {generateError && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10,
                  color: '#fca5a5',
                  fontSize: 14,
                  fontWeight: 600,
                }}>
                  {generateError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 40 }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute',
                left: 15,
                top: 20,
                bottom: 20,
                width: 1,
                background: 'rgba(124,58,237,0.2)',
              }} />

              {orderedSections.map((section, index) => {
                const meta = SECTION_TYPE_CONFIG[section.type]
                return (
                  <RevealOnScroll key={section.id}>
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    {/* Numbered dot */}
                    <div style={{
                      position: 'absolute',
                      left: -33,
                      top: 16,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: `2px solid ${meta.color}`,
                      background: '#0f0a1e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      color: meta.color,
                      fontFamily: 'var(--font-nunito)',
                    }}>
                      {index + 1}
                    </div>

                    {/* Admin toolbar */}
                    <div style={ADMIN_TOOLBAR_STYLE}>
                      {section.type !== 'diagram' && (
                        <button
                          type="button"
                          onClick={() => startEdit(section.id, section.content)}
                          style={TOOLBAR_BTN_STYLE}
                          title="Editar"
                        >
                          ✏️
                        </button>
                      )}
                      {section.type === 'diagram' && (
                        <button
                          type="button"
                          onClick={handleGenerateDiagram}
                          disabled={generatingDiagram}
                          style={TOOLBAR_BTN_STYLE}
                          title="Regenerar diagrama"
                        >
                          🔄
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(section.id)}
                        style={TOOLBAR_BTN_STYLE}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>

                    {editingId === section.id ? (
                      /* Edit mode */
                      <div style={{
                        background: '#1a1035',
                        border: '2px solid #7c3aed',
                        borderRadius: 16,
                        padding: 16,
                      }}>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: 120,
                            background: '#1C1033',
                            border: '1.5px solid #2D2048',
                            borderRadius: 10,
                            color: '#e2d9f3',
                            fontSize: 16,
                            lineHeight: 1.65,
                            padding: '10px 12px',
                            fontFamily: 'var(--font-nunito)',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid #2D2048',
                              color: '#a78bfa',
                              borderRadius: 10,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-nunito)',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSection(section.id)}
                            style={{
                              background: '#7c3aed',
                              border: 'none',
                              color: 'white',
                              borderRadius: 10,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-nunito)',
                            }}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Card */
                      <div style={{
                        background: '#1a1035',
                        border: `1px solid ${meta.borderColor}`,
                        borderRadius: 14,
                        overflow: 'hidden',
                      }}>
                        {/* Header */}
                        <div style={{
                          padding: '10px 16px',
                          borderBottom: `1px solid ${meta.borderColor}`,
                          background: meta.headerBg,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}>
                          <span style={{ fontSize: 15 }}>{meta.icon}</span>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'uppercase' as const,
                            letterSpacing: 1,
                            color: meta.color,
                          }}>
                            {meta.label}
                          </span>
                        </div>

                        {/* Content */}
                        <div style={{
                          padding: (section.type === 'diagram' || section.type === 'sort' || section.type === 'scrubber' || section.type === 'steps') ? '0' : '14px 16px',
                          fontSize: 15,
                          lineHeight: 1.75,
                          color: '#e2d9f3',
                        }}>
                          {section.type === 'diagram' ? (
                            <div
                              style={{ width: '100%' }}
                              dangerouslySetInnerHTML={{ __html: section.content
                                .replace(/<svg([^>]*?)width="[^"]*"([^>]*?)height="[^"]*"/g, '<svg$1$2')
                                .replace(/<svg([^>]*?)height="[^"]*"([^>]*?)width="[^"]*"/g, '<svg$1$2')
                                .replace('<svg ', '<svg style="width:100%;height:auto;display:block;" ')
                            }}
                            />
                          ) : section.type === 'sort' ? (
                            <SortBlock data={section.data} />
                          ) : section.type === 'scrubber' ? (
                            <ScrubberBlock data={section.data} />
                          ) : section.type === 'steps' ? (
                            <StepsBlock data={section.data} />
                          ) : (section.type === 'analogy' || section.type === 'example') ? (
                            <CollapsibleText text={section.content} />
                          ) : renderContent(section.content)}
                        </div>

                        {/* Footer XP */}
                        <div style={{
                          padding: '8px 16px 12px',
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}>
                          <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                            Leíste esto{' '}
                            <span style={{ color: '#fbbf24' }}>+10 XP</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  </RevealOnScroll>
                )
              })}
            </div>
          )}

          {/* Generate diagram button */}
          {sections.length > 0 && !sections.find((s) => s.type === 'diagram') && (
            <div style={{
              marginTop: 8,
              padding: '20px 16px',
              background: '#1a1035',
              border: '2px dashed rgba(6,182,212,0.3)',
              borderRadius: 14,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: '#a78bfa', marginBottom: 12 }}>
                El diagrama visual aún no fue generado para esta temática
              </div>
              <button
                type="button"
                onClick={handleGenerateDiagram}
                disabled={generatingDiagram}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 24px',
                  fontFamily: 'var(--font-orbitron)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: generatingDiagram ? 'not-allowed' : 'pointer',
                  opacity: generatingDiagram ? 0.7 : 1,
                }}
              >
                {generatingDiagram ? '⏳ Generando diagrama...' : '🎨 Generar diagrama visual'}
              </button>
              {diagramError && (
                <div style={{
                  marginTop: 10,
                  color: '#fca5a5',
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  {diagramError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── TAB: QUIZ ─── */}
        <div style={{ display: activeTab === 'quiz' ? 'block' : 'none', padding: 16 }}>
          {quizQuestions.length === 0 ? (
            <div
              style={{
                background: '#1a1035',
                border: '1px solid rgba(124,58,237,0.2)',
                borderRadius: 16,
                padding: '32px 16px',
                textAlign: 'center',
                color: '#a78bfa',
                fontSize: 16,
              }}
            >
              Preguntas próximamente
            </div>
          ) : (
            <>
              {/* Score display */}
              <div style={{ textAlign: 'center', paddingBottom: 16 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-orbitron)',
                    fontSize: 24,
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #fbbf24, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {score} / {quizQuestions.length}
                </div>
                <div
                  style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600, marginTop: 4 }}
                >
                  Respuestas correctas
                </div>
              </div>

              {/* Combo dots */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: i < combo ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                      border:
                        i < combo
                          ? '1px solid #fbbf24'
                          : '1px solid rgba(124,58,237,0.3)',
                      boxShadow:
                        i < combo ? '0 0 6px rgba(251,191,36,0.5)' : 'none',
                    }}
                  />
                ))}
                <span style={{ fontSize: 13, color: '#a78bfa' }}>
                  {combo >= 3 ? 'Combo x2 🔥' : combo >= 2 ? 'Combo x1.5 ⚡' : 'Combo'}
                </span>
              </div>

              {quizQuestions.map((question, index) => {
                const isAnswered = !!answers[question.id]
                const isLocked = index > 0 && !answers[quizQuestions[index - 1].id]
                const earnedXp = xpPerQuestion[question.id] ?? 0
                const comboWhenAnswered = comboAtAnswer[question.id] ?? 0
                const isCorrectAnswer = answers[question.id] === question.correct_answer

                return (
                  <div key={question.id} style={{ position: 'relative' }}>
                    {/* Admin toolbar */}
                    <div style={ADMIN_TOOLBAR_STYLE}>
                      <button
                        type="button"
                        onClick={() => startEditQuestion(question)}
                        style={TOOLBAR_BTN_STYLE}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(question.id)}
                        style={TOOLBAR_BTN_STYLE}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>

                    {editingQuestionId === question.id && editQuestionData ? (
                      /* Question edit form */
                      <div
                        style={{
                          background: '#1a1035',
                          border: '2px solid #7c3aed',
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ marginBottom: 10 }}>
                          <label
                            style={{
                              fontSize: 13,
                              color: '#a78bfa',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Pregunta
                          </label>
                          <textarea
                            value={editQuestionData.question}
                            onChange={(e) =>
                              setEditQuestionData((prev) =>
                                prev ? { ...prev, question: e.target.value } : prev
                              )
                            }
                            style={{
                              width: '100%',
                              minHeight: 72,
                              background: '#1C1033',
                              border: '1.5px solid #2D2048',
                              borderRadius: 10,
                              color: '#e2d9f3',
                              fontSize: 15,
                              padding: '8px 12px',
                              fontFamily: 'var(--font-nunito)',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {editQuestionData.options.map((opt, i) => (
                          <div key={opt.letter} style={{ marginBottom: 8 }}>
                            <label
                              style={{
                                fontSize: 13,
                                color: '#a78bfa',
                                fontWeight: 700,
                                display: 'block',
                                marginBottom: 4,
                              }}
                            >
                              Opción {opt.letter}
                            </label>
                            <input
                              value={opt.text}
                              onChange={(e) => {
                                const newOptions = editQuestionData.options.map((o, j) =>
                                  j === i ? { ...o, text: e.target.value } : o
                                )
                                setEditQuestionData((prev) =>
                                  prev ? { ...prev, options: newOptions } : prev
                                )
                              }}
                              style={{
                                width: '100%',
                                background: '#1C1033',
                                border: '1.5px solid #2D2048',
                                borderRadius: 10,
                                color: '#e2d9f3',
                                fontSize: 15,
                                padding: '8px 12px',
                                fontFamily: 'var(--font-nunito)',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        ))}

                        <div style={{ marginBottom: 10 }}>
                          <label
                            style={{
                              fontSize: 13,
                              color: '#a78bfa',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Respuesta correcta
                          </label>
                          <select
                            value={editQuestionData.correct_answer}
                            onChange={(e) =>
                              setEditQuestionData((prev) =>
                                prev ? { ...prev, correct_answer: e.target.value } : prev
                              )
                            }
                            style={{
                              background: '#1C1033',
                              border: '1.5px solid #2D2048',
                              borderRadius: 10,
                              color: '#e2d9f3',
                              padding: '8px 12px',
                              fontSize: 15,
                              fontFamily: 'var(--font-nunito)',
                              cursor: 'pointer',
                            }}
                          >
                            {editQuestionData.options.map((o) => (
                              <option key={o.letter} value={o.letter}>
                                {o.letter}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                          <label
                            style={{
                              fontSize: 13,
                              color: '#a78bfa',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              display: 'block',
                              marginBottom: 6,
                            }}
                          >
                            Explicación
                          </label>
                          <textarea
                            value={editQuestionData.explanation}
                            onChange={(e) =>
                              setEditQuestionData((prev) =>
                                prev ? { ...prev, explanation: e.target.value } : prev
                              )
                            }
                            style={{
                              width: '100%',
                              minHeight: 72,
                              background: '#1C1033',
                              border: '1.5px solid #2D2048',
                              borderRadius: 10,
                              color: '#e2d9f3',
                              fontSize: 15,
                              padding: '8px 12px',
                              fontFamily: 'var(--font-nunito)',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionId(null)
                              setEditQuestionData(null)
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid #2D2048',
                              color: '#a78bfa',
                              borderRadius: 10,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-nunito)',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveQuestion(question.id)}
                            style={{
                              background: '#7c3aed',
                              border: 'none',
                              color: 'white',
                              borderRadius: 10,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-nunito)',
                            }}
                          >
                            {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Student question card */
                      <div
                        style={{
                          background: '#1e1040',
                          border: '1px solid rgba(236,72,153,0.2)',
                          borderRadius: 16,
                          padding: 18,
                          marginBottom: 12,
                          opacity: isLocked ? 0.4 : 1,
                          pointerEvents: isLocked ? 'none' : 'auto',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#f0e6ff',
                            marginBottom: 14,
                            lineHeight: 1.55,
                          }}
                        >
                          {question.question}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {question.options.map((option) => {
                            const isThisCorrect = option.letter === question.correct_answer
                            const isThisSelected = answers[question.id] === option.letter
                            const isThisWrong = isThisSelected && !isThisCorrect

                            let optBg = 'rgba(255,255,255,0.04)'
                            let optBorder = '1px solid rgba(124,58,237,0.2)'
                            let optColor = '#e2d9f3'

                            if (isAnswered && isThisCorrect) {
                              optBg = 'rgba(16,185,129,0.2)'
                              optBorder = '1px solid #10b981'
                              optColor = '#6ee7b7'
                            } else if (isThisWrong) {
                              optBg = 'rgba(239,68,68,0.15)'
                              optBorder = '1px solid #ef4444'
                              optColor = '#fca5a5'
                            }

                            return (
                              <button
                                key={option.letter}
                                type="button"
                                onClick={() => handleAnswer(question.id, option.letter, question)}
                                style={{
                                  width: '100%',
                                  background: optBg,
                                  border: optBorder,
                                  borderRadius: 10,
                                  padding: '10px 14px',
                                  fontSize: 15,
                                  color: optColor,
                                  cursor: isAnswered ? 'default' : 'pointer',
                                  textAlign: 'left',
                                  fontFamily: 'var(--font-nunito)',
                                  fontWeight: 600,
                                  transition: 'all 0.2s',
                                  pointerEvents: isAnswered ? 'none' : 'auto',
                                }}
                              >
                                <strong style={{ fontWeight: 800 }}>{option.letter}.</strong>{' '}
                                {option.text}
                              </button>
                            )
                          })}
                        </div>

                        {isAnswered && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: '10px 12px',
                              borderRadius: 8,
                              fontSize: 15,
                              fontWeight: 700,
                              ...(isCorrectAnswer
                                ? {
                                    background: 'rgba(16,185,129,0.12)',
                                    color: '#6ee7b7',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                  }
                                : {
                                    background: 'rgba(239,68,68,0.08)',
                                    color: '#fca5a5',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                  }),
                            }}
                          >
                            {question.explanation}
                            {isCorrectAnswer && earnedXp > 0 && (
                              <span
                                style={{
                                  background: 'rgba(251,191,36,0.15)',
                                  color: '#fbbf24',
                                  borderRadius: 50,
                                  padding: '2px 8px',
                                  fontSize: 13,
                                  marginLeft: 8,
                                }}
                              >
                                +{earnedXp}XP{comboWhenAnswered >= 3 ? ' COMBO🔥' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* ─── TAB: RESUMEN ─── */}
        <div style={{ display: activeTab === 'resumen' ? 'block' : 'none', padding: 16 }}>
          <div
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 12,
              color: '#a78bfa',
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            ⚡ Lo que necesitas saber
          </div>

          <div>
            {resumenSections.map((section, index) => (
              <div
                key={section.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '12px 0',
                  borderBottom:
                    index < resumenSections.length - 1
                      ? '1px solid rgba(124,58,237,0.1)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(124,58,237,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    flexShrink: 0,
                  }}
                >
                  {SECTION_ICONS[section.type]}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: '#e2d9f3' }}>
                  {renderContent(section.content)}
                </div>
              </div>
            ))}
          </div>

          {/* Completion card */}
          <div
            style={{
              marginTop: 16,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 14,
              padding: 14,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: 14,
                color: '#10b981',
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              ✓ Listo por ahora
            </div>
            <div style={{ fontSize: 14, color: '#a78bfa' }}>Haz el Quiz para ganar XP</div>
            <button
              type="button"
              onClick={() => setActiveTab('quiz')}
              style={{
                width: '100%',
                minHeight: 52,
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                fontFamily: 'var(--font-orbitron)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: 1,
                marginTop: 12,
              }}
            >
              IR AL QUIZ →
            </button>
          </div>
        </div>

        <div style={{ height: 80 }} />
      </div>

      {/* ─── FLOATING REGENERATE BUTTON (when content exists) ─── */}
      {sections.length > 0 && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 30,
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 50,
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 800,
            cursor: generating ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            fontFamily: 'var(--font-nunito)',
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? '⏳ Generando...' : '🔄 Regenerar todo'}
        </button>
      )}
    </div>
  )
}
