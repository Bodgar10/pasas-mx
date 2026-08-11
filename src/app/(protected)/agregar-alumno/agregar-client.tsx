'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/global/Logo'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { formatoMXN, CICLO_LABEL } from '@/lib/payments/config'

interface Theme {
  id: string
  name: string
  description: string
  icon: string | null
  subtitle: string | null
}

interface Alumno {
  id: string
  slot: number
  display_name: string
  education_level: string | null
  grade: number | null
}

interface Props {
  alumnos: Alumno[]
  themes: Theme[]
}

/** Lo que devuelve GET /api/seats/preview. Montos en pesos. */
interface Preview {
  proratedNow: number
  recurringTotal: number
  nextRenewal: string
  seatPrice: number
  billingCycle: string
  currentSeats: number
  prorationDate: number
}

// ---------------------------------------------------------------------------
// Mismos catalogos que /onboarding. Si cambia uno, cambia el otro.
// ---------------------------------------------------------------------------
const LEVELS = [
  { emoji: '📚', label: 'Secundaria', subtitle: '1°, 2° o 3° año', needsGrade: true },
  { emoji: '🚀', label: 'Preparatoria / Bachillerato', subtitle: '1°, 2° o 3° año', needsGrade: true },
  ...(FEATURE_FLAGS.ENABLE_EXAM_PLANS ? [
    { emoji: '📝', label: 'Examen de Preparatoria', subtitle: 'COMIPEMS · CCH · CECyT', needsGrade: false },
    { emoji: '🏛️', label: 'Examen de Universidad', subtitle: 'UNAM · IPN · UAM', needsGrade: false },
  ] : []),
]

const GRADES = [
  { num: '1°', label: 'Primer año' },
  { num: '2°', label: 'Segundo año' },
  { num: '3°', label: 'Tercer año' },
]

const GRADE_MAP: Record<string, number> = { '1°': 1, '2°': 2, '3°': 3 }

/** Misma tabla que onboarding/actions.ts: learners.education_level es enum. */
const LEVEL_MAP: Record<string, 'middle_school' | 'high_school'> = {
  'Secundaria': 'middle_school',
  'Preparatoria / Bachillerato': 'high_school',
  'Examen de Preparatoria': 'high_school',
  'Examen de Universidad': 'high_school',
}

/** Etiqueta corta para el nombre generado: "Sofia — 2° Preparatoria". */
const NIVEL_CORTO: Record<string, string> = {
  'Secundaria': 'Secundaria',
  'Preparatoria / Bachillerato': 'Preparatoria',
  'Examen de Preparatoria': 'Examen Prepa',
  'Examen de Universidad': 'Examen Universidad',
}

const cardBase: React.CSSProperties = {
  border: '1.5px solid #2D2048',
  backgroundColor: '#1a1035',
  borderRadius: '14px',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s',
}

const cardSelected: React.CSSProperties = {
  border: '1.5px solid #7c3aed',
  backgroundColor: '#2d1b69',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1C1033',
  border: '1.5px solid #2D2048',
  borderRadius: 10,
  color: '#e2d9f3',
  fontSize: 15,
  padding: '10px 12px',
  fontFamily: 'var(--font-nunito)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#a78bfa',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1,
  display: 'block',
  marginBottom: 6,
}

