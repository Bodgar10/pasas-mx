import ComoSeLee from '@/components/admin/ComoSeLee'
import { StatCard, SectionTitle, Panel, Nota, Vacio, FilaRanking, COLORES, GRID_4 } from '@/components/admin/Tarjetas'
import { servicio, ventanas, pct, TOPE } from '../_lib/datos'

type Usuario = { id: string; created_at: string; acquisition_source: Record<string, string> | null }
type Sub = { user_id: string; promo_slug: string | null; created_at: string; trial_ends_at: string | null; current_period_start: string | null; billing_cycle: string | null; acquisition: Record<string, string> | null }

const CICLO_MESES: Record<string, number> = { monthly: 1, semestral: 6, annual: 12 }

export default async function Adquisicion({ incluirPrueba }: { incluirPrueba: boolean }) {
  const db = servicio()
  const v = ventanas()

  // 🔴 NO se pide `email`. Esta pestaña agrupa por canal; la identidad de
  // cada persona no hace falta y no debe viajar al navegador.
  const qU = db.from('users').select('id, created_at, acquisition_source').limit(TOPE)
  const qS = db
    .from('subscriptions')
    .select('user_id, promo_slug, created_at, trial_ends_at, current_period_start, billing_cycle, acquisition')
    .limit(TOPE)

  const [{ data: dataU }, { data: dataS }] = await Promise.all([
    incluirPrueba ? qU : qU.eq('is_test', false),
    incluirPrueba ? qS : qS.eq('is_test', false),
  ])

  const usuarios = (dataU ?? []) as Usuario[]
  const subs = (dataS ?? []) as Sub[]
  const pagaron = new Set(subs.map((s) => s.user_id))

  // ── Por canal: registros, pagos, conversión ────────────────────────
  type Canal = { registros: number; pagos: number }
  const porCanal = new Map<string, Canal>()
  for (const u of usuarios) {
    const clave = `${u.acquisition_source?.utm_source ?? '(sin utm)'} / ${u.acquisition_source?.utm_medium ?? '—'}`
    const c = porCanal.get(clave) ?? { registros: 0, pagos: 0 }
    c.registros += 1
    if (pagaron.has(u.id)) c.pagos += 1
    porCanal.set(clave, c)
  }
  const canales = [...porCanal.entries()].sort((a, b) => b[1].registros - a[1].registros)

  // ── Canal × promo ──────────────────────────────────────────────────
  const cruce = new Map<string, number>()
  for (const s of subs) {
    const clave = `${s.acquisition?.utm_source ?? '(sin utm)'} × ${s.promo_slug ?? '(sin promo)'}`
    cruce.set(clave, (cruce.get(clave) ?? 0) + 1)
  }

  // ── Retención al segundo cobro, por canal ──────────────────────────
  //
  // 🔴 DERIVADA, no observada: no hay tabla de cobros. "Llegó al segundo
  // cobro" = current_period_start avanzó al menos un ciclo completo desde el
  // fin del trial. Es válido porque invoice.paid actualiza esa columna en
  // cada renovación, pero un cobro fallido y recuperado no se distingue.
  type Ret = { primer: number; segundo: number }
  const retencion = new Map<string, Ret>()
  for (const s of subs) {
    const canal = s.acquisition?.utm_source ?? '(sin utm)'
    const r = retencion.get(canal) ?? { primer: 0, segundo: 0 }
    const inicio = s.trial_ends_at ?? s.created_at
    if (inicio <= v.ahoraIso) r.primer += 1
    const meses = CICLO_MESES[s.billing_cycle ?? 'monthly'] ?? 1
    if (s.current_period_start && inicio) {
      const transcurrido = new Date(s.current_period_start).getTime() - new Date(inicio).getTime()
      if (transcurrido >= meses * 30 * 86_400_000) r.segundo += 1
    }
    retencion.set(canal, r)
  }

  const totalRegistros = usuarios.length
  const nuevos30 = usuarios.filter((u) => u.created_at >= v.d30).length

  return (
    <>
      <SectionTitle>📣 Resumen</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Registros" value={totalRegistros} color={COLORES.primario} />
        <StatCard label="Registros 30d" value={nuevos30} color={COLORES.cian} />
        <StatCard label="Con pago" value={pagaron.size} color={COLORES.verde} />
        <StatCard label="Conversión" value={`${pct(pagaron.size, totalRegistros)}%`} sub="registro → pago" color={COLORES.ambar} />
      </div>

      <SectionTitle sub="De users.acquisition_source — first-touch, por pestaña">
        Por canal
      </SectionTitle>
      <Panel titulo="Registros, pagos y conversión">
        {canales.length === 0 ? <Vacio>Sin datos de canal</Vacio> : canales.map(([canal, c], i) => (
          <FilaRanking
            key={canal}
            posicion={i + 1}
            nombre={canal}
            sub={`${c.registros} registros · ${c.pagos} pagos`}
            valor={`${pct(c.pagos, c.registros)}%`}
            ultima={i === canales.length - 1}
            color={c.pagos > 0 ? COLORES.verde : COLORES.tenue}
          />
        ))}
        <Nota>
          🔴 El first-touch vive en <code>sessionStorage</code>: es <strong>por pestaña, no por
          persona</strong>. Quien ve el anuncio, cierra y vuelve escribiendo la URL aparece como
          orgánico. Este informe <strong>subestima el pago y sobreestima el directo</strong>, siempre.
        </Nota>
        <ComoSeLee id="pagoPorCanal" />
      </Panel>

      <SectionTitle>Canal × promoción</SectionTitle>
      <Panel titulo="Suscripciones por combinación" sub="¿Los de PASAS1 desde TikTok se quedaron, o solo vinieron por el peso?">
        {cruce.size === 0 ? <Vacio>Sin suscripciones</Vacio> : [...cruce.entries()].sort((a, b) => b[1] - a[1]).map(([k, n], i, arr) => (
          <FilaRanking key={k} nombre={k} valor={n} ultima={i === arr.length - 1} color={COLORES.rosa} />
        ))}
        <ComoSeLee id="pagoPorPromo" />
      </Panel>

      <SectionTitle>Retención al segundo cobro</SectionTitle>
      <Panel titulo="Por canal" sub="Un canal barato que solo trae gente que cancela al mes 1 no es barato">
        {retencion.size === 0 ? <Vacio>Sin suscripciones</Vacio> : [...retencion.entries()].sort((a, b) => b[1].primer - a[1].primer).map(([canal, r], i, arr) => (
          <FilaRanking
            key={canal}
            nombre={canal}
            sub={`${r.primer} llegaron al 1er cobro · ${r.segundo} al 2º`}
            valor={`${pct(r.segundo, r.primer)}%`}
            ultima={i === arr.length - 1}
            color={COLORES.cian}
          />
        ))}
        <Nota>
          Derivada del avance de <code>current_period_start</code>, no de cobros reales: no hay tabla de
          cargos. Un cobro fallido y recuperado no se distingue.
        </Nota>
      </Panel>

      <SectionTitle>Lo que PostHog hace mejor</SectionTitle>
      <Panel titulo="Embudos de landing, scroll y A/B">
        <Vacio>
          Los embudos de conducta —hero → CTA → registro, scroll depth, A/B del hero, secciones vistas—
          no se reimplementan aquí. PostHog los calcula sobre eventos y trae Session Replay al lado.
        </Vacio>
        <ComoSeLee id="embudoLanding" />
        <ComoSeLee id="abHero" />
      </Panel>
    </>
  )
}
