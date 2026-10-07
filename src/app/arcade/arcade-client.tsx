'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics/track'
import {
  MIN_JUGADORES_CIFRAS,
  RONDAS_POR_RETO,
  calcularResultados,
  codigoResultado,
  etiquetaPuntaje,
  fechaLarga,
  anonIdJuegos,
  fijarOrigenArcade,
  leerOrigenArcade,
  formatoReloj,
  rondaDelPuente,
  segundosParaSiguienteReto,
  textoCompartir,
  urlHorda,
  type CifrasArcade,
  type OrigenArcade,
  type RetoArcade,
} from '@/lib/arcade'
import { atribucionJuegos, type Atribucion } from '@/lib/arcade/canal'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import RecordatorioForm from './recordatorio-form'
import { configMateria, materiaDeManana, nombreParaManana } from '@/lib/arcade/materias'
import { esMateriaPublica } from '@/lib/horda-publica'
import s from './arcade.module.css'

type Fase = 'intro' | 'play' | 'end'

/**
 * s39 — El reto de hoy, cuando la página sirve OTRO: el más reciente de una
 * materia (/arcade?materia=historia, ver contenido.tsx). Con él, la portada
 * aclara que no es el de hoy y el resultado invita a jugar el de hoy.
 */
export type RetoDeHoy = { number: number; materia: string | null }

/** "Geografía" o "el reto para papás", para frases como "Hoy toca …". */
function nombreDeMateria(m: string | null | undefined): string {
  return m === 'papas' ? 'el reto para papás' : configMateria(m).nombre
}

// 🔴 localStorage puede no existir o lanzar (modo privado, datos bloqueados).
// El juego tiene que funcionar igual; solo se pierde el "ya jugaste hoy".
const llavePartida = (fecha: string) => `pasas-arcade:partida:${fecha}`

function leerLocal(llave: string): string | null {
  try {
    return window.localStorage.getItem(llave)
  } catch {
    return null
  }
}
function escribirLocal(llave: string, valor: string) {
  try {
    window.localStorage.setItem(llave, valor)
  } catch {}
}

