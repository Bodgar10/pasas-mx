import ComoSeLee from '@/components/admin/ComoSeLee'
import { StatCard, SectionTitle, Panel, Barra, Nota, Vacio, COLORES, GRID_4, GRID_2 } from '@/components/admin/Tarjetas'
import { servicio, ventanas, idsVigentes, pct, dias } from '../_lib/datos'
import { tieneAccesoVigente } from '@/lib/learners'

const SIN_NIVEL = '__sin_nivel__'
/** El enum tiene EXACTAMENTE dos valores (001_initial_schema.sql:49). */
const NIVELES: Record<string, string> = {
  middle_school: '📚 Secundaria',
  high_school: '🎓 Preparatoria',
  [SIN_NIVEL]: '⚠️ Sin nivel',
}

export default async function Aprendizaje({ incluirPrueba }: { incluirPrueba: boolean }) {
  const db = servicio()
  const v = ventanas()

  const { alumnos, totalCuentas } = await idsVigentes(incluirPrueba)
  const ids = new Set(alumnos.map((l) => l.id))
  const vigentes = alumnos.filter(tieneAccesoVigente)

  const [{ data: progreso }, { data: avance }, { data: materias }] = await Promise.all([
    // Solo la ventana que se usa: 7 días para actividad, 30 para XP.
    db.from('progress').select('learner_id, event_type, xp_earned, created_at').gte('created_at', v.d30).limit(20000),
    db.from('topic_progress').select('learner_id, status, best_score, completed_at').limit(20000),
    db.from('user_subjects').select('learner_id, subject_id').limit(20000),
  ])

  const mios = (progreso ?? []).filter((p) => p.learner_id && ids.has(p.learner_id))
  const avanceMio = (avance ?? []).filter((a) => a.learner_id && ids.has(a.learner_id))
  const materiasMias = (materias ?? []).filter((m) => m.learner_id && ids.has(m.learner_id))

  // ── Actividad ──────────────────────────────────────────────────────
  const idsVig = new Set(vigentes.map((l) => l.id))
  const activos = new Set(mios.filter((p) => p.created_at >= v.d7).map((p) => p.learner_id as string).filter((id) => idsVig.has(id)))
  const cuentaDe = new Map(alumnos.map((l) => [l.id, l.account_user_id]))
  const cuentasActivas = new Set([...activos].map((id) => cuentaDe.get(id)).filter(Boolean)).size

  // ── Onboarding real y brecha ───────────────────────────────────────
  const conMateria = new Set(materiasMias.map((m) => m.learner_id as string))
  const completo = (l: (typeof alumnos)[number]) => l.education_level !== null && l.grade !== null && conMateria.has(l.id)
  const completos = vigentes.filter(completo)

  // ── Distribución por nivel ─────────────────────────────────────────
  const porNivel = new Map<string, number>()
  for (const l of vigentes) {
    const k = l.education_level ?? SIN_NIVEL
    porNivel.set(k, (porNivel.get(k) ?? 0) + 1)
  }
  const nivelOrden = [...porNivel.entries()].sort(([a], [b]) => (a === SIN_NIVEL ? 1 : b === SIN_NIVEL ? -1 : b.localeCompare(a)))

  // ── Aprendizaje ────────────────────────────────────────────────────
  const completados = avanceMio.filter((a) => a.status === 'completed')
  const perfectos = completados.filter((a) => a.best_score === 100)
  const quizzes = mios.filter((p) => p.event_type === 'quiz_answered')
  const correctas = quizzes.filter((p) => (p.xp_earned ?? 0) > 0)
  const xp = mios.reduce((t, p) => t + (p.xp_earned ?? 0), 0)

  // ── Rachas (max_streak_days, migración 048) ────────────────────────
  const conRacha = vigentes.filter((l) => (l.streak_days ?? 0) > 0)
  const rachaMax = vigentes.reduce((m, l) => Math.max(m, l.max_streak_days ?? 0), 0)

  // ── Activación (migración 048) ─────────────────────────────────────
  const conSesion = vigentes.filter((l) => l.first_session_at)
  const activados = vigentes.filter((l) => l.activated_at)
  const horas = activados
    .map((l) => {
      const d = dias(l.first_session_at, l.activated_at)
      return d === null ? null : d * 24
    })
    .filter((h): h is number => h !== null)
  const en48h = activados.filter((l) => {
    const d = dias(l.first_session_at, l.activated_at)
    return d !== null && d <= 2
  }).length

  // ── Materias distintas por alumno ──────────────────────────────────
  const porAlumno = new Map<string, Set<string>>()
  for (const m of materiasMias) {
    const s = porAlumno.get(m.learner_id as string) ?? new Set<string>()
    s.add(m.subject_id as string)
    porAlumno.set(m.learner_id as string, s)
  }
  const mediaMaterias = porAlumno.size > 0 ? [...porAlumno.values()].reduce((t, s) => t + s.size, 0) / porAlumno.size : 0

  return (
    <>
      <SectionTitle sub="Todo desde `learners`. Las columnas de `users` quedaron legacy en la migración 035.">
        🎒 Alumnos
      </SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Alumnos con acceso" value={vigentes.length} sub={`${(vigentes.length / Math.max(totalCuentas, 1)).toFixed(1)} por cuenta`} color={COLORES.primario} />
        <StatCard label="Activos (7d)" value={activos.size} sub={`${pct(activos.size, vigentes.length)}% del total`} color={COLORES.verde} />
        <StatCard label="Cuentas con ≥1 activo" value={cuentasActivas} sub={`de ${totalCuentas} cuentas`} color={COLORES.cian} />
        <StatCard label="Materias por alumno" value={mediaMaterias.toFixed(1)} sub="distintas, en promedio" color={COLORES.rosa} />
      </div>
      <Nota>
        🔴 <strong>Activo</strong> se mide con eventos de <code>progress</code>, no con
        <code> last_active_at</code>: esa columna solo la escribe <code>section-read</code>, así que un
        alumno que solo hace quizzes nunca la actualiza y saldría como inactivo.
      </Nota>

      <SectionTitle>Activación</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Con primera sesión" value={conSesion.length} sub={`${pct(conSesion.length, vigentes.length)}% empezó`} color={COLORES.suave} />
        <StatCard label="Activados" value={activados.length} sub="abrió tema y completó quiz" color={COLORES.verde} />
        <StatCard label="Activados en 48h" value={en48h} sub={`${pct(en48h, activados.length)}% de los activados`} color={COLORES.cian} />
        <StatCard
          label="Horas a activación"
          value={horas.length > 0 ? Math.round(horas.reduce((a, b) => a + b, 0) / horas.length) : '—'}
          sub="promedio"
          color={COLORES.ambar}
        />
      </div>
      <Nota>
        Las columnas <code>first_session_at</code> y <code>activated_at</code> se estrenaron en s37 y
        <strong> no se backfillearon</strong>: los alumnos anteriores salen en blanco. No es una caída.
      </Nota>
      <ComoSeLee id="activacion" />

      <SectionTitle>Onboarding</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Onboarding completo" value={`${pct(completos.length, vigentes.length)}%`} sub={`${completos.length} de ${vigentes.length} · nivel + grado + ≥1 materia`} color={COLORES.verde} />
        <StatCard
          label="Brecha del alta"
          value={vigentes.length - completos.length}
          sub={vigentes.length - completos.length > 0 ? '⚠️ sin datos completos' : 'todos completos'}
          color={vigentes.length - completos.length > 0 ? COLORES.rojo : COLORES.tenue}
        />
        <StatCard label="Con racha viva" value={conRacha.length} sub={`${pct(conRacha.length, vigentes.length)}% del total`} color={COLORES.ambar} />
        <StatCard label="Racha máxima" value={`${rachaMax} d`} sub="récord histórico" color={COLORES.rosa} />
      </div>
      <ComoSeLee id="rachasRotas" />

      <div style={GRID_2}>
        <Panel titulo="Distribución por nivel educativo" sub="por alumno">
          {nivelOrden.length === 0 ? <Vacio>Sin alumnos</Vacio> : nivelOrden.map(([n, c]) => (
            <Barra key={n} etiqueta={NIVELES[n] ?? n} valor={c} total={vigentes.length} color={n === SIN_NIVEL ? COLORES.ambar : COLORES.primario} />
          ))}
        </Panel>

        <Panel titulo="Aprendizaje · últimos 30 días" sub="Estas cifras cuentan alumnos, no cuentas">
          <div style={{ display: 'grid', gap: 10 }}>
            <Fila etiqueta="Topics completados" valor={completados.length} />
            <Fila etiqueta="Quizzes perfectos" valor={perfectos.length} />
            <Fila etiqueta="Precisión de quiz" valor={`${pct(correctas.length, quizzes.length)}%`} sub={`${correctas.length}/${quizzes.length}`} />
            <Fila etiqueta="XP otorgado" valor={xp.toLocaleString('es-MX')} />
          </div>
        </Panel>
      </div>

      <SectionTitle>Lo que PostHog hace mejor</SectionTitle>
      <Panel titulo="Retención conductual y cohortes">
        <Vacio>D1/D7/D30, lifecycle y stickiness se calculan sobre eventos, no sobre filas.</Vacio>
        <ComoSeLee id="retencionTema" />
        <ComoSeLee id="lifecycle" />
      </Panel>
    </>
  )
}

function Fila({ etiqueta, valor, sub }: { etiqueta: string; valor: string | number; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 14, color: COLORES.texto }}>{etiqueta}</span>
      <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: 18, fontWeight: 900, color: COLORES.suave }}>
        {valor}
        {sub && <span style={{ fontSize: 11, color: COLORES.tenue, marginLeft: 6, fontFamily: 'var(--font-nunito)' }}>{sub}</span>}
      </span>
    </div>
  )
}
