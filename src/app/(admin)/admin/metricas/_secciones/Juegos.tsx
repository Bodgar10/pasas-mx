import { configMateria } from '@/lib/arcade/materias'
import { StatCard, SectionTitle, Panel, Nota, Vacio, FilaRanking, Barra, COLORES, GRID_4, GRID_2 } from '@/components/admin/Tarjetas'
import { servicio, TOPE, pct } from '../_lib/datos'

/**
 * 🎮 Juegos gratis: el Arcade (reto diario) y la Horda pública.
 *
 * 🔴 SALE DE SUPABASE, NO DE POSTHOG. PostHog solo ve a quien acepta las
 * cookies de analítica; `arcade_plays` y `horda_publica_avance` (migraciones
 * 051 y 052) cuentan a TODOS los que juegan. El único identificador es el id
 * anónimo del navegador: "jugadores" = navegadores distintos, no personas
 * (el mismo alumno en celular y compu cuenta dos).
 *
 * No aplica el toggle de cuentas de prueba: los juegos no tienen cuenta.
 */

type Partida = { challenge_date: string; anon_id: string; score: number; origen: string | null }
type Avance = {
  anon_id: string
  topic_id: string
  partidas: number
  oleada_max: number
  llego_muro: boolean
  eleccion: string | null
  origen: string | null
  topics: { name: string } | null
}

const ORIGEN_LABEL: Record<string, string> = {
  landing_banner: 'Banner de la landing',
  resultado_compartido: 'Resultado compartido',
  arcade: 'Desde el Arcade',
  directo: 'Directo (link, Google, reels…)',
}

const restarDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const promedio = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—')