export default function ArcadeClient({
  reto,
  dominio,
  origenRuta = null,
  retoDeHoy = null,
}: {
  reto: RetoArcade
  dominio: string
  /** Lo fija la ruta: /arcade/r/... es siempre 'resultado_compartido'. */
  origenRuta?: OrigenArcade | null
  /** Solo cuando `reto` NO es el de hoy (reto por materia). */
  retoDeHoy?: RetoDeHoy | null
}) {
  const [fase, setFase] = useState<Fase>('intro')
  const [idx, setIdx] = useState(0)
  const [picks, setPicks] = useState<number[]>([])
  const [cifras, setCifras] = useState<CifrasArcade | null>(null)
  const [aviso, setAviso] = useState('')
  const [reloj, setReloj] = useState<string | null>(null)
  // Aviso al volver de confirmar o darse de baja del recordatorio (s34-F5).
  const [avisoRecordatorio, setAvisoRecordatorio] = useState<string | null>(null)
  useEffect(() => {
    void (async () => {
      const r = new URLSearchParams(window.location.search).get('recordatorio')
      const textos: Record<string, string> = {
        confirmado: 'Listo: te avisaremos cada mañana cuando salga el reto.',
        baja: 'Listo: ya no recibirás el recordatorio.',
        invalido: 'Ese enlace ya no es válido.',
      }
      if (r && textos[r]) setAvisoRecordatorio(textos[r])
    })()
  }, [])
  const refCompartir = useRef<HTMLPreElement>(null)

  // ── Origen (entrada dentro del producto) y canal (de dónde vino, fuera
  // del producto). Ver fijarOrigenArcade en lib/arcade y lib/arcade/canal.
  const origenRef = useRef<OrigenArcade>('directo')
  const atribRef = useRef<Atribucion>({ canal: 'directo', utm_source: null, utm_campaign: null })
  const conOrigen = (evento: string, props: Record<string, unknown>) =>
    track(evento, { ...props, origen: origenRef.current, canal: atribRef.current.canal, por_materia: !!retoDeHoy })

  // `arcade_visto` es la entrada al embudo: sin él no se sabe cuántos de los
  // que tocaron el banner llegaron a ver el juego. window.location y no
  // useSearchParams: la página es ISR y no lleva <Suspense> para eso.
  useEffect(() => {
    const desde = origenRuta ?? new URLSearchParams(window.location.search).get('desde')
    origenRef.current = fijarOrigenArcade(desde)
    atribRef.current = atribucionJuegos()
    track('arcade_visto', {
      origen: origenRef.current,
      canal: atribRef.current.canal,
      reto_numero: reto.number,
      ya_jugo: !!leerLocal(llavePartida(reto.date)),
      por_materia: !!retoDeHoy,
    })
    // retoDeHoy viene del servidor y no cambia mientras la página vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenRuta, reto.number, reto.date])

  const resultados = calcularResultados(reto, picks)
  const aciertos = resultados.filter(Boolean).length

  const enviarPartida = useCallback(
    async (p: number[]) => {
      try {
        const res = await fetch('/api/arcade/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: reto.date,
            anonId: anonIdJuegos(),
            picks: p,
            origen: origenRef.current,
            ...atribRef.current,
          }),
        })
        const json = (await res.json()) as { cifras?: CifrasArcade | null }
        setCifras(json.cifras ?? null)
      } catch {
        // Sin red no hay cifras del día; el resultado propio ya está en pantalla.
      }
    },
    [reto.date]
  )

  // ¿Ya jugó hoy en este navegador? Directo a su resultado.
  // Mismo patrón que usePromo: el estado se escribe desde la función async,
  // no en la pasada síncrona del efecto (react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => {
      const guardado = leerLocal(llavePartida(reto.date))
      if (!guardado) return
      try {
        const p = JSON.parse(guardado) as number[]
        if (Array.isArray(p) && p.length === RONDAS_POR_RETO) {
          setPicks(p)
          setFase('end')
          await enviarPartida(p)
        }
      } catch {}
    })()
  }, [reto.date, enviarPartida])

  // Cuenta regresiva. Al llegar a cero, recarga: ya hay reto nuevo.
  useEffect(() => {
    const tick = () => {
      const seg = segundosParaSiguienteReto()
      setReloj(formatoReloj(seg))
      if (seg === 0) window.setTimeout(() => window.location.reload(), 3000)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [fase])

  /**
   * 🔴 UN SOLO PUNTO DE DISPARO por evento (s34-F2):
   *   - `arcade_iniciado` aquí, una vez por partida (la ref evita el doble
   *     toque). Es el único camino a 'play': entrada directa, banner,
   *     resultado compartido o link de la Horda, todos pasan por la portada.
   *   - `arcade_completado` en `responder`, en el mismo instante en que se
   *     guarda la partida. Antes salía al tocar "Ver mi resultado": quien
   *     cerraba después de la 5ª respuesta quedaba guardado sin evento.
   * Quien vuelve el mismo día ve su resultado guardado y solo dispara
   * `arcade_visto` (con ya_jugo: true): no es una partida nueva.
   */
  const partidaIniciadaRef = useRef(false)
  function empezar() {
    setPicks([])
    setIdx(0)
    setFase('play')
    if (!partidaIniciadaRef.current) {
      partidaIniciadaRef.current = true
      conOrigen('arcade_iniciado', { reto_numero: reto.number })
    }
  }

  function responder(i: number) {
    if (picks.length > idx) return
    const nuevos = [...picks, i]
    setPicks(nuevos)
    if (nuevos.length === RONDAS_POR_RETO) {
      escribirLocal(llavePartida(reto.date), JSON.stringify(nuevos))
      void enviarPartida(nuevos)
      const score = calcularResultados(reto, nuevos).filter(Boolean).length
      conOrigen('arcade_completado', { reto_numero: reto.number, score, aciertos: score })
    }
  }

  function siguiente() {
    if (idx < RONDAS_POR_RETO - 1) {
      setIdx(idx + 1)
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      setFase('end')
    }
  }

  const codigo = codigoResultado(reto.number, resultados)
  const texto = textoCompartir(reto.number, resultados, dominio, reto.materia)

  // ¿El navegador tiene menú nativo para compartir? Se decide en el cliente
  // (en el servidor no existe navigator) y desde la función async, como el
  // resto de efectos del archivo (react-hooks/set-state-in-effect).
  const [puedeCompartir, setPuedeCompartir] = useState(false)
  useEffect(() => {
    void (async () => setPuedeCompartir(typeof navigator !== 'undefined' && typeof navigator.share === 'function'))()
  }, [])

  /** Un solo evento para los tres métodos (s34-F3). */
  const compartirClic = (metodo: 'nativo' | 'whatsapp' | 'copiar') =>
    conOrigen('arcade_compartir_clic', { metodo, score: aciertos, numero_reto: reto.number })

  // Imagen para historias. Se descarga al llegar al resultado, no al tocar el
  // botón: iOS exige que navigator.share se llame dentro del toque, y una
  // descarga en medio rompe ese permiso. Solo en navegadores que pueden
  // compartir archivos (celulares); en computadora el botón no aparece.
  const [imagen, setImagen] = useState<File | null>(null)

  // Calienta la vista previa del link en el CDN antes de que la persona toque
  // WhatsApp. La primera petición de cada código tarda ~1.7 s en generarse, y
  // esa primera suele ser la de WhatsApp, que se rinde rápido y manda la
  // tarjeta sin foto. Desde este mismo teléfono cae en el mismo nodo del CDN.
  useEffect(() => {
    if (fase !== 'end' || picks.length !== RONDAS_POR_RETO) return
    void fetch(`/arcade/r/${codigo}/imagen`).catch(() => {})
  }, [fase, picks.length, codigo])

  useEffect(() => {
    if (fase !== 'end' || picks.length !== RONDAS_POR_RETO) return
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return
    let vivo = true
    void (async () => {
      try {
        const res = await fetch(`/arcade/r/${codigo}/historia`)
        if (!res.ok) return
        const blob = await res.blob()
        const archivo = new File([blob], `pasas-reto-${reto.number}.png`, { type: 'image/png' })
        if (vivo && navigator.canShare({ files: [archivo] })) setImagen(archivo)
      } catch {}
    })()
    return () => {
      vivo = false
    }
  }, [fase, picks.length, codigo, reto.number])

  /** Menú nativo del teléfono. Con la imagen para historias si ya está lista. */
  async function compartirNativo() {
    compartirClic('nativo')
    try {
      if (imagen) await navigator.share({ files: [imagen], text: texto })
      else await navigator.share({ text: texto })
    } catch {
      // Cancelado por la persona o rechazado por el navegador: no hay nada que avisar.
    }
  }

  async function copiar() {
    compartirClic('copiar')
    try {
      await navigator.clipboard.writeText(texto)
      setAviso('¡Copiado! Pégalo en tu grupo.')
    } catch {
      const el = refCompartir.current
      if (el) {
        const rango = document.createRange()
        rango.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(rango)
      }
      setAviso('Texto seleccionado. Cópialo manualmente.')
    }
  }

  // Materia del día: colores y textos (lib/arcade/materias). El acento va
  // como variable CSS para que el módulo lo use en botones y progreso.
  const mat = configMateria(reto.materia)
  const manana = nombreParaManana(materiaDeManana(reto.date))
  const estiloMateria = { '--acento': mat.acento, '--sobre-acento': mat.sobreAcento } as React.CSSProperties

  return (
    <main className={s.root} style={estiloMateria}>
      <div className={s.wrap}>
        <header className={s.top}>
          <Link href="/" className={s.wordmark}>
            PASAS<span>·</span>ARCADE
          </Link>
          <div className={s.date}>{fechaLarga(reto.date)}</div>
        </header>

        {avisoRecordatorio && (
          <div className={s.aviso} role="status">
            {avisoRecordatorio}
          </div>
        )}

        {fase === 'intro' && (
          <section className={s.screen}>
            <div className={s.stack8}>
              <div className={s.eyebrow}>
                <span aria-hidden="true">{mat.emoji}</span> {mat.eyebrow(reto.number)}
              </div>
              <h1>¿Cuál sobra?</h1>
              <p className={s.lead}>{mat.lead}</p>
            </div>

            <div className={s.card}>
              <div className={s.eyebrow}>Así se juega</div>
              <div className={s.example} aria-hidden="true">
                {mat.ejemplo.opciones.map((o, i) => (
                  <div key={o} className={`${s.chip} ${i === mat.ejemplo.sobra ? s.chipOdd : ''}`}>
                    {o}
                  </div>
                ))}
              </div>
              <p className={s.exampleNote}>{mat.ejemplo.nota}</p>
            </div>

            <div className={s.facts}>
              <span className={s.fact}>5 rondas</span>
              <span className={s.fact}>2 minutos</span>
              <span className={s.fact}>{mat.corto}</span>
            </div>

            <button className={`${s.btn} ${s.primary}`} type="button" onClick={empezar}>
              Jugar el reto de hoy
            </button>
            {retoDeHoy ? (
              <p className={s.fine}>
                Es el reto de {mat.corto} más reciente. Hoy toca {nombreDeMateria(retoDeHoy.materia)}: lo juegas al
                terminar este.
              </p>
            ) : (
              <p className={s.fine}>
                Un reto nuevo cada día a las 00:00, hora del centro de México, el mismo para todos. Mañana toca{' '}
                {manana}.
              </p>
            )}
          </section>
        )}

        {fase === 'play' && (
          <Ronda
            reto={reto}
            idx={idx}
            picks={picks}
            onResponder={responder}
            onSiguiente={siguiente}
          />
        )}

        {fase === 'end' && (
          <section className={s.screen}>
            <div className={s.scoreBlock}>
              <div className={s.eyebrow}>{mat.eyebrow(reto.number)} completado</div>
              <div className={s.score}>
                {aciertos}
                <small>/{RONDAS_POR_RETO}</small>
              </div>
              <div className={s.squares} aria-hidden="true">
                {resultados.map((ok, i) => (
                  <div key={i} className={`${s.sq} ${ok ? s.sqOk : s.sqBad}`} />
                ))}
              </div>
              <div className={s.scoreLabel}>{etiquetaPuntaje(aciertos)}</div>
              {cifras && cifras.players >= MIN_JUGADORES_CIFRAS && cifras.avg !== null && (
                <p className={s.crowd}>
                  {retoDeHoy ? 'Lo jugaron' : 'Hoy jugaron'} {cifras.players.toLocaleString('es-MX')} · promedio{' '}
                  {Number(cifras.avg).toLocaleString('es-MX', { maximumFractionDigits: 1 })}/5
                </p>
              )}
            </div>

            {retoDeHoy && <SigueConHoy reto={reto} retoDeHoy={retoDeHoy} />}

            {/* Compartir va ARRIBA (s34-F3): es el canal que más jugadores trae,
                y en un celular de 375 px tiene que verse sin hacer scroll. */}
            <div className={s.share}>
              <div className={s.row3}>
                {puedeCompartir && (
                  <button className={`${s.btn} ${s.primary}`} type="button" onClick={compartirNativo}>
                    Compartir
                  </button>
                )}
                <a
                  className={`${s.btn} ${s.wa}`}
                  href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
                  target="_blank"
                  rel="noopener"
                  onClick={() => compartirClic('whatsapp')}
                >
                  WhatsApp
                </a>
                <button className={`${s.btn} ${s.ghost}`} type="button" onClick={copiar}>
                  Copiar
                </button>
              </div>
              <div className={s.toast} role="status" aria-live="polite">
                {aviso}
              </div>
              <pre className={s.sharePreview} ref={refCompartir}>
                {texto}
              </pre>
            </div>

            {FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO && <RecordatorioForm />}

            <ul className={s.recap}>
              {reto.rounds.map((r, i) => {
                const pct =
                  cifras && cifras.players >= MIN_JUGADORES_CIFRAS ? cifras.per_round[i] : null
                return (
                  <li key={r.id}>
                    <span className={`${s.dot} ${resultados[i] ? s.dotOk : s.dotBad}`} />
                    <div>
                      <div className={s.recapT}>{r.topic}</div>
                      <div className={s.recapS}>
                        Sobraba {r.options[r.odd]}
                        {resultados[i] ? '' : ` · tú elegiste ${r.options[picks[i]]}`}
                        {pct !== null && pct !== undefined ? ` · acertó el ${pct}%` : ''}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <Puente reto={reto} resultados={resultados} />

            {!retoDeHoy && (
              <div className={s.next}>
                <span>
                  Siguiente reto en
                  <small className={s.nextMateria}>Mañana: {manana}</small>
                </span>
                <b suppressHydrationWarning>{reloj ?? '--:--:--'}</b>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function Ronda({
  reto,
  idx,
  picks,
  onResponder,
  onSiguiente,
}: {
  reto: RetoArcade
  idx: number
  picks: number[]
  onResponder: (i: number) => void
  onSiguiente: () => void
}) {
  const r = reto.rounds[idx]
  const elegida = picks.length > idx ? picks[idx] : null
  const ok = elegida === r.odd

  return (
    <section className={s.screen}>
      <div className={s.roundHead}>
        <div className={s.roundMeta}>
          <span>Reto #{reto.number}</span>
          <span className={s.count}>
            Ronda {idx + 1} de {RONDAS_POR_RETO}
          </span>
        </div>
        <div className={s.progress}>
          {reto.rounds.map((ronda, i) => {
            const cls =
              i < picks.length
                ? picks[i] === ronda.odd
                  ? s.segOk
                  : s.segBad
                : i === idx
                  ? s.segCurrent
                  : ''
            return <div key={ronda.id} className={`${s.seg} ${cls}`} />
          })}
        </div>
      </div>

      <div className={s.prompt}>
        <h2>¿Cuál sobra?</h2>
        <p>Tres tienen algo en común. Toca el que no.</p>
      </div>

      <div className={s.options}>
        {r.options.map((texto, j) => {
          let estado = ''
          if (elegida !== null) {
            if (j === r.odd) estado = s.optRight
            else if (j === elegida) estado = s.optWrong
            else estado = s.optFade
          }
          return (
            <button
              key={`${r.id}-${j}`}
              type="button"
              className={`${s.opt} ${r.kind === 'year' ? s.optYear : ''} ${estado}`}
              disabled={elegida !== null}
              onClick={() => onResponder(j)}
            >
              {texto}
            </button>
          )
        })}
      </div>

      {elegida !== null && (
        <div className={s.reveal} aria-live="polite">
          <span className={`${s.verdict} ${ok ? s.verdictOk : s.verdictBad}`}>
            {ok ? '¡Correcto!' : `Sobraba ${r.options[r.odd]}`}
          </span>
          <p>{r.explanation}</p>
          <p className={s.topic}>
            Del tema <b>{r.topic}</b>
            {reto.materia === 'papas' && r.materia ? ` · ${configMateria(r.materia).corto}` : ''}
          </p>
          <button className={`${s.btn} ${s.primary}`} type="button" onClick={onSiguiente} autoFocus>
            {idx < RONDAS_POR_RETO - 1 ? 'Siguiente ronda' : 'Ver mi resultado'}
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * s39 — Al terminar un reto por materia que no es el de hoy: invitación a
 * jugar el de hoy. Va justo debajo del puntaje porque es la forma más directa
 * de seguir jugando. /arcade sin ?materia= sirve siempre el reto de hoy.
 */
function SigueConHoy({ reto, retoDeHoy }: { reto: RetoArcade; retoDeHoy: RetoDeHoy }) {
  const nombre = nombreDeMateria(retoDeHoy.materia)
  return (
    <div className={s.bridge}>
      <div className={s.bridgeInner}>
        <div className={s.eyebrow}>Hoy toca {nombre}</div>
        <h3>¿Le sigues con el reto de hoy?</h3>
        <p>Cinco rondas nuevas de {nombre}, el mismo reto para todos hoy.</p>
        <Link
          className={`${s.btn} ${s.primary}`}
          href="/arcade?desde=arcade"
          onClick={() =>
            track('arcade_reto_hoy_clic', {
              reto_numero: reto.number,
              reto_hoy: retoDeHoy.number,
              origen: leerOrigenArcade() ?? undefined,
              canal: atribucionJuegos().canal,
            })
          }
        >
          Jugar el reto de hoy
        </Link>
      </div>
    </div>
  )
}

function Puente({ reto, resultados }: { reto: RetoArcade; resultados: boolean[] }) {
  const r = rondaDelPuente(reto, resultados)
  const perfecto = !resultados.includes(false)

  return (
    <div className={s.bridge}>
      <div className={s.bridgeInner}>
        <div className={s.eyebrow}>{perfecto ? 'Siguiente nivel' : 'Tu repaso de hoy'}</div>
        <h3>{perfecto ? 'Cinco de cinco. ¿Aguantas más?' : `Fallaste en ${r.topic}`}</h3>
        <p>
          {r.horde_ready && esMateriaPublica(r.subject_slug)
            ? perfecto
              ? `El reto diario es el calentamiento. En PASAS, ${r.topic} tiene su propio Modo Horda con preguntas más difíciles.`
              : 'Este tema tiene su propio Modo Horda: oleadas de preguntas, cada una más difícil. Las primeras tres son gratis.'
            : `En PASAS, ${r.topic} se explica con lo que te gusta: anime, futbol, K-pop o videojuegos. Y cada tema tiene su Modo Horda.`}
        </p>
        {r.horde_ready && esMateriaPublica(r.subject_slug) && (
          <>
            <div className={s.hordeStats}>
              <span>3 oleadas gratis</span>
              <span>15 preguntas</span>
              <span>Sin registrarte</span>
            </div>
            <Link
              className={`${s.btn} ${s.primary}`}
              href={urlHorda(r)}
              onClick={() =>
                track('arcade_puente_clic', { reto_numero: reto.number, tema: r.topic, perfecto, origen: leerOrigenArcade() ?? undefined, canal: atribucionJuegos().canal })
              }
            >
              Jugar la Horda de {r.topic}
            </Link>
          </>
        )}
        {!(r.horde_ready && esMateriaPublica(r.subject_slug)) && (
          // La Horda pública solo existe para historia (lib/horda-publica).
          // En las demás materias el puente lleva a conocer PASAS.
          <Link
            className={`${s.btn} ${s.primary}`}
            href="/"
            onClick={() =>
              track('arcade_puente_clic', { reto_numero: reto.number, tema: r.topic, perfecto, destino: 'landing', origen: leerOrigenArcade() ?? undefined, canal: atribucionJuegos().canal })
            }
          >
            Conoce PASAS
          </Link>
        )}
        <Link className={s.link} href="/">
          ¿Qué es PASAS?
        </Link>
      </div>
    </div>
  )
}
