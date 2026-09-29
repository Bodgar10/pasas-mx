'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Pasita from '@/components/mascota/Pasita'
import Confetti from '@/components/global/Confetti'
import { track } from '@/lib/analytics/track'
import { SITIO } from '@/lib/seo'
import {
  OLEADAS_GRATIS,
  OLEADAS_TOTALES,
  PREGUNTAS_POR_OLEADA,
  mensajePapa,
  resultadoOleada,
  urlUnete,
  type ResultadoOleada,
} from '@/lib/horda-publica'
import type { PreguntaPublica, TemaPublico } from '@/lib/horda-publica-server'

/**
 * Horda pública: oleadas 1 a 3 sin cuenta, y al superar la 3, el muro.
 *
 * Misma mecánica y mismo look que la Horda de adentro
 * (guia/[subject]/[topic]/horda/horda-client.tsx), pero sin sesión:
 *   - las preguntas y la revisión llegan de /api/horda-publica/*, que nunca
 *     devuelven la respuesta correcta ni preguntas de la oleada 4+;
 *   - las cuentas de la oleada y el récord viven en el navegador. No hay XP.
 *
 * El muro no abre un camino nuevo de registro: manda al onboarding de siempre
 * con nivel y grado puestos (vía /unete). El cobro sigue igual.
 */

type Fase = 'tutorial' | 'playing' | 'waveResult' | 'dead' | 'muro' | 'papa' | 'broken'

const LLAVE_RECORD = (topicId: string) => `pasas-horda:mejor:${topicId}`

function leerRecord(topicId: string): number {
  try {
    return Number(window.localStorage.getItem(LLAVE_RECORD(topicId))) || 0
  } catch {
    return 0
  }
}
function guardarRecord(topicId: string, oleada: number) {
  try {
    if (oleada > leerRecord(topicId)) window.localStorage.setItem(LLAVE_RECORD(topicId), String(oleada))
  } catch {}
}

