import ComoSeLee from '@/components/admin/ComoSeLee'
import { StatCard, SectionTitle, Panel, Barra, Nota, Vacio, COLORES, GRID_4, GRID_2 } from '@/components/admin/Tarjetas'
import { servicio, ventanas, pesos, aPesos, TOPE } from '../_lib/datos'

type Sub = {
  price_mxn: number | null
  plan: string
  status: string
  billing_cycle: string | null
  current_period_end: string
  created_at: string
  trial_ends_at: string | null
  user_id: string
  acquisition: Record<string, string> | null
}

export default async function Dinero({ incluirPrueba }: { incluirPrueba: boolean }) {
  const db = servicio()
  const v = ventanas()

  // SOLO `subscriptions`. Esta pestaña no necesita ninguna de las otras seis
  // tablas que traía la pantalla anterior.
  const q = db
    .from('subscriptions')
    .select('price_mxn, plan, status, billing_cycle, current_period_end, created_at, trial_ends_at, user_id, acquisition')
    .limit(TOPE)
  const { data } = await (incluirPrueba ? q : q.eq('is_test', false))
  const subs = (data ?? []) as Sub[]

  const activas = subs.filter((s) => s.status === 'active' && s.current_period_end > v.ahoraIso)
  const mrr = activas.reduce((t, s) => t + (s.price_mxn ?? 0), 0)
  const cuentas = new Set(activas.map((s) => s.user_id)).size

  const porPlan = new Map<string, number>()
  for (const s of activas) porPlan.set(s.plan, (porPlan.get(s.plan) ?? 0) + (s.price_mxn ?? 0))

  const porCiclo = new Map<string, number>()
  for (const s of activas) {
    const c = s.billing_cycle ?? 'monthly'
    porCiclo.set(c, (porCiclo.get(c) ?? 0) + (s.price_mxn ?? 0))
  }

  /**
   * Primer cobro vs recurrente.
   *
   * 🔴 NO HAY TABLA DE CARGOS: `subscriptions` tiene una fila por suscripción,
   * no una por cobro. "Recurrente" se deriva de si el periodo actual empezó
   * después del fin del trial. Es una estimación y así se rotula — un cobro
   * fallido y recuperado no se distingue.
   */
  const enTrial = activas.filter((s) => s.trial_ends_at && s.trial_ends_at > v.ahoraIso)
  const yaCobradas = activas.filter((s) => !s.trial_ends_at || s.trial_ends_at <= v.ahoraIso)
  const mrrTrial = enTrial.reduce((t, s) => t + (s.price_mxn ?? 0), 0)
  const mrrReal = yaCobradas.reduce((t, s) => t + (s.price_mxn ?? 0), 0)

  // Ingreso por canal — usa `subscriptions.acquisition` (migración 047).
  const porCanal = new Map<string, { mrr: number; n: number }>()
  for (const s of activas) {
    const canal = s.acquisition?.utm_source ?? '(sin utm)'
    const p = porCanal.get(canal) ?? { mrr: 0, n: 0 }
    p.mrr += s.price_mxn ?? 0
    p.n += 1
    porCanal.set(canal, p)
  }
  const canales = [...porCanal.entries()].sort((a, b) => b[1].mrr - a[1].mrr)

  const arpu = cuentas > 0 ? mrr / cuentas : 0

  return (
    <>
      <SectionTitle>💰 Ingreso recurrente</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="MRR total" value={pesos(mrr)} sub={`${activas.length} suscripciones`} color={COLORES.verde} />
        <StatCard label="ARPU" value={pesos(arpu)} sub="por cuenta activa" color={COLORES.cian} />
        <StatCard label="MRR ya cobrado" value={pesos(mrrReal)} sub={`${yaCobradas.length} fuera de trial`} color={COLORES.verde} />
        <StatCard label="MRR en trial" value={pesos(mrrTrial)} sub={`${enTrial.length} sin cobrar aún`} color={COLORES.ambar} />
      </div>
      <Nota>
        🔴 El MRR en trial <strong>todavía no es dinero</strong>: son suscripciones activas cuyo primer
        cobro es de $0 hasta el día 8. Sumarlo al MRR real infla los ingresos nuevos con pruebas gratuitas.
      </Nota>

      <SectionTitle>Por plan y por ciclo</SectionTitle>
      <div style={GRID_2}>
        <Panel titulo="MRR por plan">
          {porPlan.size === 0 ? <Vacio>Sin suscripciones activas</Vacio> : [...porPlan.entries()].sort((a, b) => b[1] - a[1]).map(([plan, m]) => (
            <Barra key={plan} etiqueta={plan === 'grade' ? 'Estándar' : plan === 'ai_personalized' ? 'Personalizado' : plan} valor={Math.round(aPesos(m))} total={Math.round(aPesos(mrr))} color={COLORES.verde} sufijo=" MXN" />
          ))}
        </Panel>
        <Panel titulo="MRR por ciclo de cobro">
          {porCiclo.size === 0 ? <Vacio>Sin suscripciones activas</Vacio> : [...porCiclo.entries()].sort((a, b) => b[1] - a[1]).map(([c, m]) => (
            <Barra key={c} etiqueta={c === 'monthly' ? 'Mensual' : c === 'semestral' ? 'Semestral' : 'Anual'} valor={Math.round(aPesos(m))} total={Math.round(aPesos(mrr))} color={COLORES.cian} sufijo=" MXN" />
          ))}
        </Panel>
      </div>

      <SectionTitle sub="De subscriptions.acquisition — el canal congelado en el momento del cobro">
        Ingreso por canal
      </SectionTitle>
      <Panel titulo="MRR por utm_source">
        {canales.length === 0 ? (
          <Vacio>Sin datos de canal todavía</Vacio>
        ) : (
          canales.map(([canal, p]) => (
            <Barra key={canal} etiqueta={`${canal} · ${p.n} subs`} valor={Math.round(aPesos(p.mrr))} total={Math.round(aPesos(mrr))} color={COLORES.rosa} sufijo=" MXN" />
          ))
        )}
        <Nota>
          Solo aparecen los pagos posteriores a s34: antes de esa fecha el canal no llegaba a Stripe.
          <strong> (sin utm)</strong> es tráfico orgánico o pagos anteriores — nunca se inventa &quot;direct&quot;.
        </Nota>
        <ComoSeLee id="pagoPorCanal" />
      </Panel>

      <SectionTitle>CAC y LTV</SectionTitle>
      <Panel titulo="No calculable">
        <Vacio>
          Falta el gasto publicitario. Sin una tabla <code>marketing_spend</code> (canal, mes, monto) no hay
          CAC, y sin CAC no hay LTV/CAC.
        </Vacio>
        <Nota color={COLORES.rojo}>
          El SQL de <code>marketing_spend</code> está en el reporte de este prompt, en bloque aparte.
          En cuanto exista la tabla y tenga filas, esta tarjeta se llena sola.
        </Nota>
      </Panel>
    </>
  )
}
