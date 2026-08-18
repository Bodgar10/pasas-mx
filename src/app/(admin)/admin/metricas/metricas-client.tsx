'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { tieneAccesoVigente } from '@/lib/learners'

type Period = '24h' | '30d' | '3m' | '6m'

/**
 * La CUENTA. Ya no trae nada del alumno: `education_level`, `grade`,
 * `xp_total` y `streak_days` quedaron legacy en la migracion 035 y ahora
 * viven en `learners`. Las tres ultimas ni siquiera se usaban aqui —
 * viajaban por la red en cada carga para nada.
 */
interface User {
  id: string
  email: string
  created_at: string
  onboarding_done: boolean
  is_test: boolean
}

/** El ALUMNO. Una cuenta puede tener varios. */
interface Learner {
  id: string
  account_user_id: string
  slot: number
  display_name: string
  is_primary: boolean
  education_level: string | null
  grade: number | null
  theme_id: string | null
  xp_total: number
  streak_days: number
  last_active_at: string | null
  status: string
  access_until: string | null
}

interface Subscription {
  id: string
  user_id: string
  plan: string
  status: string
  price_mxn: number
  current_period_end: string
  cancelled_at: string | null
  created_at: string
  is_test: boolean
}

interface TopicProgress {
  user_id: string
  learner_id: string | null
  topic_id: string
  status: string
  best_score: number
  completed_at: string | null
  updated_at: string
}

interface ProgressEvent {
  user_id: string
  learner_id: string | null
  event_type: string
  xp_earned: number
  created_at: string
}

interface Topic {
  id: string
  name: string
  subject_id: string
  grade: number
}

interface Subject {
  id: string
  name: string
  slug: string
}

interface UserSubject {
  user_id: string
  learner_id: string | null
  subject_id: string
  theme_id: string
  plan_type: string
  xp: number
}

interface Props {
  allUsers: User[]
  allLearners: Learner[]
  allSubscriptions: Subscription[]
  topicProgressData: TopicProgress[]
  progressEvents: ProgressEvent[]
  allTopics: Topic[]
  allSubjects: Subject[]
  userSubjects: UserSubject[]
  timestamps: { last24h: string; last7d: string; last30d: string; last3m: string; last6m: string }
}

const PERIOD_LABELS: Record<Period, string> = {
  '24h': 'Últimas 24h',
  '30d': 'Este mes',
  '3m': 'Este trimestre',
  '6m': 'Este semestre',
}

/**
 * Clave sentinela para los alumnos sin nivel.
 *
 * `learners.education_level` es nullable y hay altas que se quedan a medias,
 * asi que omitirlos de la grafica haria que los porcentajes no sumaran 100 y
 * que nadie se enterara de que existen. Salen con etiqueta propia y al final.
 */
const SIN_NIVEL = '__sin_nivel__'

/**
 * El enum `education_level` tiene EXACTAMENTE dos valores
 * (001_initial_schema.sql:49). `exam_prepa` y `exam_uni` no son valores que
 * no se usen: son inalcanzables, la base los rechaza. No volver a ponerlos.
 */
const LEVEL_LABELS: Record<string, string> = {
  middle_school: '📚 Secundaria',
  high_school: '🎓 Preparatoria',
  [SIN_NIVEL]: '⚠️ Sin nivel',
}

const THEME_NAMES: Record<string, string> = {
  '8675082b-df0f-4599-b566-38fa13753120': '🎮 Videojuegos',
  '16b89743-e0d7-4fdb-81d6-cf23184d080f': '🎤 K-pop & K-dramas',
  '00ef7bf7-5fce-4dbe-9171-4bd413e59753': '⚽ Fútbol',
  '8c348606-4ea8-4914-83dd-47b8d039e5d1': '⚔️ Anime & Manga',
}

function StatCard({ label, value, sub, color = '#7c3aed' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#1a1035', border: `1px solid ${color}33`,
      borderRadius: 16, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: '#6b5fa0', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 13, fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, marginTop: 32 }}>
      {children}
    </div>
  )
}

