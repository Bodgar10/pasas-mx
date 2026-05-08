'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface DiagnosticQuestion {
  id: string
  topic_id: string
  topic_name: string
  question: string
  options: { letter: string; text: string }[]
  correct_answer: string
  explanation: string
  display_order: number
}

function DiagnosticoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const gradeNumber = grade ? (parseInt(grade.replace(/[°º]/g, '').trim(), 10) || null) : null
  const theme = searchParams.get('theme') ?? ''
  const subject = searchParams.get('subject') ?? ''
  const subjectId = searchParams.get('subjectId') ?? ''
  const themeParam = searchParams.get('theme') ?? ''

  const supabase = createClient()

  const [path, setPath] = useState<'descripcion' | 'quiz'>('descripcion')
  const [description, setDescription] = useState('')
  const [limitAlcanzado, setLimitAlcanzado] = useState(false)
  const [loadingLimit, setLoadingLimit] = useState(true)

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<DiagnosticQuestion[]>([])
  const [loadingQuiz, setLoadingQuiz] = useState(false)
  const [quizStarted, setQuizStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [quizCompleted, setQuizCompleted] = useState(false)

  const canProceed =
    (path === 'descripcion' && description.trim().length >= 10) ||
    (path === 'quiz' && !quizStarted) ||
    (path === 'quiz' && quizCompleted)

  useEffect(() => {
    async function checkLimit() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      const { data: cache } = await supabase
        .from('preview_cache')
        .select('daily_count, last_reset')
        .eq('user_id', user.id)
        .eq('subject', subject)
        .eq('theme', theme)
        .single()
      if (cache && cache.last_reset === today && cache.daily_count >= 3) {
        setLimitAlcanzado(true)
      }
      setLoadingLimit(false)
    }
    checkLimit()
  }, [subject, theme])

  async function loadQuizQuestions() {
    if (!subjectId || !gradeNumber) return
    setLoadingQuiz(true)
    const { data, error } = await supabase
      .from('diagnostic_questions')
      .select('id, topic_id, topic_name, question, options, correct_answer, explanation, display_order')
      .eq('subject_id', subjectId)
      .eq('grade', gradeNumber)
      .order('display_order', { ascending: true })
    setLoadingQuiz(false)
    if (error || !data || data.length === 0) {
      return
    }
    setQuizQuestions(data)
    setQuizStarted(true)
  }

  function handleAnswer(questionId: string, letter: string) {
    if (answers[questionId]) return
    const newAnswers = { ...answers, [questionId]: letter }
    setAnswers(newAnswers)
    if (Object.keys(newAnswers).length === quizQuestions.length) {
      setQuizCompleted(true)
    }
  }

  function buildDiagnosticSummary(): string {
    if (quizQuestions.length === 0) return 'quiz'
    const weakQuestions = quizQuestions.filter(q => answers[q.id] !== q.correct_answer)
    const strongQuestions = quizQuestions.filter(q => answers[q.id] === q.correct_answer)
    return JSON.stringify({
      weak: weakQuestions.map(q => q.topic_name),
      weak_topic_ids: weakQuestions.map(q => q.topic_id),
      strong: strongQuestions.map(q => q.topic_name),
      total: quizQuestions.length,
    })
  }

  function handleBack() {
    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    router.push(`/personalizado/materia?${params.toString()}`)
  }

  async function handleNext() {
    if (!canProceed) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const diagnostico = path === 'descripcion'
      ? description.trim()
      : buildDiagnosticSummary()

    const { data: existing } = await supabase
      .from('preview_cache')
      .select('daily_count, last_reset')
      .eq('user_id', user.id)
      .eq('subject', subject)
      .eq('theme', theme)
      .single()

    const isNewDay = !existing || existing.last_reset !== today
    const newCount = isNewDay ? 1 : (existing.daily_count + 1)

    let themeId: string | null = null
    if (subjectId && path === 'quiz') {
      const { data: themeRow } = await supabase
        .from('themes')
        .select('id')
        .eq('name', themeParam)
        .maybeSingle()
      themeId = themeRow?.id ?? null
    }

    await Promise.all([
      supabase
        .from('preview_cache')
        .upsert({
          user_id: user.id,
          subject,
          theme,
          diagnostico,
          result_json: {},
          daily_count: newCount,
          last_reset: today,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,subject,theme' }),

      subjectId && path === 'quiz' && themeId
        ? supabase
            .from('user_subjects')
            .upsert({
              user_id: user.id,
              subject_id: subjectId,
              theme_id: themeId,
              initial_description: diagnostico,
              diagnostic_type: 'quiz',
              plan_type: 'ai_personalized',
              purchased_at: new Date().toISOString(),
            }, { onConflict: 'user_id,subject_id' })
        : Promise.resolve(),
    ])

    const params = new URLSearchParams({ level })
    if (grade) params.set('grade', grade)
    params.set('theme', theme)
    params.set('subject', subject)
    params.set('subjectId', subjectId)
    params.set('diagnostico', diagnostico)
    params.set('tipo', path)
    router.push(`/personalizado/preview-ia?${params.toString()}`)
  }

  if (loadingLimit) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#a78bfa', fontFamily: 'var(--font-nunito)', fontSize: 14 }}>Cargando...</p>
    </div>
  )

  if (limitAlcanzado) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: '#a78bfa', margin: 0 }}>PASAS.MX</p>
        </div>
        <div style={{ backgroundColor: '#1a1035', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#e2d9f3', margin: '0 0 8px', fontFamily: 'var(--font-nunito)' }}>Límite diario alcanzado</p>
          <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 24px', lineHeight: 1.6 }}>Ya generaste 3 diagnósticos para {subject} hoy. Regresa mañana.</p>
          <button
            type="button"
            onClick={() => { const params = new URLSearchParams({ level }); if (grade) params.set('grade', grade); params.set('theme', theme); router.push(`/personalizado/materia?${params.toString()}`) }}
            style={{ width: '100%', minHeight: 52, backgroundColor: '#7c3aed', border: 'none', borderRadius: 14, fontFamily: 'var(--font-nunito)', fontSize: 17, fontWeight: 900, color: '#ffffff', cursor: 'pointer' }}
          >
            Elegir otra materia
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 390 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontFamily: 'var(--font-orbitron)', fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: '#a78bfa', margin: 0 }}>PASAS.MX</p>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3] as const).map((s) => (
            <div key={s} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: s <= 2 ? '#7c3aed' : '#2D2048' }} />
          ))}
        </div>

        {/* Quiz mode — questions */}
        {path === 'quiz' && quizStarted && (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: '#e2d9f3', margin: '0 0 6px' }}>
                Quiz diagnóstico — {subject}
              </h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 14, color: '#a78bfa', margin: 0 }}>
                  {Object.keys(answers).length} de {quizQuestions.length} respondidas
                </p>
                {quizCompleted && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                    ✓ {quizQuestions.filter(q => answers[q.id] === q.correct_answer).length}/{quizQuestions.length} correctas
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div style={{ width: '100%', height: 4, backgroundColor: '#2D2048', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
                <div style={{
                  width: `${(Object.keys(answers).length / quizQuestions.length) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                  borderRadius: 99,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {quizQuestions.map((q, index) => {
                const answered = !!answers[q.id]
                const isLocked = index > 0 && !answers[quizQuestions[index - 1].id]
                return (
                  <div
                    key={q.id}
                    style={{
                      backgroundColor: '#1a1035',
                      border: '1px solid rgba(124,58,237,0.2)',
                      borderRadius: 16,
                      padding: '16px',
                      opacity: isLocked ? 0.35 : 1,
                      pointerEvents: isLocked ? 'none' : 'auto',
                    }}
                  >
                    {/* Topic label */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>
                      {index + 1}. {q.topic_name}
                    </div>
                    {/* Question */}
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#e2d9f3', margin: '0 0 12px', lineHeight: 1.5 }}>
                      {q.question}
                    </p>
                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt) => {
                        const isSelected = answers[q.id] === opt.letter
                        const isCorrect = opt.letter === q.correct_answer
                        const isWrong = isSelected && !isCorrect

                        let bg = 'rgba(255,255,255,0.04)'
                        let border = '1px solid rgba(124,58,237,0.2)'
                        let color = '#e2d9f3'

                        if (answered && isCorrect) {
                          bg = 'rgba(16,185,129,0.15)'
                          border = '1px solid #10b981'
                          color = '#6ee7b7'
                        } else if (isWrong) {
                          bg = 'rgba(239,68,68,0.12)'
                          border = '1px solid #ef4444'
                          color = '#fca5a5'
                        } else if (isSelected) {
                          bg = 'rgba(124,58,237,0.15)'
                          border = '1px solid #7c3aed'
                        }

                        return (
                          <button
                            key={opt.letter}
                            type="button"
                            onClick={() => handleAnswer(q.id, opt.letter)}
                            style={{
                              width: '100%',
                              background: bg,
                              border,
                              borderRadius: 10,
                              padding: '10px 14px',
                              fontSize: 14,
                              color,
                              cursor: answered ? 'default' : 'pointer',
                              textAlign: 'left',
                              fontFamily: 'var(--font-nunito)',
                              fontWeight: 600,
                              pointerEvents: answered ? 'none' : 'auto',
                              transition: 'all 0.15s',
                            }}
                          >
                            <strong style={{ fontWeight: 800 }}>{opt.letter}.</strong> {opt.text}
                          </button>
                        )
                      })}
                    </div>
                    {/* Explanation */}
                    {answered && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.5,
                        background: answers[q.id] === q.correct_answer ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)',
                        border: answers[q.id] === q.correct_answer ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                        color: '#a78bfa',
                      }}>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* CTA after completing quiz */}
            {quizCompleted && (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  marginTop: 20,
                  width: '100%',
                  minHeight: 52,
                  borderRadius: 12,
                  fontWeight: 900,
                  fontSize: 16,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  fontFamily: 'var(--font-nunito)',
                }}
              >
                Ver mi guía personalizada →
              </button>
            )}

            <button
              type="button"
              onClick={() => { setQuizStarted(false); setAnswers({}); setQuizCompleted(false) }}
              style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#a78bfa', textAlign: 'center' as const, padding: '4px 0' }}
            >
              ← Cambiar tipo de diagnóstico
            </button>
          </div>
        )}

        {/* Main card — path selector */}
        {!(path === 'quiz' && quizStarted) && (
          <div style={{ backgroundColor: '#1a1035', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: '24px 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 18, fontWeight: 900, color: '#e2d9f3', marginBottom: 6 }}>
              ¿Qué te falla en {subject}?
            </h2>
            <p style={{ fontSize: 15, color: '#a78bfa', margin: '0 0 20px' }}>
              Cuéntanos para personalizar tu guía
            </p>

            {/* Path selector */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setPath('descripcion')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  border: `1.5px solid ${path === 'descripcion' ? '#7c3aed' : '#2D2048'}`,
                  backgroundColor: path === 'descripcion' ? '#2d1b69' : '#1a1035',
                  cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#e2d9f3',
                }}
              >
                ✍️ Yo lo describo
              </button>
              <button
                type="button"
                onClick={() => setPath('quiz')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  border: `1.5px solid ${path === 'quiz' ? '#7c3aed' : '#2D2048'}`,
                  backgroundColor: path === 'quiz' ? '#2d1b69' : '#1a1035',
                  cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#e2d9f3',
                }}
              >
                🎯 Hacerme un quiz
              </button>
            </div>

            {/* Path A — description */}
            {path === 'descripcion' && (
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Ej: "No entiendo cómo resolver ecuaciones de segundo grado, siempre me confundo con la fórmula general..."`}
                  rows={5}
                  style={{
                    width: '100%', backgroundColor: '#0f0a1e', border: '1.5px solid #2D2048',
                    borderRadius: 12, padding: '12px 14px', fontSize: 15, color: '#e2d9f3',
                    resize: 'none', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' as const,
                    fontFamily: 'var(--font-nunito)',
                  }}
                />
                {description.trim().length > 0 && description.trim().length < 10 && (
                  <p style={{ fontSize: 13, color: '#f87171', margin: '6px 0 0' }}>Agrega un poco más de detalle</p>
                )}
              </div>
            )}

            {/* Path B — quiz info */}
            {path === 'quiz' && (
              <div style={{ backgroundColor: '#0f0a1e', border: '1.5px solid #2D2048', borderRadius: 12, padding: '16px 14px', fontSize: 15, color: '#a78bfa', lineHeight: 1.6 }}>
                {loadingQuiz ? (
                  <span>Cargando preguntas...</span>
                ) : quizQuestions.length > 0 ? (
                  <>
                    🎯 <strong style={{ color: '#e2d9f3' }}>{quizQuestions.length} preguntas</strong> — una por cada tema de {subject}.
                    <br /><br />
                    <span style={{ color: '#e2d9f3', fontWeight: 700 }}>Identificaremos exactamente dónde necesitas ayuda.</span>
                  </>
                ) : (
                  <>
                    🎯 Te haremos preguntas diagnósticas para identificar exactamente dónde necesitas ayuda.
                    <br /><br />
                    <span style={{ color: '#e2d9f3', fontWeight: 700 }}>¡Listo para empezar!</span>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={path === 'quiz' ? loadQuizQuestions : handleNext}
              disabled={path === 'descripcion' ? !canProceed : loadingQuiz}
              style={{
                marginTop: 20, width: '100%', minHeight: 52, borderRadius: 12,
                fontWeight: 900, fontSize: 16, border: 'none',
                cursor: (path === 'descripcion' ? !canProceed : loadingQuiz) ? 'not-allowed' : 'pointer',
                backgroundColor: (path === 'descripcion' ? canProceed : !loadingQuiz) ? '#7c3aed' : '#2D2048',
                color: (path === 'descripcion' ? canProceed : !loadingQuiz) ? '#ffffff' : '#4B3D6E',
                fontFamily: 'var(--font-nunito)',
              }}
            >
              {path === 'quiz'
                ? (loadingQuiz ? 'Cargando preguntas...' : 'Comenzar quiz →')
                : 'Ver mi guía personalizada →'}
            </button>

            <button
              type="button"
              onClick={handleBack}
              style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#a78bfa', textAlign: 'center' as const, padding: '4px 0' }}
            >
              ← Regresar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DiagnosticoPage() {
  return (
    <Suspense>
      <DiagnosticoContent />
    </Suspense>
  )
}