export default async function Juegos() {
  const db = servicio()
  const { data: hoyData } = await db.rpc('arcade_hoy')
  const hoy = (hoyData as string | null) ?? new Date().toISOString().slice(0, 10)
  const desde30 = restarDias(hoy, 29)
  const desde7 = restarDias(hoy, 6)

  const [{ data: partidasData }, { data: retosData }, { data: cifrasHoy }, { data: avanceData }] = await Promise.all([
    db.from('arcade_plays').select('challenge_date, anon_id, score, origen').gte('challenge_date', desde30).limit(TOPE),
    db.from('arcade_challenges').select('challenge_date, number, materia').gte('challenge_date', desde30).lte('challenge_date', hoy),
    db.rpc('arcade_cifras', { p_date: hoy }),
    db
      .from('horda_publica_avance')
      .select('anon_id, topic_id, partidas, oleada_max, llego_muro, eleccion, origen, topics(name)')
      .gte('updated_at', `${desde30}T00:00:00Z`)
      .limit(TOPE),
  ])

  const partidas = (partidasData ?? []) as Partida[]
  const numeroDe = new Map((retosData ?? []).map((r) => [r.challenge_date as string, r.number as number]))
  const materiaDe = new Map((retosData ?? []).map((r) => [r.challenge_date as string, configMateria(r.materia as string).corto]))
  const avance = (avanceData ?? []) as unknown as Avance[]

  // ── Arcade ───────────────────────────────────────────────────────────
  const jugadoresHoy = new Set(partidas.filter((p) => p.challenge_date === hoy).map((p) => p.anon_id)).size
  const ult7 = partidas.filter((p) => p.challenge_date >= desde7)
  const jugadores7 = new Set(ult7.map((p) => p.anon_id)).size
  const jugadores30 = new Set(partidas.map((p) => p.anon_id)).size

  const diasPorJugador = new Map<string, Set<string>>()
  for (const p of partidas) {
    if (!diasPorJugador.has(p.anon_id)) diasPorJugador.set(p.anon_id, new Set())
    diasPorJugador.get(p.anon_id)!.add(p.challenge_date)
  }
  const regresan = [...diasPorJugador.values()].filter((s) => s.size >= 2).length

  const porDia = new Map<string, Partida[]>()
  for (const p of partidas) {
    if (!porDia.has(p.challenge_date)) porDia.set(p.challenge_date, [])
    porDia.get(p.challenge_date)!.push(p)
  }
  const dias = [...porDia.keys()].sort().reverse().slice(0, 14)

  const porOrigen = new Map<string, number>()
  for (const p of partidas) {
    const k = p.origen ?? 'sin_dato'
    porOrigen.set(k, (porOrigen.get(k) ?? 0) + 1)
  }
  const origenes = [...porOrigen.entries()].sort((a, b) => b[1] - a[1])

  const cifras = cifrasHoy as { players: number; per_round: (number | null)[] } | null

  // ── Horda pública ────────────────────────────────────────────────────
  const empezaron = avance.filter((a) => a.partidas > 0)
  const jugadoresHorda = new Set(empezaron.map((a) => a.anon_id)).size
  const pasan = (n: number) => avance.filter((a) => a.oleada_max >= n).length
  const muro = avance.filter((a) => a.llego_muro).length
  const eligen = (q: string) => avance.filter((a) => a.eleccion === q).length

  const porTema = new Map<string, { nombre: string; jugadores: number; muro: number }>()
  for (const a of empezaron) {
    const t = porTema.get(a.topic_id) ?? { nombre: a.topics?.name ?? a.topic_id, jugadores: 0, muro: 0 }
    t.jugadores += 1
    if (a.llego_muro) t.muro += 1
    porTema.set(a.topic_id, t)
  }
  const temas = [...porTema.values()].sort((a, b) => b.jugadores - a.jugadores).slice(0, 10)

  return (
    <>
      <SectionTitle sub="Retos terminados. Cuenta a todos los que juegan, acepten o no cookies.">🎯 Reto diario (Arcade)</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Jugadores hoy" value={jugadoresHoy} sub={`reto #${numeroDe.get(hoy) ?? '—'}`} color={COLORES.verde} />
        <StatCard label="Jugadores 7 días" value={jugadores7} sub={`${ult7.length} partidas`} color={COLORES.primario} />
        <StatCard label="Jugadores 30 días" value={jugadores30} sub={`${partidas.length} partidas`} color={COLORES.cian} />
        <StatCard
          label="Regresan"
          value={regresan}
          sub={`${pct(regresan, jugadores30)}% jugó 2 días o más`}
          color={COLORES.rosa}
        />
      </div>

      <div style={GRID_2}>
        <Panel titulo="Por día" sub="Últimos 14 días con partidas">
          {dias.length === 0 ? (
            <Vacio>Todavía nadie termina un reto.</Vacio>
          ) : (
            dias.map((d, i) => {
              const ps = porDia.get(d)!
              const jug = new Set(ps.map((p) => p.anon_id)).size
              const perfectos = ps.filter((p) => p.score === 5).length
              const banner = ps.filter((p) => p.origen === 'landing_banner').length
              return (
                <FilaRanking
                  key={d}
                  nombre={`Reto #${numeroDe.get(d) ?? '—'} · ${materiaDe.get(d) ?? ''} · ${new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}`}
                  sub={`promedio ${promedio(ps.map((p) => p.score))}/5 · ${pct(perfectos, ps.length)}% perfectos · ${banner} desde el banner`}
                  valor={jug}
                  valorSecundario="jugadores"
                  ultima={i === dias.length - 1}
                />
              )
            })
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel titulo="Por dónde llegaron" sub="Partidas de los últimos 30 días">
            {origenes.length === 0 ? (
              <Vacio>Sin partidas.</Vacio>
            ) : (
              origenes.map(([k, n]) => (
                <Barra
                  key={k}
                  etiqueta={ORIGEN_LABEL[k] ?? 'Sin dato (antes del 29-sep)'}
                  valor={n}
                  total={partidas.length}
                  color={k === 'landing_banner' ? COLORES.rosa : COLORES.primario}
                />
              ))
            )}
          </Panel>

          <Panel titulo="Hoy, ronda por ronda" sub="% que acertó cada ronda del reto de hoy">
            {!cifras || cifras.players === 0 ? (
              <Vacio>Nadie ha terminado el reto de hoy.</Vacio>
            ) : (
              cifras.per_round.map((v, i) => (
                <Barra
                  key={i}
                  etiqueta={`Ronda ${i + 1}`}
                  valor={v ?? 0}
                  total={100}
                  sufijo="%"
                  color={(v ?? 0) < 40 ? COLORES.rojo : (v ?? 0) < 70 ? COLORES.ambar : COLORES.verde}
                />
              ))
            )}
            <Nota color={COLORES.cian}>Útil para el reel del día siguiente: &ldquo;solo el X% acertó&rdquo;.</Nota>
          </Panel>
        </div>
      </div>

      <SectionTitle sub="Oleadas 1 a 3 sin cuenta. Una fila por navegador y tema.">🧟 Horda pública</SectionTitle>
      <div style={GRID_4}>
        <StatCard label="Jugadores 30 días" value={jugadoresHorda} sub={`${empezaron.length} navegador·tema`} color={COLORES.primario} />
        <StatCard label="Llegan al muro" value={muro} sub={`${pct(muro, empezaron.length)}% superan la oleada 3`} color={COLORES.verde} />
        <StatCard label="Eligen 'Soy papá/mamá'" value={eligen('adulto')} sub="van al onboarding" color={COLORES.rosa} />
        <StatCard label="Eligen 'Soy estudiante'" value={eligen('estudiante')} sub="mensaje al papá" color={COLORES.ambar} />
      </div>

      <div style={GRID_2}>
        <Panel titulo="Hasta dónde llegan" sub="Sobre los que empezaron">
          {empezaron.length === 0 ? (
            <Vacio>Todavía nadie juega la Horda pública.</Vacio>
          ) : (
            <>
              <Barra etiqueta="Superan la oleada 1" valor={pasan(1)} total={empezaron.length} />
              <Barra etiqueta="Superan la oleada 2" valor={pasan(2)} total={empezaron.length} />
              <Barra etiqueta="Superan la oleada 3 (muro)" valor={muro} total={empezaron.length} color={COLORES.verde} />
              <Barra etiqueta="Eligen quién crea la cuenta" valor={eligen('adulto') + eligen('estudiante')} total={empezaron.length} color={COLORES.rosa} />
            </>
          )}
        </Panel>

        <Panel titulo="Temas más jugados" sub="Jugadores y cuántos llegaron al muro">
          {temas.length === 0 ? (
            <Vacio>Sin datos.</Vacio>
          ) : (
            temas.map((t, i) => (
              <FilaRanking
                key={t.nombre}
                posicion={i + 1}
                nombre={t.nombre}
                sub={`${t.muro} llegaron al muro`}
                valor={t.jugadores}
                ultima={i === temas.length - 1}
                color={COLORES.primario}
              />
            ))
          )}
        </Panel>
      </div>

      <Nota color={COLORES.cian}>
        Lo que pasa después del muro (onboarding, registro, pago) vive en PostHog y solo cuenta a quien acepta
        cookies: botón &quot;Ver en PostHog&quot; de arriba. La Horda pública empezó a guardarse el 29-sep-2026.
      </Nota>
    </>
  )
}