export default function MetricasClient({ allUsers, allLearners, allSubscriptions, topicProgressData, progressEvents, allTopics, allSubjects, userSubjects, timestamps }: Props) {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('30d')
  // Apagado por defecto: 24 de las 28 cuentas son de prueba, asi que sin
  // filtro el tablero mide sobre todo nuestro propio testeo.
  const [incluirPrueba, setIncluirPrueba] = useState(false)
  const [users, setUsers] = useState(allUsers)
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null)
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string>('')
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteUser(userId: string) {
    setDeletingUserId(userId)
    setDeleteError(null)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'Error al eliminar usuario')
        return
      }
      setUsers(prev => prev.filter(u => u.id !== userId))
      setDeleteSuccess(`Usuario eliminado correctamente`)
      setTimeout(() => setDeleteSuccess(null), 4000)
    } catch (err) {
      setDeleteError('Error de red al eliminar usuario')
    } finally {
      setDeletingUserId(null)
      setConfirmDeleteUserId(null)
      setConfirmDeleteEmail('')
    }
  }
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const periodStart = period === '24h' ? timestamps.last24h : period === '30d' ? timestamps.last30d : period === '3m' ? timestamps.last3m : timestamps.last6m
  const now = new Date()
  const sevenDaysAgo = timestamps.last7d

  // ─────────────────────────────────────────────────────────────────────
  // FILTRO DE CUENTAS DE PRUEBA — va antes que cualquier calculo.
  //
  // Una sola derivacion a partir de un unico useState. Todo lo de abajo usa
  // las listas ya filtradas, para que no exista la posibilidad de que una
  // tarjeta se quede leyendo la lista cruda.
  //
  // El encadenamiento es cuenta -> alumno -> fila de progreso, porque
  // `is_test` solo existe en `users` y `subscriptions` (migracion 045).
  // Las tablas de progreso se filtran por pertenencia a un alumno de una
  // cuenta real, que es lo mismo pero sin duplicar la marca en cinco tablas.
  // ─────────────────────────────────────────────────────────────────────
  const usuarios = incluirPrueba ? allUsers : allUsers.filter(u => !u.is_test)
  const idsCuenta = new Set(usuarios.map(u => u.id))
  const alumnos = allLearners.filter(l => idsCuenta.has(l.account_user_id))
  const idsAlumno = new Set(alumnos.map(l => l.id))

  // `subscriptions.is_test` ya cubre las dos causas —cuenta de prueba y
  // sandbox de Stripe antes del 13-ago— asi que no hace falta cruzarlo
  // tambien contra `idsCuenta`.
  const suscripciones = incluirPrueba ? allSubscriptions : allSubscriptions.filter(s => !s.is_test)

  const progreso = progressEvents.filter(e => e.learner_id !== null && idsAlumno.has(e.learner_id))
  const avanceTopics = topicProgressData.filter(tp => tp.learner_id !== null && idsAlumno.has(tp.learner_id))
  const materiasAlumno = userSubjects.filter(us => us.learner_id !== null && idsAlumno.has(us.learner_id))

  const cuentasDePrueba = allUsers.length - allUsers.filter(u => !u.is_test).length

  // Cuentas
  const totalUsers = usuarios.length
  const newUsers = usuarios.filter(u => u.created_at >= periodStart).length
  // 🔴 `onboarding_done` mide "se registró", NO "terminó el onboarding".
  //
  // Se escribe desde el alta (s27), antes de que la persona elija nivel,
  // grado y materias. Verificado en la base: hay una cuenta con el flag en
  // true, education_level y grade en null y cero filas en user_subjects.
  //
  // Se conserva —renombrado— junto a la condicion derivada de abajo, porque
  // la BRECHA entre las dos es la senal de que el alta esta rota. Si esa
  // brecha crece, es un bug del registro y tiene que verse aqui.
  const onboardingDone = usuarios.filter(u => u.onboarding_done).length
  const conversionRate = totalUsers > 0 ? Math.round((onboardingDone / totalUsers) * 100) : 0

  // Alumnos
  //
  // El headline son los alumnos con acceso VIGENTE, no todas las filas:
  // un alumno dado de baja sigue en la tabla y contarlo inflaria el ratio
  // de asientos ocupados, que es justo para lo que sirve esta tarjeta.
  const alumnosVigentes = alumnos.filter(tieneAccesoVigente)
  const totalAlumnos = alumnosVigentes.length
  const alumnosPorCuenta = totalUsers > 0 ? (totalAlumnos / totalUsers).toFixed(1) : '0.0'
  const alumnosDadosDeBaja = alumnos.length - totalAlumnos

  // Onboarding REAL, derivado de los datos y no del flag: un alumno terminó
  // el onboarding si sabe qué estudia (nivel + grado) y tiene con qué
  // estudiarlo (al menos una materia comprada).
  const alumnosConMateria = new Set(materiasAlumno.map(us => us.learner_id as string))
  const estaCompleto = (l: Learner) =>
    l.education_level !== null && l.grade !== null && alumnosConMateria.has(l.id)

  const alumnosCompletos = alumnosVigentes.filter(estaCompleto)
  const onboardingRealPct = totalAlumnos > 0 ? Math.round((alumnosCompletos.length / totalAlumnos) * 100) : 0

  // La brecha: cuentas que el alta dio por buenas pero cuyo alumno primario
  // no tiene los datos. Cada una es un usuario que puede pagar por un
  // producto que no le sirve. Si esto no es 0, hay un bug en el registro.
  const primarioPorCuenta = new Map<string, Learner>()
  alumnos.forEach(l => {
    if (l.is_primary) primarioPorCuenta.set(l.account_user_id, l)
  })
  const brechaAlta = usuarios.filter(u => {
    if (!u.onboarding_done) return false
    const primario = primarioPorCuenta.get(u.id)
    return !primario || !estaCompleto(primario)
  }).length

  // Actividad — 🔴 NO se usa `learners.last_active_at`.
  //
  // Esa columna solo la escribe /api/section-read, asi que un alumno que
  // solo contesta quizzes o juega la horda no la actualiza JAMAS y saldria
  // como inactivo. `progress` recibe una fila por cada evento que da XP,
  // sea del tipo que sea, y es la unica fuente que cubre toda la actividad.
  //
  // Se acota a los vigentes para que el denominador de "% alumnos activos"
  // sea el mismo conjunto que "Total alumnos": si no, un alumno dado de baja
  // con progreso reciente daria un porcentaje mayor a 100.
  const idsVigentes = new Set(alumnosVigentes.map(l => l.id))
  const alumnosActivosIds = new Set(
    progreso
      .filter(e => e.created_at >= sevenDaysAgo)
      .map(e => e.learner_id as string)
      .filter(id => idsVigentes.has(id))
  )
  const alumnosActivos = alumnosActivosIds.size

  const cuentaDeAlumno = new Map(alumnos.map(l => [l.id, l.account_user_id]))
  const cuentasActivas = new Set(
    [...alumnosActivosIds]
      .map(id => cuentaDeAlumno.get(id))
      .filter((v): v is string => v !== undefined)
  ).size

  // Subscriptions
  const activeSubs = suscripciones.filter(s => s.status === 'active' && new Date(s.current_period_end) > now)
  const expiringSoon = activeSubs.filter(s => {
    const daysLeft = (new Date(s.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysLeft <= 7
  })
  const cancelledSubs = suscripciones.filter(s => s.status === 'cancelled' && s.cancelled_at && s.cancelled_at >= periodStart)
  const newSubs = suscripciones.filter(s => s.created_at >= periodStart)
  const standardSubs = activeSubs.filter(s => s.plan === 'grade')
  const personalizedSubs = activeSubs.filter(s => s.plan === 'ai_personalized')

  // MRR calculation
  const mrr = activeSubs.reduce((total, sub) => {
    const monthly = sub.price_mxn / 100
    return total + monthly
  }, 0)

  const mrrStandard = standardSubs.reduce((total, sub) => total + sub.price_mxn / 100, 0)
  const mrrPersonalized = personalizedSubs.reduce((total, sub) => total + sub.price_mxn / 100, 0)

  // Topic completions — la PK de topic_progress es (learner_id, topic_id)
  // desde la migracion 035, asi que estas filas ya son POR ALUMNO. El codigo
  // era correcto; lo que mentia eran los rotulos.
  const completedTopics = avanceTopics.filter(tp => tp.status === 'completed')
  const completedInPeriod = completedTopics.filter(tp => tp.completed_at && tp.completed_at >= periodStart)
  const perfectQuizzes = completedTopics.filter(tp => tp.best_score === 100)

  // Most completed topics
  const topicCompletionCount: Record<string, number> = {}
  completedTopics.forEach(tp => {
    topicCompletionCount[tp.topic_id] = (topicCompletionCount[tp.topic_id] ?? 0) + 1
  })
  const topTopics = Object.entries(topicCompletionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topicId, count]) => ({
      name: allTopics.find(t => t.id === topicId)?.name ?? 'Desconocido',
      subject: allSubjects.find(s => s.id === allTopics.find(t => t.id === topicId)?.subject_id)?.name ?? '',
      count,
    }))

  // Most popular themes — la unidad es el ALUMNO, no la cuenta: la llave
  // unica de user_subjects paso a (learner_id, subject_id) en la 035, asi
  // que dos hermanos que eligen K-pop suman 2. La tematica manda desde
  // user_subjects (NOT NULL) y no desde learners.theme_id (casi siempre nulo).
  const themeCount: Record<string, number> = {}
  materiasAlumno.forEach(us => {
    if (us.theme_id) themeCount[us.theme_id] = (themeCount[us.theme_id] ?? 0) + 1
  })
  const topThemes = Object.entries(themeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([themeId, count]) => ({ name: THEME_NAMES[themeId] ?? themeId, count }))

  // Education level distribution — POR ALUMNO.
  //
  // Antes salia de `users.education_level`, que solo se escribe al
  // registrarse: ignoraba todo cambio de grado (change-grade escribe solo en
  // learners) y a los alumnos 2 y 3 por completo. No estaba parada como
  // last_active_at, estaba dando numeros plausibles y equivocados.
  //
  // Los que no tienen nivel NO se omiten: se agrupan bajo SIN_NIVEL. Son
  // altas incompletas y son justo lo que hay que ver — omitirlos dejaba los
  // porcentajes sin sumar 100 sin que nada lo indicara.
  const levelCount: Record<string, number> = {}
  alumnosVigentes.forEach(l => {
    const clave = l.education_level ?? SIN_NIVEL
    levelCount[clave] = (levelCount[clave] ?? 0) + 1
  })
  // "Sin nivel" siempre al final, sea cual sea su volumen.
  const levelEntries = Object.entries(levelCount).sort(([a], [b]) =>
    a === SIN_NIVEL ? 1 : b === SIN_NIVEL ? -1 : b.localeCompare(a)
  )

  // XP events in period
  const xpEvents = progreso.filter(e => e.created_at >= periodStart && e.xp_earned > 0)
  const totalXpAwarded = xpEvents.reduce((sum, e) => sum + e.xp_earned, 0)
  const quizAnswers = progreso.filter(e => e.event_type === 'quiz_answered' && e.created_at >= periodStart)
  const correctAnswers = progreso.filter(e => e.event_type === 'quiz_answered' && e.xp_earned > 0 && e.created_at >= periodStart)
  const accuracy = quizAnswers.length > 0 ? Math.round((correctAnswers.length / quizAnswers.length) * 100) : 0

  // Alumnos por cuenta, para la Warning Zone: borrar una cuenta se lleva a
  // todos sus alumnos por ON DELETE CASCADE (migracion 035).
  const alumnosPorCuentaMap = new Map<string, Learner[]>()
  allLearners.forEach(l => {
    const lista = alumnosPorCuentaMap.get(l.account_user_id)
    if (lista) lista.push(l)
    else alumnosPorCuentaMap.set(l.account_user_id, [l])
  })

  const gridCols = isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)'
  const grid3Cols = isDesktop ? 'repeat(3, 1fr)' : '1fr'

  return (
    <div style={{ maxWidth: isDesktop ? 1100 : '100%', margin: '0 auto', padding: isDesktop ? '32px 48px 80px' : '24px 16px 80px', fontFamily: 'var(--font-nunito)', color: '#e2d9f3' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1035', border: '1px solid #2D2048', cursor: 'pointer', color: '#a78bfa', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>
        <div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 20, fontWeight: 900, color: '#e2d9f3' }}>📊 Métricas</div>
          <div style={{ fontSize: 13, color: '#a78bfa' }}>Datos en tiempo real desde Supabase</div>
        </div>
      </div>

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            style={{
              padding: '8px 16px', borderRadius: 50, fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'var(--font-nunito)',
              background: period === p ? '#7c3aed' : '#1a1035',
              color: period === p ? 'white' : '#a78bfa',
              border: period === p ? 'none' : '1px solid #2D2048',
            }}
          >{PERIOD_LABELS[p]}</button>
        ))}
      </div>

      {/* Toggle de cuentas de prueba */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setIncluirPrueba(v => !v)}
          role="switch"
          aria-checked={incluirPrueba}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px', borderRadius: 50, cursor: 'pointer',
            fontFamily: 'var(--font-nunito)', fontSize: 14, fontWeight: 800,
            background: incluirPrueba ? 'rgba(251,191,36,0.12)' : '#1a1035',
            border: `1px solid ${incluirPrueba ? 'rgba(251,191,36,0.45)' : '#2D2048'}`,
            color: incluirPrueba ? '#fbbf24' : '#a78bfa',
          }}
        >
          <span style={{
            width: 34, height: 20, borderRadius: 50, flexShrink: 0,
            background: incluirPrueba ? '#fbbf24' : '#2D2048',
            position: 'relative', transition: 'background 0.15s ease',
          }}>
            <span style={{
              position: 'absolute', top: 3, left: incluirPrueba ? 17 : 3,
              width: 14, height: 14, borderRadius: '50%', background: '#0f0a1e',
              transition: 'left 0.15s ease',
            }} />
          </span>
          Incluir cuentas de prueba
        </button>
        <span style={{ fontSize: 13, color: incluirPrueba ? '#fbbf24' : '#6b5fa0' }}>
          {incluirPrueba
            ? `⚠️ Incluyendo ${cuentasDePrueba} cuenta${cuentasDePrueba === 1 ? '' : 's'} de prueba — estos números no son reales`
            : `${cuentasDePrueba} cuenta${cuentasDePrueba === 1 ? '' : 's'} de prueba excluida${cuentasDePrueba === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* MRR */}
      <SectionTitle>💰 Ingresos</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="MRR Total" value={`$${Math.round(mrr).toLocaleString('es-MX')}`} sub={`${activeSubs.length} suscriptores activos`} color="#10b981" />
        <StatCard label="MRR Estándar" value={`$${Math.round(mrrStandard).toLocaleString('es-MX')}`} sub={`${standardSubs.length} suscriptores`} color="#06b6d4" />
        <StatCard label="MRR Personalizado" value={`$${Math.round(mrrPersonalized).toLocaleString('es-MX')}`} sub={`${personalizedSubs.length} suscriptores`} color="#ec4899" />
        <StatCard label="Ingresos nuevos" value={`$${Math.round(newSubs.reduce((sum, s) => sum + s.price_mxn / 100, 0)).toLocaleString('es-MX')}`} sub={`${newSubs.length} nuevas · ${PERIOD_LABELS[period]}`} color="#fbbf24" />
      </div>

      {/* Subscriptions */}
      <SectionTitle>💳 Suscripciones</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="Activas total" value={activeSubs.length} color="#10b981" />
        <StatCard label="Por vencer (7 días)" value={expiringSoon.length} sub="Necesitan renovar pronto" color="#fbbf24" />
        <StatCard label="Canceladas" value={cancelledSubs.length} sub={PERIOD_LABELS[period]} color="#ef4444" />
        <StatCard label="Churn rate" value={`${activeSubs.length > 0 ? Math.round((cancelledSubs.length / activeSubs.length) * 100) : 0}%`} sub={PERIOD_LABELS[period]} color="#f87171" />
      </div>

      {/* Plan breakdown table */}
      <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Desglose por plan</div>
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Estándar activos', value: standardSubs.length, color: '#06b6d4' },
            { label: 'Personalizado activos', value: personalizedSubs.length, color: '#ec4899' },
            { label: 'Estándar cancelados', value: allSubscriptions.filter(s => s.status === 'cancelled' && s.plan === 'grade' && s.cancelled_at && s.cancelled_at >= periodStart).length, color: '#6b7280' },
            { label: 'Personalizado cancelados', value: allSubscriptions.filter(s => s.status === 'cancelled' && s.plan === 'ai_personalized' && s.cancelled_at && s.cancelled_at >= periodStart).length, color: '#6b7280' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: '12px', background: '#0f0a1e', borderRadius: 12 }}>
              <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 24, fontWeight: 900, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cuentas */}
      <SectionTitle>👥 Cuentas</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="Total cuentas" value={totalUsers} color="#7c3aed" />
        <StatCard label="Nuevas" value={newUsers} sub={PERIOD_LABELS[period]} color="#a78bfa" />
        <StatCard label="Marcados onboarding_done" value={`${conversionRate}%`} sub={`${onboardingDone} de ${totalUsers} · el flag, no la realidad`} color="#fbbf24" />
        <StatCard
          label="Cuentas con ≥1 alumno activo (7d)"
          value={cuentasActivas}
          sub={totalUsers > 0 ? `${Math.round((cuentasActivas / totalUsers) * 100)}% de las cuentas` : 'Sin cuentas'}
          color="#10b981"
        />
      </div>

      {/* Alumnos */}
      <SectionTitle>🎒 Alumnos</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard
          label="Total alumnos"
          value={totalAlumnos}
          sub={alumnosDadosDeBaja > 0 ? `+${alumnosDadosDeBaja} sin acceso vigente` : 'Con acceso vigente'}
          color="#7c3aed"
        />
        <StatCard label="Alumnos por cuenta" value={alumnosPorCuenta} sub="Asientos ocupados" color="#a78bfa" />
        <StatCard label="Alumnos activos (7d)" value={alumnosActivos} sub="Con eventos de progreso" color="#10b981" />
        <StatCard
          label="% alumnos activos"
          value={`${totalAlumnos > 0 ? Math.round((alumnosActivos / totalAlumnos) * 100) : 0}%`}
          sub={`${alumnosActivos} de ${totalAlumnos}`}
          color="#06b6d4"
        />
        <StatCard
          label="Onboarding completo"
          value={`${onboardingRealPct}%`}
          sub={`${alumnosCompletos.length} de ${totalAlumnos} · nivel + grado + ≥1 materia`}
          color="#10b981"
        />
        <StatCard
          label="Brecha del alta"
          value={brechaAlta}
          sub={brechaAlta > 0 ? '⚠️ marcadas como listas, sin datos' : 'flag y datos coinciden'}
          color={brechaAlta > 0 ? '#ef4444' : '#6b7280'}
        />
      </div>

      {/* Education level distribution */}
      <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Distribución por nivel educativo</div>
        <div style={{ fontSize: 12, color: '#6b5fa0', marginBottom: 14 }}>por alumno</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {levelEntries.map(([level, count]) => {
            const pct = totalAlumnos > 0 ? Math.round((count / totalAlumnos) * 100) : 0
            const esSinNivel = level === SIN_NIVEL
            return (
              <div key={level}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: esSinNivel ? '#fbbf24' : '#e2d9f3', fontWeight: 600 }}>{LEVEL_LABELS[level] ?? level}</span>
                  <span style={{ fontSize: 14, color: esSinNivel ? '#fbbf24' : '#a78bfa', fontWeight: 700 }}>{count} ({pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#2D2048', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: esSinNivel ? '#fbbf24' : 'linear-gradient(90deg, #7c3aed, #ec4899)', borderRadius: 99 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Learning */}
      <SectionTitle>📚 Aprendizaje — por alumno</SectionTitle>
      <div style={{ fontSize: 12, color: '#6b5fa0', marginTop: -8, marginBottom: 14 }}>
        Estas cifras cuentan alumnos, no cuentas: dos hermanos que completan el mismo topic son 2.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 8 }}>
        <StatCard label="Topics completados" value={completedInPeriod.length} sub={`${PERIOD_LABELS[period]} · por alumno`} color="#10b981" />
        <StatCard label="Quizzes perfectos" value={perfectQuizzes.length} sub="Score 100% · por alumno" color="#fbbf24" />
        <StatCard label="Precisión quiz" value={`${accuracy}%`} sub={`${correctAnswers.length}/${quizAnswers.length} correctas`} color="#06b6d4" />
        <StatCard label="XP otorgado" value={totalXpAwarded.toLocaleString('es-MX')} sub={PERIOD_LABELS[period]} color="#a78bfa" />
      </div>

      {/* Top topics + themes */}
      <div style={{ display: 'grid', gridTemplateColumns: grid3Cols, gap: 16, marginTop: 8 }}>

        {/* Top topics */}
        <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px', gridColumn: isDesktop ? 'span 2' : 'span 1' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>🏆 Topics más completados</div>
          <div style={{ fontSize: 12, color: '#6b5fa0', marginBottom: 12 }}>alumnos que lo completaron</div>
          {topTopics.length === 0 ? (
            <div style={{ color: '#6b5fa0', fontSize: 14 }}>Sin datos aún</div>
          ) : topTopics.map((t, i) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topTopics.length - 1 ? '1px solid rgba(124,58,237,0.1)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: '#7c3aed', width: 24, textAlign: 'center' }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2d9f3' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#a78bfa' }}>{t.subject}</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 50, padding: '2px 10px', fontSize: 13, fontWeight: 800, color: '#10b981' }}>{t.count}</div>
            </div>
          ))}
        </div>

        {/* Top themes */}
        <div style={{ background: '#1a1035', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>🎮 Temáticas populares</div>
          <div style={{ fontSize: 12, color: '#6b5fa0', marginBottom: 12 }}>alumnos por temática</div>
          {topThemes.length === 0 ? (
            <div style={{ color: '#6b5fa0', fontSize: 14 }}>Sin datos aún</div>
          ) : topThemes.map((t, i) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topThemes.length - 1 ? '1px solid rgba(124,58,237,0.1)' : 'none' }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#e2d9f3' }}>{t.name}</div>
              <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 50, padding: '2px 10px', fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{t.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning Zone */}
      <div style={{ marginTop: 40 }}>
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 16, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 14, fontWeight: 900, color: '#ef4444', letterSpacing: 1 }}>
              WARNING ZONE
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 20, lineHeight: 1.6 }}>
            Eliminar una cuenta borra permanentemente todo su contenido — <strong>todos sus alumnos</strong>, suscripciones, progreso, secciones personalizadas y datos de autenticación. Esta acción no se puede deshacer.
            <br />
            La lista muestra <strong>todas</strong> las cuentas, incluidas las de prueba, independientemente del filtro de arriba: es la herramienta para borrarlas.
          </div>

          {deleteSuccess && (
            <div style={{
              padding: '10px 14px', background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10,
              color: '#10b981', fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>
              ✓ {deleteSuccess}
            </div>
          )}

          {deleteError && (
            <div style={{
              padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
              color: '#fca5a5', fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => {
              // 🔴 Se pinta a quién te llevas por delante. El FK de learners
              // hacia users es ON DELETE CASCADE (migracion 035), asi que
              // borrar la cuenta borra a TODOS sus alumnos y su progreso.
              // Antes aqui salia `users.education_level`, una columna que
              // dejo de reflejar la realidad en la 035.
              const susAlumnos = alumnosPorCuentaMap.get(u.id) ?? []
              return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: '#1a1035',
                border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2d9f3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email ?? u.id}
                    {u.is_test && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 900, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24', borderRadius: 50, padding: '2px 7px', letterSpacing: 0.5 }}>
                        PRUEBA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: susAlumnos.length > 0 ? '#fca5a5' : '#6b5fa0', marginTop: 3 }}>
                    {susAlumnos.length === 0
                      ? '⚠️ sin alumnos'
                      : `🎒 se llevará ${susAlumnos.length} alumno${susAlumnos.length === 1 ? '' : 's'}: ${susAlumnos
                          .slice()
                          .sort((a, b) => a.slot - b.slot)
                          .map(l => `${l.display_name} (slot ${l.slot})`)
                          .join(' · ')}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>
                    {u.onboarding_done ? 'onboarding ✓' : 'sin onboarding'} · creado {new Date(u.created_at).toLocaleDateString('es-MX')}
                  </div>
                  <div style={{ fontSize: 11, color: '#4B3D6E', marginTop: 1, fontFamily: 'monospace' }}>
                    {u.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteUserId(u.id)
                    setConfirmDeleteEmail(u.id)
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', borderRadius: 8, padding: '6px 12px',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    fontFamily: 'var(--font-nunito)', flexShrink: 0,
                  }}
                >
                  🗑️ Eliminar
                </button>
              </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDeleteUserId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,10,30,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#1a1035', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 16, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>
              ¿Eliminar cuenta?
            </div>
            <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 8, lineHeight: 1.6 }}>
              UUID: <span style={{ fontFamily: 'monospace', color: '#e2d9f3' }}>{confirmDeleteUserId}</span>
            </div>
            {(() => {
              const susAlumnos = alumnosPorCuentaMap.get(confirmDeleteUserId) ?? []
              if (susAlumnos.length === 0) return null
              return (
                <div style={{
                  fontSize: 13, color: '#fca5a5', marginBottom: 12, lineHeight: 1.6,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, padding: '10px 14px', textAlign: 'left',
                }}>
                  Se llevará por delante {susAlumnos.length} alumno{susAlumnos.length === 1 ? '' : 's'}:
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {susAlumnos.slice().sort((a, b) => a.slot - b.slot).map(l => (
                      <li key={l.id} style={{ color: '#e2d9f3' }}>
                        {l.display_name} <span style={{ color: '#a78bfa' }}>(slot {l.slot}{l.is_primary ? ' · primario' : ''})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}
            <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 24, lineHeight: 1.6 }}>
              Se borrará todo — alumnos, suscripciones, progreso, secciones personalizadas y cuenta de autenticación. No hay vuelta atrás.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { setConfirmDeleteUserId(null); setConfirmDeleteEmail('') }}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid #2D2048',
                  color: '#a78bfa', borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-nunito)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(confirmDeleteUserId)}
                disabled={deletingUserId !== null}
                style={{
                  background: '#ef4444', color: 'white', borderRadius: 12,
                  padding: '10px 20px', fontWeight: 800, border: 'none',
                  cursor: deletingUserId ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontFamily: 'var(--font-nunito)',
                  opacity: deletingUserId ? 0.7 : 1,
                }}
              >
                {deletingUserId ? 'Eliminando...' : 'Sí, eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}