export default function HordaPublicaClient({ tema }: { tema: TemaPublico }) {
  const [fase, setFase] = useState<Fase>('tutorial')
  const [oleada, setOleada] = useState(1)
  const [preguntas, setPreguntas] = useState<PreguntaPublica[]>([])
  const [idx, setIdx] = useState(0)
  const [correctas, setCorrectas] = useState(0)
  const [elegida, setElegida] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string; hint: string | null } | null>(null)
  const [resultado, setResultado] = useState<{ tipo: ResultadoOleada; correctas: number } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [record, setRecord] = useState(0)
  const [aviso, setAviso] = useState('')
  const correctasRef = useRef(0)
  const partidasRef = useRef(0)

  // Récord local. Desde la función async, como en el resto del repo
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => setRecord(leerRecord(tema.topicId)))()
  }, [tema.topicId])

  async function cargarOleada(w: number) {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/horda-publica/oleada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: tema.topicId, wave: w }),
      })
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error(data.error ?? 'No llegaron preguntas')
      }
      setPreguntas(data.questions)
      setOleada(w)
      setIdx(0)
      setCorrectas(0)
      correctasRef.current = 0
      setElegida(null)
      setFeedback(null)
      setResultado(null)
      setFase('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la oleada')
      setFase('broken')
      track('horda_publica_error', { topic: tema.topicName, oleada: w })
    } finally {
      setCargando(false)
    }
  }

  function empezar() {
    partidasRef.current += 1
    track('horda_publica_iniciada', {
      topic: tema.topicName,
      subject_slug: tema.subjectSlug,
      es_reintento: partidasRef.current > 1,
      mejor_oleada_previa: record,
    })
    void cargarOleada(1)
  }

  async function responder(letter: string) {
    if (cargando || feedback) return
    setElegida(letter)
    setCargando(true)
    try {
      const res = await fetch('/api/horda-publica/respuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: tema.topicId, questionId: preguntas[idx].id, letter }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setFeedback(data)
      if (data.correct) {
        correctasRef.current += 1
        setCorrectas(correctasRef.current)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al responder')
      setElegida(null)
    } finally {
      setCargando(false)
    }
  }

  function continuar() {
    setFeedback(null)
    setElegida(null)
    if (idx < preguntas.length - 1) {
      setIdx(idx + 1)
      return
    }

    const n = correctasRef.current
    const tipo = resultadoOleada(n)
    track('horda_publica_oleada', { topic: tema.topicName, oleada, n_correctas_en_oleada: n, resultado: tipo })

    if (tipo === 'avanza') {
      guardarRecord(tema.topicId, oleada)
      setRecord((r) => Math.max(r, oleada))
      if (oleada >= OLEADAS_GRATIS) {
        track('horda_publica_muro', { topic: tema.topicName, subject_slug: tema.subjectSlug })
        setFase('muro')
        return
      }
    }
    if (tipo === 'reinicia') {
      setResultado({ tipo, correctas: n })
      setFase('dead')
      return
    }
    setResultado({ tipo, correctas: n })
    setFase('waveResult')
  }

  function seguirTrasOleada() {
    if (!resultado) return
    void cargarOleada(resultado.tipo === 'avanza' ? oleada + 1 : oleada)
  }

  const dominio = SITIO.replace(/^https?:\/\//, '')
  const mensaje = mensajePapa(tema.topicName, `${dominio}${urlUnete(tema.subjectSlug, tema.topicSlug)}`)

  async function copiarMensaje() {
    track('horda_publica_mensaje', { topic: tema.topicName, canal: 'copiar' })
    try {
      await navigator.clipboard.writeText(mensaje)
      setAviso('Mensaje copiado. Pégalo en el chat de tu papá o mamá.')
    } catch {
      setAviso('No se pudo copiar. Mantén presionado el mensaje para copiarlo.')
    }
  }

  const barra = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
      <Link
        href="/"
        style={{ fontFamily: 'var(--font-orbitron)', fontWeight: 900, fontSize: 13, letterSpacing: 1, color: '#e2d9f3', textDecoration: 'none' }}
      >
        PASAS<span style={{ color: '#ec4899' }}>·</span>HORDA
      </Link>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#8f84b5', textAlign: 'right' }}>{tema.subjectName}</span>
    </div>
  )

  if (fase === 'broken') {
    return (
      <Shell>
        {barra}
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }} aria-hidden="true">🛠️</div>
          <h1 style={{ ...h1Style, fontSize: 21 }}>Algo se atoró</h1>
          <p style={subStyle}>{error ?? 'Error desconocido'}</p>
          <PrimaryButton onClick={() => cargarOleada(oleada)} disabled={cargando}>
            {cargando ? 'Reintentando…' : 'Reintentar'}
          </PrimaryButton>
        </div>
      </Shell>
    )
  }

  if (fase === 'tutorial') {
    return (
      <Shell>
        {barra}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Pasita pose="zombie" size={130} animacion="flotar" />
          </div>
          <h1 style={h1Style}>Modo Horda</h1>
          <p style={{ ...subStyle, margin: '0 0 24px' }}>{tema.topicName}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <Rule n="1" text={`Cada oleada son ${PREGUNTAS_POR_OLEADA} preguntas. Hay ${OLEADAS_TOTALES} oleadas en total.`} />
          <Rule n="2" text="Aciertas 4 o 5 → avanzas a la siguiente oleada." />
          <Rule n="3" text="Aciertas 3 → repites la misma oleada." />
          <Rule n="4" text="Aciertas 2 o menos → vuelves a la oleada 1." />
          <Rule n="5" text={`Las oleadas 1 a ${OLEADAS_GRATIS} son gratis y sin cuenta. Las más difíciles, con tu cuenta de PASAS.`} />
        </div>
        {record > 0 && <div style={recordBox}>Tu récord en este teléfono: oleada {record} de {OLEADAS_TOTALES}</div>}
        <PrimaryButton onClick={empezar} disabled={cargando}>
          {cargando ? 'Preparando…' : '▶ Empezar horda'}
        </PrimaryButton>
        <GhostLink href="/arcade">Ir al reto diario</GhostLink>
      </Shell>
    )
  }

  if (fase === 'dead') {
    return (
      <Shell>
        {barra}
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <div style={{ fontSize: 62, lineHeight: 1, marginBottom: 14 }} aria-hidden="true">💀</div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 24, fontWeight: 900, color: '#ef4444', letterSpacing: 1, marginBottom: 10 }}>
            LA HORDA TE ALCANZÓ
          </div>
          <p style={subStyle}>
            Solo acertaste {resultado?.correctas ?? 0} de {PREGUNTAS_POR_OLEADA} · Vuelves a la oleada 1
          </p>
          {record > 0 && (
            <p style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, margin: '0 0 22px' }}>
              Tu récord sigue siendo la oleada {record} de {OLEADAS_TOTALES}
            </p>
          )}
          <PrimaryButton onClick={empezar} disabled={cargando}>
            {cargando ? 'Preparando…' : '🔁 Intentar de nuevo'}
          </PrimaryButton>
        </div>
      </Shell>
    )
  }

  if (fase === 'waveResult' && resultado) {
    const repite = resultado.tipo === 'repite'
    return (
      <Shell>
        {barra}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">{repite ? '😰' : '⚔️'}</div>
          <h1 style={{ ...h1Style, fontSize: 22, color: repite ? '#fbbf24' : '#10b981' }}>
            {repite ? 'Apenas la libraste' : `¡Oleada ${oleada} superada!`}
          </h1>
          <p style={{ ...subStyle, margin: '0 0 8px' }}>
            {resultado.correctas} de {PREGUNTAS_POR_OLEADA} correctas
          </p>
          <p style={{ fontSize: 13, color: '#8f84b5', margin: '0 0 24px', fontWeight: 600 }}>
            {repite ? 'Repites esta oleada' : `Sigue la oleada ${oleada + 1}`}
          </p>
          <PrimaryButton onClick={seguirTrasOleada} disabled={cargando}>
            {cargando ? 'Preparando…' : 'Continuar'}
          </PrimaryButton>
        </div>
      </Shell>
    )
  }

  if (fase === 'muro') {
    return (
      <Shell>
        <Confetti />
        {barra}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <Pasita pose="celebrando" size={120} animacion="saltar" />
            </div>
            <h1 style={{ ...h1Style, fontSize: 24, color: '#10b981' }}>¡Oleada {OLEADAS_GRATIS} superada!</h1>
            <p style={{ ...subStyle, margin: 0 }}>{tema.topicName}</p>
          </div>

          <div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${OLEADAS_TOTALES}, 1fr)`, gap: 6 }} aria-label={`Oleadas 1 a ${OLEADAS_GRATIS} superadas; las demás, con cuenta`}>
              {Array.from({ length: OLEADAS_TOTALES }).map((_, i) => {
                const hecha = i < OLEADAS_GRATIS
                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 10,
                      padding: '7px 0 6px',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: 14,
                      background: hecha ? 'rgba(16,185,129,0.14)' : '#1a1035',
                      border: hecha ? '1.5px solid #10b981' : '1.5px dashed rgba(236,72,153,0.55)',
                      color: hecha ? '#10b981' : '#ec4899',
                    }}
                  >
                    {i + 1}
                    <div style={{ fontSize: 10 }} aria-hidden="true">{hecha ? '✓' : '🔒'}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#8f84b5', marginTop: 6 }}>
              <span>Gratis</span>
              <span>Las difíciles · con cuenta</span>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e2d9f3' }}>
              Te faltan las {OLEADAS_TOTALES - OLEADAS_GRATIS} oleadas difíciles
            </div>
            <Bullet>Oleadas 4 a 6 de este tema, y el Modo Horda de todos tus temas</Bullet>
            <Bullet>Guías explicadas con lo que te gusta: anime, futbol, K-pop o videojuegos</Bullet>
            <Bullet>Todas las materias de tu grado, no solo historia</Bullet>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#e2d9f3', textAlign: 'center' }}>
              ¿Quién va a crear la cuenta?
            </div>
            <ChoiceButton
              onClick={() => {
                track('horda_publica_muro_eleccion', { topic: tema.topicName, quien: 'estudiante' })
                setFase('papa')
              }}
              titulo="Soy estudiante"
              sub="Te armamos el mensaje para tu papá o mamá"
            />
            <ChoiceButton
              primario
              onClick={() => {
                track('horda_publica_muro_eleccion', { topic: tema.topicName, quien: 'adulto' })
                // Ruta con redirección del servidor: navegación completa, no router.push.
                window.location.href = `${urlUnete(tema.subjectSlug, tema.topicSlug)}?quien=adulto`
              }}
              titulo="Soy papá, mamá o tutor"
              sub="O soy estudiante con 18 años o más"
            />
            <p style={{ fontSize: 12, fontWeight: 700, color: '#8f84b5', textAlign: 'center', margin: 0 }}>
              7 días gratis · Requiere tarjeta · Cancela cuando quieras
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
            <TextButton onClick={empezar}>Repetir oleadas 1 a {OLEADAS_GRATIS}</TextButton>
            <Link href="/arcade" style={textLink}>Ir al reto diario</Link>
          </div>
        </div>
      </Shell>
    )
  }

  if (fase === 'papa') {
    return (
      <Shell>
        {barra}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ ...h1Style, fontFamily: 'var(--font-nunito)', fontSize: 23, textAlign: 'center' }}>
            Pídele a tu papá o mamá que te abra la cuenta
          </h1>
          <p style={{ ...subStyle, margin: 0, textAlign: 'center', color: '#8f84b5' }}>
            Si tienes menos de 18, la cuenta la abre un adulto. Te dejamos el mensaje listo.
          </p>
          <div style={{ background: '#efeae2', borderRadius: 14, padding: '12px 10px', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                alignSelf: 'flex-end',
                maxWidth: '94%',
                background: '#d9fdd3',
                color: '#111b21',
                borderRadius: 10,
                borderTopRightRadius: 2,
                padding: '8px 10px',
                fontSize: 14,
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                userSelect: 'all',
                fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {mensaje}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener"
              onClick={() => track('horda_publica_mensaje', { topic: tema.topicName, canal: 'whatsapp' })}
              style={{ ...btnBase, background: '#10b981', color: '#06241a', textDecoration: 'none' }}
            >
              WhatsApp
            </a>
            <button type="button" onClick={copiarMensaje} style={{ ...btnBase, background: 'transparent', border: '1.5px solid #2D2048', color: '#e2d9f3' }}>
              Copiar
            </button>
          </div>
          <div role="status" aria-live="polite" style={{ fontSize: 13, fontWeight: 800, color: '#10b981', textAlign: 'center', minHeight: 18 }}>
            {aviso}
          </div>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#e2d9f3' }}>¿Qué ve tu papá o mamá al abrirlo?</div>
            <Bullet n="1">El registro de PASAS, que ya sabe tu nivel y tu grado</Bullet>
            <Bullet n="2">Solo elige qué te gusta: anime, futbol, K-pop o videojuegos</Bullet>
            <Bullet n="3">Crea la cuenta con 7 días gratis y ya puedes seguir</Bullet>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
            <TextButton onClick={() => setFase('muro')}>← Volver</TextButton>
            <TextButton onClick={empezar}>Mientras, repetir oleadas 1 a {OLEADAS_GRATIS}</TextButton>
          </div>
        </div>
      </Shell>
    )
  }

  const actual = preguntas[idx]
  if (!actual) {
    return (
      <Shell>
        {barra}
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <h1 style={{ ...h1Style, fontSize: 21 }}>Se perdió el hilo</h1>
          <PrimaryButton onClick={empezar}>Volver a empezar</PrimaryButton>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {barra}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: 13, fontWeight: 900, color: '#ec4899', letterSpacing: 1 }}>
            OLEADA {oleada} / {OLEADAS_TOTALES}
          </span>
          <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700 }}>
            {idx + 1} de {PREGUNTAS_POR_OLEADA} · {correctas} ✓
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: PREGUNTAS_POR_OLEADA }).map((_, i) => (
            <div
              key={i}
              style={{ flex: 1, height: 5, borderRadius: 3, background: i < idx ? '#7c3aed' : i === idx ? '#ec4899' : '#2D2048' }}
            />
          ))}
        </div>
      </div>

      <div style={{ background: '#1e1040', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#f0e6ff', marginBottom: 16, lineHeight: 1.55 }}>{actual.question}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actual.options.map((o) => {
            const esta = elegida === o.letter
            let bg = 'rgba(255,255,255,0.04)'
            let border = '1px solid rgba(124,58,237,0.25)'
            let color = '#e2d9f3'
            if (esta && !feedback) {
              bg = 'rgba(124,58,237,0.35)'
              border = '1px solid #7c3aed'
            } else if (esta && feedback) {
              bg = feedback.correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.18)'
              border = `1px solid ${feedback.correct ? '#10b981' : '#ef4444'}`
              color = feedback.correct ? '#6ee7b7' : '#fca5a5'
            }
            return (
              <button
                key={o.letter}
                type="button"
                disabled={!!feedback || cargando}
                onClick={() => responder(o.letter)}
                style={{
                  width: '100%',
                  background: bg,
                  border,
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 15,
                  color,
                  cursor: feedback ? 'default' : 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-nunito)',
                  fontWeight: 600,
                  opacity: feedback && !esta ? 0.4 : 1,
                }}
              >
                <strong style={{ fontWeight: 800 }}>{o.letter}.</strong> {o.text}
              </button>
            )
          })}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.55,
              fontWeight: 600,
              background: feedback.correct ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${feedback.correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: feedback.correct ? '#6ee7b7' : '#fca5a5',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{feedback.correct ? '✓ Correcto' : '✗ Incorrecto'}</div>
            {feedback.hint && <div style={{ color: '#fbbf24', marginBottom: 6 }}>💡 {feedback.hint}</div>}
            <div style={{ color: '#c4b5fd' }}>{feedback.explanation}</div>
          </div>
        )}
      </div>

      {error && <ErrorBox text={error} />}

      {feedback && (
        <div style={{ marginTop: 16 }}>
          <PrimaryButton onClick={continuar}>Continuar</PrimaryButton>
        </div>
      )}
    </Shell>
  )
}

const h1Style: React.CSSProperties = {
  fontFamily: 'var(--font-orbitron)',
  fontSize: 26,
  fontWeight: 900,
  color: '#e2d9f3',
  margin: '0 0 6px',
  textWrap: 'balance',
}

const subStyle: React.CSSProperties = { fontSize: 15, color: '#a78bfa', margin: '0 0 20px', fontWeight: 600 }

const recordBox: React.CSSProperties = {
  background: 'rgba(251,191,36,0.1)',
  border: '1px solid rgba(251,191,36,0.3)',
  borderRadius: 12,
  padding: '12px 16px',
  marginBottom: 20,
  textAlign: 'center',
  fontSize: 13,
  color: '#fbbf24',
  fontWeight: 700,
}

const card: React.CSSProperties = {
  background: '#1a1035',
  border: '1px solid #2D2048',
  borderRadius: 18,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const btnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 50,
  borderRadius: 14,
  border: 'none',
  fontSize: 16,
  fontWeight: 900,
  fontFamily: 'var(--font-nunito)',
  cursor: 'pointer',
}

const textLink: React.CSSProperties = {
  color: '#a78bfa',
  fontSize: 14,
  fontWeight: 800,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#0f0a1e', padding: '20px 16px 40px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </main>
  )
}

function Rule({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div
        style={{
          minWidth: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(124,58,237,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
          color: '#a78bfa',
          fontFamily: 'var(--font-orbitron)',
        }}
      >
        {n}
      </div>
      <span style={{ fontSize: 14, color: '#e2d9f3', lineHeight: 1.5, fontWeight: 600 }}>{text}</span>
    </div>
  )
}

function Bullet({ children, n }: { children: React.ReactNode; n?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, fontSize: 14, fontWeight: 700, color: '#e2d9f3', lineHeight: 1.4 }}>
      <span style={{ color: '#10b981', fontWeight: 900 }}>{n ?? '✓'}</span>
      <span>{children}</span>
    </div>
  )
}

function ChoiceButton({ onClick, titulo, sub, primario }: { onClick: () => void; titulo: string; sub: string; primario?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        width: '100%',
        textAlign: 'left',
        borderRadius: 14,
        padding: '12px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--font-nunito)',
        background: primario ? '#7c3aed' : '#221545',
        border: primario ? '1.5px solid #7c3aed' : '1.5px solid #2D2048',
        color: '#fff',
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 900 }}>{titulo}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: primario ? '#e9ddff' : '#8f84b5' }}>{sub}</span>
    </button>
  )
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...btnBase, width: '100%', minHeight: 52, background: '#7c3aed', color: '#fff', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}
    >
      {children}
    </button>
  )
}

function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ ...textLink, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-nunito)', padding: 0 }}>
      {children}
    </button>
  )
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ ...textLink, display: 'block', textAlign: 'center', marginTop: 16, textDecoration: 'none' }}>
      {children}
    </Link>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#fca5a5',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  )
}