function Checkmark({ selected }: { selected: boolean }) {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? '#7c3aed' : 'transparent',
        border: selected ? '2px solid #7c3aed' : '2px solid #2D2048',
        transition: 'all 0.15s',
      }}
    >
      {selected && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function Seccion({ numero, titulo, children }: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            backgroundColor: '#7c3aed',
            color: '#fff',
            fontFamily: 'var(--font-orbitron)',
            fontSize: 13,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {numero}
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 17,
            fontWeight: 900,
            color: '#e2d9f3',
            margin: 0,
          }}
        >
          {titulo}
        </h2>
      </div>
      {children}
    </div>
  )
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function AgregarClient({ alumnos, themes }: Props) {
  const router = useRouter()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Paso 1
  const [quien, setQuien] = useState<string | null>(null)   // id del alumno, o 'otra'
  const [nombre, setNombre] = useState('')
  const [birthdate, setBirthdate] = useState('')

  // Pasos 2 y 3
  const [level, setLevel] = useState<string | null>(null)
  const [grade, setGrade] = useState<string | null>(null)
  const [themeId, setThemeId] = useState<string | null>(null)

  // Paso 4
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  // Si create-learner ya corrio, se guarda el id: reintentar el cobro NO
  // debe crear una segunda fila.
  const [learnerCreado, setLearnerCreado] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        const res = await fetch('/api/seats/preview')
        const json = await res.json()
        if (cancelado) return
        if (!res.ok) {
          setPreviewError(json.error ?? 'No pudimos calcular el costo')
          return
        }
        setPreview(json as Preview)
      } catch {
        if (!cancelado) setPreviewError('No pudimos calcular el costo')
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  const selectedLevel = LEVELS.find((l) => l.label === level)
  const mismaPersona = quien && quien !== 'otra' ? alumnos.find((a) => a.id === quien) : undefined

  /**
   * Nombre generado para el caso "el mismo, otro grado".
   *
   * Se recorta lo que haya despues de un " — " previo: si el alumno ya
   * se llama "Sofia — 1° Secundaria", el nuevo debe ser
   * "Sofia — 2° Secundaria" y no acumular sufijos.
   */
  const nombreGenerado = mismaPersona && level
    ? `${mismaPersona.display_name.split(' — ')[0]} — ${grade ? `${grade} ` : ''}${NIVEL_CORTO[level] ?? level}`
    : ''

  const displayName = mismaPersona ? nombreGenerado : nombre.trim()

  const paso1Listo = !!quien && (
    mismaPersona ? true : (nombre.trim().length > 1 && birthdate !== '')
  )
  const paso2Listo = !!level && (!selectedLevel?.needsGrade || !!grade)
  const paso3Listo = !!themeId

  const listoParaConfirmar =
    paso1Listo && paso2Listo && paso3Listo && !!preview && acepto && !enviando

  const ciclo = preview ? (CICLO_LABEL[preview.billingCycle] ?? preview.billingCycle).toLowerCase() : ''

  async function handleConfirmar() {
    if (!listoParaConfirmar || !preview || !level) return
    setEnviando(true)
    setErrorEnvio(null)

    try {
      // a) La fila. Si ya existe de un intento anterior, se reusa.
      let learnerId = learnerCreado
      if (!learnerId) {
        const resCrear = await fetch('/api/seats/create-learner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName,
            birthdate: mismaPersona ? null : birthdate,
            samePersonAs: mismaPersona ? mismaPersona.id : null,
            educationLevel: LEVEL_MAP[level] ?? 'high_school',
            grade: grade ? (GRADE_MAP[grade] ?? null) : null,
            themeId,
          }),
        })
        const jsonCrear = await resCrear.json()
        if (!resCrear.ok) {
          setErrorEnvio(jsonCrear.error ?? 'No pudimos crear el alumno')
          setEnviando(false)
          return
        }
        learnerId = jsonCrear.learnerId as string
        setLearnerCreado(learnerId)
      }

      // b) El cobro. prorationDate es el del preview: sin el, el monto
      //    que se acaba de aceptar y el que se cobra difieren por los
      //    segundos que el usuario tardo en confirmar.
      const resCobro = await fetch('/api/seats/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          prorationDate: preview.prorationDate,
        }),
      })
      const jsonCobro = await resCobro.json()

      // c) La fila ya existe en 'inactive'; reintentar NO la duplica.
      if (!resCobro.ok) {
        setErrorEnvio(jsonCobro.error ?? 'No pudimos procesar el cargo')
        setEnviando(false)
        return
      }

      // d) Listo.
      router.push('/dashboard')
      router.refresh()
    } catch {
      setErrorEnvio('No pudimos completar la operación. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px 60px',
        color: '#e2d9f3',
        fontFamily: 'var(--font-nunito)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 390 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: '#7c3aed' }}>
            <Logo size={40} />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#e2d9f3',
              margin: 0,
            }}
          >
            Agregar un lugar
          </h1>
          <p style={{ fontSize: 14, color: '#a78bfa', margin: '8px 0 0', lineHeight: 1.5 }}>
            Cada persona tiene su propio grado, su temática y su avance por separado.
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#1a1035',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 20,
            padding: '24px 20px',
          }}
        >
          {/* ---------------- PASO 1 ---------------- */}
          <Seccion numero={1} titulo="¿Quién va a estudiar?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alumnos.map((a) => {
                const selected = quien === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setQuien(a.id)}
                    style={{
                      ...cardBase,
                      ...(selected ? cardSelected : {}),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <Checkmark selected={selected} />
                    <div style={{ flex: 1 }}>
                      {/* El boton dice el NOMBRE, nunca "yo mismo": el
                          titular suele ser el papa o la mama. */}
                      <p style={{ fontWeight: 700, fontSize: 15, color: '#e2d9f3', margin: 0 }}>
                        {a.display_name.split(' — ')[0]} — el mismo
                      </p>
                      <p style={{ fontSize: 13, color: '#a78bfa', margin: '2px 0 0' }}>
                        Otro grado, mismo estudiante
                      </p>
                    </div>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setQuien('otra')}
                style={{
                  ...cardBase,
                  ...(quien === 'otra' ? cardSelected : {}),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Checkmark selected={quien === 'otra'} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#e2d9f3', margin: 0 }}>
                    Otra persona
                  </p>
                  <p style={{ fontSize: 13, color: '#a78bfa', margin: '2px 0 0' }}>
                    Un hermano, una amiga, alguien más
                  </p>
                </div>
              </button>
            </div>

            {quien === 'otra' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="ej. Diego"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fecha de nacimiento *</label>
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {mismaPersona && level && (
              <p style={{ fontSize: 13, color: '#a78bfa', margin: '12px 0 0', lineHeight: 1.5 }}>
                Se llamará <strong style={{ color: '#e2d9f3' }}>{nombreGenerado}</strong> en tu panel.
              </p>
            )}
          </Seccion>

          {/* ---------------- PASO 2 ---------------- */}
          <Seccion numero={2} titulo="Nivel y grado">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {LEVELS.map((opt) => {
                const selected = level === opt.label
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => { setLevel(opt.label); setGrade(null) }}
                    style={{
                      ...cardBase,
                      ...(selected ? cardSelected : {}),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '12px 16px',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 16, color: '#e2d9f3', margin: 0 }}>
                        {opt.label}
                      </p>
                      <p style={{ fontSize: 14, color: '#a78bfa', margin: '2px 0 0' }}>
                        {opt.subtitle}
                      </p>
                    </div>
                    <Checkmark selected={selected} />
                  </button>
                )
              })}
            </div>

            {selectedLevel?.needsGrade && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
                {GRADES.map((g) => {
                  const selected = grade === g.num
                  return (
                    <button
                      key={g.num}
                      type="button"
                      onClick={() => setGrade(g.num)}
                      style={{
                        ...cardBase,
                        ...(selected ? cardSelected : {}),
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px 8px 16px',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-orbitron)',
                          fontSize: 28,
                          fontWeight: 900,
                          color: '#7c3aed',
                        }}
                      >
                        {g.num}
                      </span>
                      <span style={{ fontSize: 13, color: '#a78bfa', marginTop: 4, textAlign: 'center' }}>
                        {g.label}
                      </span>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Checkmark selected={selected} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Seccion>

          {/* ---------------- PASO 3 ---------------- */}
          <Seccion numero={3} titulo="Temática">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {themes.map((t) => {
                const selected = themeId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeId(t.id)}
                    style={{
                      ...cardBase,
                      ...(selected ? cardSelected : {}),
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '14px 12px',
                      position: 'relative',
                    }}
                  >
                    <span style={{ fontSize: 24, marginBottom: 8 }}>{t.icon ?? '✨'}</span>
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#e2d9f3', margin: 0 }}>
                      {t.name}
                    </p>
                    <p style={{ fontSize: 13, color: '#a78bfa', margin: '3px 0 0' }}>
                      {t.subtitle ?? t.description}
                    </p>
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <Checkmark selected={selected} />
                    </div>
                  </button>
                )
              })}
            </div>
          </Seccion>

          {/* ---------------- PASO 4 ---------------- */}
          <Seccion numero={4} titulo="Resumen y confirmación">
            {previewError && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontSize: 14,
                  color: '#f87171',
                  lineHeight: 1.5,
                }}
              >
                {previewError}
              </div>
            )}

            {!preview && !previewError && (
              <div
                style={{
                  backgroundColor: '#1C1033',
                  border: '1.5px solid #2D2048',
                  borderRadius: 16,
                  padding: '20px 18px',
                  textAlign: 'center',
                  fontSize: 14,
                  color: '#a78bfa',
                }}
              >
                Calculando el costo exacto…
              </div>
            )}

            {preview && (
              <>
                <div
                  style={{
                    backgroundColor: '#1C1033',
                    border: '1.5px solid #2D2048',
                    borderRadius: 16,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {/* 🔴 Todos los montos salen del preview tal cual. No se
                      recalculan ni se redondean aqui: el numero que se
                      muestra tiene que ser el que Stripe cobra. */}
                  <p style={{ fontSize: 14, color: '#a78bfa', margin: 0, lineHeight: 1.6 }}>
                    Tu plan es <strong style={{ color: '#e2d9f3' }}>{ciclo}</strong>. El lugar
                    adicional también:{' '}
                    <strong style={{ color: '#10b981' }}>${formatoMXN(preview.seatPrice)}</strong>{' '}
                    en vez de{' '}
                    <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                      ${formatoMXN(preview.seatPrice * 2)}
                    </span>
                    .
                  </p>

                  <div style={{ height: 1, background: '#2D2048' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 14, color: '#e2d9f3', fontWeight: 800, margin: 0 }}>
                        Se cobrará hoy a tu tarjeta
                      </p>
                      <p style={{ fontSize: 12, color: '#a78bfa', margin: '2px 0 0' }}>
                        Por lo que resta de tu periodo actual
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-orbitron)',
                        fontSize: 18,
                        fontWeight: 900,
                        color: '#fbbf24',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ${formatoMXN(preview.proratedNow)}
                    </span>
                  </div>

                  <div style={{ height: 1, background: '#2D2048' }} />

                  <p style={{ fontSize: 14, color: '#a78bfa', margin: 0, lineHeight: 1.6 }}>
                    A partir del{' '}
                    <strong style={{ color: '#e2d9f3' }}>{fechaLarga(preview.nextRenewal)}</strong>,
                    tu cobro {ciclo} será de{' '}
                    <strong style={{ color: '#e2d9f3' }}>${formatoMXN(preview.recurringTotal)}</strong>.
                  </p>
                </div>

                {/* Consentimiento. Obligatorio y sin marcar por defecto:
                    el cargo sale contra una tarjeta ya guardada, sin
                    pantalla de Stripe, asi que esta es la unica
                    confirmacion informada que existe. */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginTop: 16,
                    padding: '14px 16px',
                    background: 'rgba(124,58,237,0.06)',
                    border: `1px solid ${acepto ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.2)'}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acepto}
                    onChange={(e) => setAcepto(e.target.checked)}
                    style={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      marginTop: 1,
                      accentColor: '#7c3aed',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: 13, color: '#e2d9f3', lineHeight: 1.6 }}>
                    Acepto que se cobre ${formatoMXN(preview.proratedNow)} a mi tarjeta hoy y que
                    mi cobro {ciclo} pase a ${formatoMXN(preview.recurringTotal)} a partir del{' '}
                    {fechaLarga(preview.nextRenewal)}. Entiendo que el descuento del 50% aplica
                    mientras mantenga activo el lugar principal: si lo cancelo, este lugar pasa a
                    precio de lista en la siguiente renovación, con aviso previo.
                  </span>
                </label>
              </>
            )}

            {errorEnvio && (
              <div
                style={{
                  marginTop: 14,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontSize: 14,
                  color: '#f87171',
                  lineHeight: 1.5,
                }}
              >
                {errorEnvio}
                {learnerCreado && (
                  <span style={{ display: 'block', marginTop: 6, color: '#a78bfa', fontSize: 13 }}>
                    Puedes reintentar sin duplicar el alumno.
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={!listoParaConfirmar}
              style={{
                marginTop: 20,
                width: '100%',
                minHeight: 52,
                borderRadius: 12,
                fontFamily: 'var(--font-nunito)',
                fontWeight: 900,
                fontSize: 16,
                border: 'none',
                cursor: listoParaConfirmar ? 'pointer' : 'not-allowed',
                background: listoParaConfirmar
                  ? 'linear-gradient(135deg, #7c3aed, #ec4899)'
                  : '#2D2048',
                color: listoParaConfirmar ? '#ffffff' : '#4B3D6E',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {enviando
                ? 'Procesando…'
                : errorEnvio
                  ? 'Reintentar'
                  : preview
                    ? `Confirmar y pagar $${formatoMXN(preview.proratedNow)}`
                    : 'Confirmar'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              disabled={enviando}
              style={{
                marginTop: 12,
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: enviando ? 'not-allowed' : 'pointer',
                fontSize: 16,
                fontWeight: 600,
                color: '#a78bfa',
                textAlign: 'center',
                padding: '4px 0',
                fontFamily: 'var(--font-nunito)',
              }}
            >
              ← Cancelar
            </button>
          </Seccion>
        </div>
      </div>
    </div>
  )
}
