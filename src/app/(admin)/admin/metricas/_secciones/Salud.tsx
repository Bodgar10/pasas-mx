import ComoSeLee from '@/components/admin/ComoSeLee'
import { StatCard, SectionTitle, Panel, Nota, Vacio, FilaRanking, COLORES, GRID_4 } from '@/components/admin/Tarjetas'
import { servicio, ventanas, TOPE } from '../_lib/datos'

type CronRun = { cron: string; started_at: string; finished_at: string | null; rows_processed: number | null; error: string | null }

export default async function Salud() {
  const db = servicio()
  const v = ventanas()

  /**
   * 🔴 `cron_runs` puede NO EXISTIR todavía: la tabla se crea con el SQL de
   * este prompt, y quien escribe en ella son los crons, que es otro prompt.
   * Si la consulta falla, la pestaña lo dice en vez de reventar.
   */
  let corridas: CronRun[] | null = null
  let cronRunsExiste = true
  try {
    const { data, error } = await db
      .from('cron_runs')
      .select('cron, started_at, finished_at, rows_processed, error')
      .order('started_at', { ascending: false })
      .limit(50)
    if (error) cronRunsExiste = false
    else corridas = (data ?? []) as CronRun[]
  } catch {
    cronRunsExiste = false
  }

  const [{ count: sandboxActivas }, { count: sinAlumno }, { data: pausadasVencidas }] = await Promise.all([
    // Filas de sandbox que siguen en 'active': is_test true pero cobrando.
    db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('is_test', true).eq('status', 'active'),
    // Cuentas marcadas como listas que no tienen ni un alumno: el fallo del
    // alta que documenta registro/actions.ts.
    db.from('users').select('id', { count: 'exact', head: true }).eq('is_test', false).eq('onboarding_done', true),
    // Pausas que ya vencieron y siguen en 'paused': el cron no las recogió.
    db.from('subscriptions').select('id, paused_until, user_id').eq('status', 'paused').lt('paused_until', v.ahoraIso).limit(50),
  ])

  const ultimaDe = (cron: string) => corridas?.find((c) => c.cron === cron)
  const CRONS = ['profeco-renewal-notice', 'pauses-ending'] as const

  const pausasColgadas = pausadasVencidas ?? []

  return (
    <>
      <SectionTitle>🩺 Integridad de datos</SectionTitle>
      <div style={GRID_4}>
        <StatCard
          label="Sandbox en 'active'"
          value={sandboxActivas ?? 0}
          sub={(sandboxActivas ?? 0) > 0 ? '⚠️ marcadas is_test y activas' : 'ninguna'}
          color={(sandboxActivas ?? 0) > 0 ? COLORES.ambar : COLORES.tenue}
        />
        <StatCard
          label="Pausas vencidas sin reactivar"
          value={pausasColgadas.length}
          sub={pausasColgadas.length > 0 ? '⚠️ el cron no las recogió' : 'ninguna'}
          color={pausasColgadas.length > 0 ? COLORES.rojo : COLORES.tenue}
        />
        <StatCard label="Cuentas con onboarding_done" value={sinAlumno ?? 0} sub="ver brecha del alta en Aprendizaje" color={COLORES.suave} />
        <StatCard label="Crons registrados" value={cronRunsExiste ? new Set((corridas ?? []).map((c) => c.cron)).size : '—'} color={COLORES.cian} />
      </div>

      <SectionTitle>Última corrida de cada cron</SectionTitle>
      <Panel titulo="cron_runs">
        {!cronRunsExiste ? (
          <>
            <Vacio>Sin registro todavía.</Vacio>
            <Nota color={COLORES.rojo}>
              La tabla <code>cron_runs</code> no existe aún. El SQL está en el reporte de este prompt.
              🔴 Escribir en ella <strong>desde los crons es otro trabajo</strong>: hasta entonces,
              un cron que corre y no encuentra a nadie sigue siendo indistinguible de uno que no corre.
            </Nota>
          </>
        ) : (
          CRONS.map((nombre, i) => {
            const u = ultimaDe(nombre)
            return (
              <FilaRanking
                key={nombre}
                nombre={nombre}
                sub={u ? `${u.rows_processed ?? 0} filas${u.error ? ` · ⚠️ ${u.error}` : ''}` : 'sin registro todavía'}
                valor={u ? new Date(u.started_at).toLocaleString('es-MX') : '—'}
                ultima={i === CRONS.length - 1}
                color={u ? (u.error ? COLORES.rojo : COLORES.verde) : COLORES.tenue}
              />
            )
          })
        )}
      </Panel>

      {pausasColgadas.length > 0 && (
        <Panel titulo="⚠️ Pausas vencidas sin reactivar" style={{ marginTop: 16 }}>
          {pausasColgadas.map((p, i) => (
            <FilaRanking
              key={p.id as string}
              nombre={p.user_id as string}
              sub={`venció ${new Date(p.paused_until as string).toLocaleDateString('es-MX')}`}
              valor="paused"
              ultima={i === pausasColgadas.length - 1}
              color={COLORES.rojo}
            />
          ))}
          <Nota color={COLORES.rojo}>
            El cron <code>pauses-ending</code> busca en una ventana de un día. Si no corrió ese día
            concreto, estas filas se quedan pausadas para siempre: nadie las vuelve a mirar.
          </Nota>
        </Panel>
      )}

      <SectionTitle>Errores de aplicación</SectionTitle>
      <Panel titulo="No se consultan desde Supabase">
        <Vacio>
          Los <code>error_occurred</code> son eventos, no filas: viven en PostHog con su tipo, su ruta y
          la persona que lo sufrió.
        </Vacio>
        <ComoSeLee id="erroresPorTipo" />
        <ComoSeLee id="erroresPorRuta" />
        <ComoSeLee id="hordaErrores" />
        <Nota>
          🔴 <strong>Webhooks fallidos: fuera de alcance.</strong> El webhook de Stripe loguea con
          <code> console.error</code> a Vercel y no escribe en ninguna tabla, así que no es consultable
          desde aquí. Se ven en los logs de Vercel o en el panel de Stripe.
        </Nota>
      </Panel>
    </>
  )
}
