import ComoSeLee from '@/components/admin/ComoSeLee'
import { StatCard, SectionTitle, Panel, Barra, Nota, Vacio, COLORES, GRID_4, GRID_2 } from '@/components/admin/Tarjetas'
import { servicio, ventanas, dias, pct, TOPE } from '../_lib/datos'

const MOTIVOS: Record<string, string> = {
  precio: '💸 Precio muy alto',
  no_la_uso: '😴 No la uso',
  mi_hijo_no_quiso: '🧒 Mi hijo no quiso',
  encontre_algo_mejor: '🔄 Encontré algo mejor',
  falla_tecnica: '🐛 Falla técnica',
  vacaciones: '🏖️ Vacaciones',
  otro: '💬 Otro',
}

type Sub = {
  status: string
  plan: string
  billing_cycle: string | null
  current_period_start: string | null
  current_period_end: string
  cancelled_at: string | null
  paused_at: string | null
  paused_until: string | null
  user_id: string
}

export default async function Suscripciones({ incluirPrueba }: { incluirPrueba: boolean }) {
  const db = servicio()
  const v = ventanas()

  const qSubs = db
    .from('subscriptions')
    .select('status, plan, billing_cycle, current_period_start, current_period_end, cancelled_at, paused_at, paused_until, user_id')
    .limit(TOPE)

  const [{ data: dataSubs }, { data: motivos }, { count: asientos }] = await Promise.all([
    incluirPrueba ? qSubs : qSubs.eq('is_test', false),
    // Agregado, no detalle: los textos libres se leen en /admin/insights.
    db.from('cancellation_reasons').select('reason_category, pause_offered, pause_accepted').limit(TOPE),
    db.from('learners').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('is_primary', false),
  ])

  const subs = (dataSubs ?? []) as Sub[]
  const activas = subs.filter((s) => s.status === 'active' && s.current_period_end > v.ahoraIso)
  const trialing = subs.filter((s) => s.status === 'trialing')
  const porVencer = activas.filter((s) => dias(v.ahoraIso, s.current_period_end) !== null && dias(v.ahoraIso, s.current_period_end)! <= 7)
  const canceladas30 = subs.filter((s) => s.cancelled_at && s.cancelled_at >= v.d30)
  const pausadas = subs.filter((s) => s.status === 'paused')
  const reactivadas = subs.filter((s) => s.paused_at && s.status === 'active')

  // Histograma del día del ciclo en que cancelan.
  const bandas = [
    { etiqueta: 'Días 0-3 · arrepentimiento', min: 0, max: 3, color: COLORES.rojo },
    { etiqueta: 'Días 4-10', min: 4, max: 10, color: COLORES.ambar },
    { etiqueta: 'Días 11-20', min: 11, max: 20, color: COLORES.suave },
    { etiqueta: 'Día 21+ · decisión', min: 21, max: 9999, color: COLORES.cian },
  ]
  const conDia = subs
    .filter((s) => s.cancelled_at && s.current_period_start)
    .map((s) => dias(s.current_period_start, s.cancelled_at))
    .filter((d): d is number => d !== null)

  const porCiclo = new Map<string, number>()
  for (const s of activas) porCiclo.set(s.billing_cycle ?? 'monthly', (porCiclo.get(s.billing_cycle ?? 'monthly') ?? 0) + 1)

  const conteoMotivos = new Map<string, number>()
  for (const m of motivos ?? []) conteoMotivos.set(m.reason_category, (conteoMotivos.get(m.reason_category) ?? 0) + 1)
  const totalMotivos = (motivos ?? []).length
  const pausaAceptada = (motivos ?? []).filter((m) => m.pause_accepted).length
  const pausaOfrecida = (motivos ?? []).filter((m) => m.pause_offered).length

  return (
    <>
      <SectionTitle>📊 Estado de la cartera</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Activas" value={activas.length} color={COLORES.verde} />
        <StatCard label="En trial" value={trialing.length} sub="sin cobro todavía" color={COLORES.ambar} />
        <StatCard label="Por vencer (7d)" value={porVencer.length} sub="renuevan pronto" color={COLORES.cian} />
        <StatCard label="Canceladas 30d" value={canceladas30.length} sub={`churn ${pct(canceladas30.length, activas.length + canceladas30.length)}%`} color={COLORES.rojo} />
      </div>

      <SectionTitle>Cancelación</SectionTitle>
      <div style={GRID_2}>
        <Panel titulo="Día del ciclo en que cancelan" sub="Cuándo pulsaron el botón, no cuándo pierden el acceso">
          {conDia.length === 0 ? (
            <Vacio>Sin cancelaciones con periodo registrado</Vacio>
          ) : (
            bandas.map((b) => (
              <Barra key={b.etiqueta} etiqueta={b.etiqueta} valor={conDia.filter((d) => d >= b.min && d <= b.max).length} total={conDia.length} color={b.color} />
            ))
          )}
          <Nota>
            Pico temprano = <strong>arrepentimiento</strong>, se arregla en landing y onboarding.
            Pico tardío = <strong>decisión</strong>, se arregla en el producto. Dos problemas distintos.
          </Nota>
          <ComoSeLee id="cancelacionDiaCiclo" />
        </Panel>

        <Panel titulo="Motivos de cancelación" sub={`${totalMotivos} respuestas`}>
          {totalMotivos === 0 ? (
            <Vacio>Sin respuestas todavía</Vacio>
          ) : (
            [...conteoMotivos.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => (
              <Barra key={m} etiqueta={MOTIVOS[m] ?? m} valor={n} total={totalMotivos} color={COLORES.rojo} />
            ))
          )}
          <Nota>
            🔴 <strong>Los datos empiezan en s38.</strong> Hasta ese arreglo, el cliente mandaba los campos
            con otro nombre y el endpoint devolvía 400 sin guardar nada: <code>cancellation_reasons</code>
            estuvo vacía. Una distribución casi vacía aquí <strong>no es un bug del tablero</strong>.
            Los textos libres se leen en <code>/admin/insights</code>.
          </Nota>
        </Panel>
      </div>

      <SectionTitle>Pausa y retención</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Pausas activas" value={pausadas.length} color={COLORES.ambar} />
        <StatCard label="Reactivadas" value={reactivadas.length} sub="volvieron tras pausar" color={COLORES.verde} />
        <StatCard label="Pausa aceptada" value={pausaAceptada} sub={`de ${pausaOfrecida} ofrecidas`} color={COLORES.cian} />
        <StatCard label="Asientos ocupados" value={asientos ?? 0} sub="alumnos adicionales activos" color={COLORES.primario} />
      </div>

      <SectionTitle>Mix por ciclo</SectionTitle>
      <Panel titulo="Suscripciones activas por ciclo de cobro">
        {porCiclo.size === 0 ? <Vacio>Sin suscripciones activas</Vacio> : [...porCiclo.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => (
          <Barra key={c} etiqueta={c === 'monthly' ? 'Mensual' : c === 'semestral' ? 'Semestral' : 'Anual'} valor={n} total={activas.length} color={COLORES.primario} />
        ))}
      </Panel>
    </>
  )
}
