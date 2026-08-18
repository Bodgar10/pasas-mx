import ComoSeLee from '@/components/admin/ComoSeLee'
import { StatCard, SectionTitle, Panel, Nota, Vacio, FilaRanking, COLORES, GRID_4, GRID_2 } from '@/components/admin/Tarjetas'
import { servicio, idsVigentes, TOPE } from '../_lib/datos'

const TEMAS_NOMBRE: Record<string, string> = {
  '8675082b-df0f-4599-b566-38fa13753120': '🎮 Videojuegos',
  '16b89743-e0d7-4fdb-81d6-cf23184d080f': '🎤 K-pop & K-dramas',
  '00ef7bf7-5fce-4dbe-9171-4bd413e59753': '⚽ Fútbol',
  '8c348606-4ea8-4914-83dd-47b8d039e5d1': '⚔️ Anime & Manga',
}

export default async function Contenido({ incluirPrueba }: { incluirPrueba: boolean }) {
  const db = servicio()
  const { alumnos } = await idsVigentes(incluirPrueba)
  const ids = new Set(alumnos.map((l) => l.id))

  const [{ data: avance }, { data: temas }, { data: materias }, { data: subjects }, { data: solicitudes }] =
    await Promise.all([
      db.from('topic_progress').select('learner_id, topic_id, status').eq('status', 'completed').limit(TOPE),
      db.from('topics').select('id, name, subject_id, published').limit(TOPE),
      db.from('user_subjects').select('learner_id, theme_id').limit(TOPE),
      db.from('subjects').select('id, name').limit(TOPE),
      db.from('topic_requests').select('subject_name, description, created_at').order('created_at', { ascending: false }).limit(200),
    ])

  const nombreSubject = new Map((subjects ?? []).map((s) => [s.id as string, s.name as string]))
  const infoTema = new Map((temas ?? []).map((t) => [t.id as string, t]))

  // ── Temas más completados ──────────────────────────────────────────
  const completados = (avance ?? []).filter((a) => a.learner_id && ids.has(a.learner_id))
  const porTema = new Map<string, number>()
  for (const a of completados) porTema.set(a.topic_id as string, (porTema.get(a.topic_id as string) ?? 0) + 1)
  const top = [...porTema.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

  // ── Contenido con cero aperturas ───────────────────────────────────
  const publicados = (temas ?? []).filter((t) => t.published)
  const sinTocar = publicados.filter((t) => !porTema.has(t.id as string))

  // ── Temáticas: DOS unidades ────────────────────────────────────────
  const misMaterias = (materias ?? []).filter((m) => m.learner_id && ids.has(m.learner_id))
  const alumnosPorTema = new Map<string, Set<string>>()
  const filasPorTema = new Map<string, number>()
  for (const m of misMaterias) {
    if (!m.theme_id) continue
    filasPorTema.set(m.theme_id as string, (filasPorTema.get(m.theme_id as string) ?? 0) + 1)
    const s = alumnosPorTema.get(m.theme_id as string) ?? new Set<string>()
    s.add(m.learner_id as string)
    alumnosPorTema.set(m.theme_id as string, s)
  }
  const tematicas = [...filasPorTema.entries()]
    .map(([id, filas]) => ({ id, filas, alumnos: alumnosPorTema.get(id)?.size ?? 0 }))
    .sort((a, b) => b.alumnos - a.alumnos || b.filas - a.filas)

  // ── Solicitudes ────────────────────────────────────────────────────
  const porMateria = new Map<string, { total: number; conTexto: number }>()
  for (const s of solicitudes ?? []) {
    const k = (s.subject_name as string) ?? '—'
    const p = porMateria.get(k) ?? { total: 0, conTexto: 0 }
    p.total += 1
    if (s.description) p.conTexto += 1
    porMateria.set(k, p)
  }

  return (
    <>
      <SectionTitle>🧪 Catálogo</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Temas publicados" value={publicados.length} color={COLORES.primario} />
        <StatCard label="Con al menos una compleción" value={porTema.size} color={COLORES.verde} />
        <StatCard label="Sin abrir nunca" value={sinTocar.length} sub={`${publicados.length > 0 ? Math.round((sinTocar.length / publicados.length) * 100) : 0}% del catálogo`} color={sinTocar.length > 0 ? COLORES.ambar : COLORES.tenue} />
        <StatCard label="Solicitudes de tema" value={(solicitudes ?? []).length} color={COLORES.rosa} />
      </div>

      <div style={GRID_2}>
        <Panel titulo="🏆 Temas más completados" sub="alumnos que lo completaron">
          {top.length === 0 ? <Vacio>Sin datos aún</Vacio> : top.map(([id, n], i) => {
            const t = infoTema.get(id)
            return (
              <FilaRanking
                key={id}
                posicion={i + 1}
                nombre={(t?.name as string) ?? 'Desconocido'}
                sub={nombreSubject.get(t?.subject_id as string) ?? ''}
                valor={n}
                ultima={i === top.length - 1}
              />
            )
          })}
          <ComoSeLee id="temasAbiertos" />
        </Panel>

        <Panel titulo="🎮 Temáticas populares" sub="ordenado por alumnos distintos">
          {tematicas.length === 0 ? <Vacio>Sin datos aún</Vacio> : tematicas.map((t, i) => (
            <FilaRanking
              key={t.id}
              nombre={TEMAS_NOMBRE[t.id] ?? t.id}
              valor={`${t.alumnos} alumnos`}
              valorSecundario={`${t.filas} materias`}
              ultima={i === tematicas.length - 1}
              color={COLORES.suave}
            />
          ))}
          <Nota>
            Una fila de <code>user_subjects</code> es (alumno × materia). Por eso hay dos cifras: un
            alumno con 8 materias en K-pop aporta <strong>1 alumno y 8 materias</strong>.
          </Nota>
        </Panel>
      </div>

      <SectionTitle>Huecos del catálogo</SectionTitle>
      <div style={GRID_2}>
        <Panel titulo="Temas publicados que nadie ha completado" sub={`${sinTocar.length} de ${publicados.length}`}>
          {sinTocar.length === 0 ? (
            <Vacio>Todos los temas publicados tienen al menos una compleción</Vacio>
          ) : (
            sinTocar.slice(0, 15).map((t, i, arr) => (
              <FilaRanking
                key={t.id as string}
                nombre={t.name as string}
                sub={nombreSubject.get(t.subject_id as string) ?? ''}
                valor="0"
                ultima={i === arr.length - 1}
                color={COLORES.ambar}
              />
            ))
          )}
          {sinTocar.length > 15 && <Nota>Mostrando 15 de {sinTocar.length}.</Nota>}
        </Panel>

        <Panel titulo="📩 Solicitudes por materia" sub="Demanda declarada: la señal más directa que hay">
          {porMateria.size === 0 ? <Vacio>Sin solicitudes</Vacio> : [...porMateria.entries()].sort((a, b) => b[1].total - a[1].total).map(([m, p], i, arr) => (
            <FilaRanking key={m} nombre={m} valor={p.total} valorSecundario={`${p.conTexto} con detalle`} ultima={i === arr.length - 1} color={COLORES.rosa} />
          ))}
          <Nota>Los textos libres se leen en <code>/admin/notificaciones</code>.</Nota>
          <ComoSeLee id="solicitudesTema" />
        </Panel>
      </div>

      <SectionTitle>Lo que PostHog hace mejor</SectionTitle>
      <Panel titulo="Fricción dentro del contenido">
        <Vacio>Interactivos abandonados y sorts fallidos salen de eventos, no de filas.</Vacio>
        <ComoSeLee id="interactivosAbandonados" />
        <ComoSeLee id="sortsFallidos" />
      </Panel>
    </>
  )
}
