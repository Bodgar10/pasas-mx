import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RONDAS_POR_RETO } from '@/lib/arcade'

/**
 * Imágenes del Arcade: la vista previa del link (1200×630) y la historia
 * para Instagram / estados de WhatsApp (1080×1920).
 *
 * 🔴 SIN VISTA PREVIA, EL LINK PARECÍA SPAM. WhatsApp pintaba solo la URL en
 * azul, que es como se ven los links de estafas. Esta imagen es lo que lo
 * vuelve reconocible como un juego.
 *
 * Satori (el motor de next/og) solo entiende flexbox y un subconjunto de CSS:
 * nada de grid ni filter. Y solo lee ttf/otf/woff, por eso las fuentes van en
 * ./fuentes como .ttf (next.config.ts las incluye en el bundle de estas rutas).
 */

const C = {
  fondo: '#150c2e',
  texto: '#ffffff',
  suave: '#c4b5fd',
  tenue: '#8f84b5',
  rosa: '#ec4899',
  ok: '#10b981',
  mal: '#f43f5e',
  xp: '#fbbf24',
  chip: 'rgba(255,255,255,0.07)',
  borde: 'rgba(255,255,255,0.16)',
}

const FONDO = `radial-gradient(circle at 100% 0%, rgba(236,72,153,0.38), rgba(21,12,46,0) 55%), radial-gradient(circle at 0% 100%, rgba(124,58,237,0.6), rgba(21,12,46,0) 60%)`

let cache: Promise<{ name: string; data: Buffer; weight: 800 | 900; style: 'normal' }[]> | null = null

export function fuentesOG() {
  if (!cache) {
    const dir = join(process.cwd(), 'src/app/arcade/_og/fuentes')
    cache = Promise.all([
      readFile(join(dir, 'nunito-800.ttf')),
      readFile(join(dir, 'nunito-900.ttf')),
      readFile(join(dir, 'orbitron-900.ttf')),
    ]).then(([n8, n9, o9]) => [
      { name: 'Nunito', data: n8, weight: 800 as const, style: 'normal' as const },
      { name: 'Nunito', data: n9, weight: 900 as const, style: 'normal' as const },
      { name: 'Orbitron', data: o9, weight: 900 as const, style: 'normal' as const },
    ])
  }
  return cache
}

function Marca({ size }: { size: number }) {
  return (
    <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: size, letterSpacing: size * 0.08, color: '#e2d9f3' }}>
      PASAS<span style={{ color: C.rosa }}>·</span>ARCADE
    </div>
  )
}

function Cuadros({ resultados, lado }: { resultados: boolean[]; lado: number }) {
  return (
    <div style={{ display: 'flex', gap: lado * 0.26 }}>
      {resultados.map((ok, i) => (
        <div key={i} style={{ width: lado, height: lado, borderRadius: lado * 0.22, background: ok ? C.ok : C.mal }} />
      ))}
    </div>
  )
}

function Opciones({ opciones }: { opciones: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 430 }}>
      {opciones.map((o) => (
        <div
          key={o}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '18px 20px',
            borderRadius: 22,
            background: C.chip,
            border: `3px solid ${C.borde}`,
            fontSize: 34,
            fontWeight: 800,
            color: C.texto,
            textAlign: 'center',
          }}
        >
          {o}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: C.xp }}>
        ¿Cuál sobra?
      </div>
    </div>
  )
}

/**
 * Vista previa del link, 1200×630. Con `resultado`, es la tarjeta de quien
 * compartió (puntaje y cuadros); sin él, la del reto del día.
 * `opciones` son las de la ronda 1 de hoy: son el anzuelo, no un spoiler,
 * porque no dicen cuál sobra.
 */
export function TarjetaLink({
  numero,
  fecha,
  opciones,
  resultados,
}: {
  numero: number
  fecha: string | null
  opciones: string[] | null
  resultados: boolean[] | null
}) {
  const aciertos = resultados ? resultados.filter(Boolean).length : null
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '64px 76px',
        background: C.fondo,
        backgroundImage: FONDO,
        color: C.texto,
        fontFamily: 'Nunito',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: opciones ? 600 : 1040 }}>
        <Marca size={32} />
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 900, color: C.suave }}>
          {`¿Cuál sobra? · Reto #${numero}`}
        </div>
        {resultados ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', fontFamily: 'Orbitron', fontWeight: 900, lineHeight: 1 }}>
              <span style={{ fontSize: 170 }}>{aciertos}</span>
              <span style={{ fontSize: 76, color: C.tenue, marginBottom: 14 }}>{`/${RONDAS_POR_RETO}`}</span>
            </div>
            <Cuadros resultados={resultados} lado={58} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>
              Tres tienen algo en común. Una no.
            </div>
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, color: C.suave }}>
              Cinco rondas · dos minutos · historia
            </div>
          </div>
        )}
        {fecha && (
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: '#a78bfa' }}>{fecha}</div>
        )}
      </div>
      {opciones ? (
        <Opciones opciones={opciones} />
      ) : resultados ? (
        // Link de un reto pasado: no hay opciones de hoy que enseñar.
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, width: 430 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {['?', '?', '?', '?'].map((q, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 86,
                  height: 86,
                  borderRadius: 20,
                  background: C.chip,
                  border: `3px solid ${i === 2 ? C.rosa : C.borde}`,
                  fontSize: 44,
                  fontWeight: 900,
                  color: i === 2 ? C.rosa : C.suave,
                }}
              >
                {q}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 900, textAlign: 'center' }}>Reto nuevo cada día</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: C.xp }}>Juega el de hoy</div>
        </div>
      ) : null}
    </div>
  )
}

/** Historia para Instagram / estados de WhatsApp, 1080×1920. */
export function TarjetaHistoria({
  numero,
  resultados,
  temaFallado,
  dominio,
}: {
  numero: number
  resultados: boolean[]
  temaFallado: string | null
  dominio: string
}) {
  const aciertos = resultados.filter(Boolean).length
  const perfecto = aciertos === RONDAS_POR_RETO
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '150px 90px 260px',
        background: C.fondo,
        backgroundImage: FONDO,
        color: C.texto,
        fontFamily: 'Nunito',
      }}
    >
      <Marca size={56} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
        <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, color: C.suave }}>
          {`Reto de historia #${numero}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', fontFamily: 'Orbitron', fontWeight: 900, lineHeight: 1 }}>
          <span style={{ fontSize: 360 }}>{aciertos}</span>
          <span style={{ fontSize: 150, color: C.tenue, marginBottom: 30 }}>{`/${RONDAS_POR_RETO}`}</span>
        </div>
        <Cuadros resultados={resultados} lado={120} />
        <div style={{ display: 'flex', fontSize: 62, fontWeight: 900, textAlign: 'center', justifyContent: 'center' }}>
          {perfecto ? (
            'Cinco de cinco'
          ) : temaFallado ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
              Me ganó&nbsp;<span style={{ color: C.rosa }}>{temaFallado}</span>
            </span>
          ) : (
            '¿Cuál sobra?'
          )}
        </div>
      </div>
      {/* El tercio de abajo queda libre: ahí Instagram pone su sticker de link. */}
      <div style={{ display: 'flex', background: '#ffffff', color: C.fondo, borderRadius: 28, padding: '26px 44px', fontSize: 52, fontWeight: 900 }}>
        {`${dominio}/arcade`}
      </div>
    </div>
  )
}
