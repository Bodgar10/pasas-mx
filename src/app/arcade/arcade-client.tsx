'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
  NOMBRE_JUEGO,
  type CifrasArcade,
  type JuegoArcade,
  type OrigenArcade,
  type RetoArcade,
} from '@/lib/arcade'
import { atribucionJuegos, type Atribucion } from '@/lib/arcade/canal'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import RecordatorioForm from './recordatorio-form'
import { MATERIAS, configMateria, materiaDeManana, nombreParaManana } from '@/lib/arcade/materias'
import { esMateriaPublica } from '@/lib/horda-publica'
import { conPromo } from '@/lib/promos'
import { TEMATICAS, urlTemaMuestra } from '@/lib/tema-muestra'
import s from './arcade.module.css'

/**
 * 'inicio' = el primer render (servidor e hidratación): pinta la portada (A)
 * Y la ronda 1 (B) a la vez. La B nace escondida por CSS; el script de abajo,
 * si toca B, agrega un <style> que esconde la A y muestra la B antes de
 * pintar. Así nadie ve un parpadeo de la otra versión. Después de montar,
 * pasa a 'intro' (A) o 'play' (B).
 */
type Fase = 'inicio' | 'intro' | 'play' | 'end'
type Variante = 'A' | 'B'

/**
 * s40 — PRUEBA A/B de la entrada al reto.
 *   A: portada con "Así se juega" y botón "Jugar el reto de hoy" (la de siempre).
 *   B: la ronda 1 de entrada, sin portada ni botón.
 * Corre antes de pintar: es un <script> en línea del HTML del servidor, como
 * el truco del modo oscuro. Todos los eventos del Arcade llevan `variant`.
 *
 * s46 — PRUEBA CERRADA el 13 oct: empataron (A 16% y B 14% respondieron la
 * primera, 4 de 5 terminaron en las dos). Se queda B para TODOS, por ser una
 * pantalla menos. ?v=a sigue mostrando la portada vieja, solo para revisarla.
 * Ya no se sortea ni se lee localStorage: quien tenía 'a' guardado ve B.
 *
 * 🔴 No toca atributos de <html> ni de nada que pinte React: eso rompe la
 * hidratación. Deja la versión en window.__pasasArcadeV y, solo en B, mete un
 * <style> con las clases ya resueltas del módulo CSS.
 */
function scriptVariante(claseA: string, claseB: string): string {
  const css = `.${claseA}{display:none!important}.${claseB}{display:flex!important}`
  return `(function(){var v='b';try{if(new URLSearchParams(location.search).get('v')==='a'){v='a'}}catch(e){}window.__pasasArcadeV=v;if(v==='b'){var st=document.createElement('style');st.textContent=${JSON.stringify(css)};document.head.appendChild(st)}})();`
}

function leerVariante(): Variante {
  return typeof window !== 'undefined' && (window as unknown as { __pasasArcadeV?: string }).__pasasArcadeV === 'b' ? 'B' : 'A'
}

/**
 * s39 — El reto de hoy, cuando la página sirve OTRO: el más reciente de una
 * materia (/arcade?materia=historia, ver contenido.tsx). Con él, la portada
 * aclara que no es el de hoy y el resultado invita a jugar el de hoy.
 */
export type RetoDeHoy = { number: number; materia: string | null }

/**
 * s41 — Lo que pinta la oferta para el papá al terminar. Lo arma el servidor
 * (contenido.tsx) con los helpers de lib/promos, igual que la landing: el
 * cliente no decide precios ni textos. Con `listaTexto` null no hay campaña
 * y se ofrece la prueba de siempre.
 */
export type OfertaPapa = {
  slug: string | null
  badge: string | null
  listaTexto: string | null
  finalTexto: string | null
  despuesTexto: string | null
  cta: string
  micro: string
}

/** "Geografía" o "el reto para papás", para frases como "Hoy toca …". */
function nombreDeMateria(m: string | null | undefined): string {
  return m === 'papas' ? 'el reto para papás' : configMateria(m).nombre
}

// 🔴 localStorage puede no existir o lanzar (modo privado, datos bloqueados).
// El juego tiene que funcionar igual; solo se pierde el "ya jugaste hoy".
const llavePartida = (fecha: string, juego: JuegoArcade = 'sobra') =>
  juego === 'vom' ? `pasas-arcade:vom:${fecha}` : `pasas-arcade:partida:${fecha}`

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
  ofertaPapa = null,
  juego = 'sobra',
}: {
  reto: RetoArcade
  /** s47: qué juego trae `reto` ('vom' = Verdadero o mentira). Lo decide el servidor. */
  juego?: JuegoArcade
  dominio: string
  /** Lo fija la ruta: /arcade/r/... es siempre 'resultado_compartido'. */
  origenRuta?: OrigenArcade | null
  /** Solo cuando `reto` NO es el de hoy (reto por materia). */
  retoDeHoy?: RetoDeHoy | null
  /** Oferta para el papá al terminar (s41). Sin ella, no se pinta. */
  ofertaPapa?: OfertaPapa | null
}) {
  const conCuenta = useConCuenta()
  const [fase, setFase] = useState<Fase>('inicio')
  const [idx, setIdx] = useState(0)
  const [picks, setPicks] = useState<number[]>([])
  const [cifras, setCifras] = useState<CifrasArcade | null>(null)
  const [aviso, setAviso] = useState('')
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
  const varianteRef = useRef<Variante>('A')
  const [variante, setVariante] = useState<Variante>('A')
  const conOrigen = (evento: string, props: Record<string, unknown>) =>
    track(evento, {
      ...props,
      origen: origenRef.current,
      canal: atribRef.current.canal,
      por_materia: !!retoDeHoy,
      variant: varianteRef.current,
      juego,
    })

  // s40: la versión ya está en <html> (el script corrió antes de pintar). Se
  // pasa de 'inicio' a la fase de esa versión; si mientras tanto el efecto de
  // "ya jugó hoy" la llevó a 'end', se respeta.
  useEffect(() => {
    void (async () => {
      const v = leerVariante()
      varianteRef.current = v
      setVariante(v)
      // "Verdadero o mentira" no tiene portada: siempre directo a la ronda 1.
      setFase((f) => (f === 'inicio' ? (v === 'B' || juego === 'vom' ? 'play' : 'intro') : f))
    })()
  }, [juego])

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
      ya_jugo: !!leerLocal(llavePartida(reto.date, juego)),
      por_materia: !!retoDeHoy,
      variant: leerVariante(),
      juego,
    })
    // retoDeHoy viene del servidor y no cambia mientras la página vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenRuta, reto.number, reto.date])

  const resultados = useMemo(() => calcularResultados(reto, picks), [reto, picks])
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
            juego,
            ...atribRef.current,
          }),
        })
        const json = (await res.json()) as { cifras?: CifrasArcade | null }
        setCifras(json.cifras ?? null)
      } catch {
        // Sin red no hay cifras del día; el resultado propio ya está en pantalla.
      }
    },
    [reto.date, juego]
  )

  // ¿Ya jugó hoy en este navegador? Directo a su resultado.
  // Mismo patrón que usePromo: el estado se escribe desde la función async,
  // no en la pasada síncrona del efecto (react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => {
      const guardado = leerLocal(llavePartida(reto.date, juego))
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
  }, [reto.date, juego, enviarPartida])

  // Al llegar a cero, recarga: ya hay reto nuevo. Corre en todas las fases,
  // pero sin estado: el reloj que se ve vive en <RelojManana/> (solo en 'end'),
  // así el Arcade entero no se vuelve a pintar cada segundo.
  useEffect(() => {
    const tick = () => {
      if (segundosParaSiguienteReto() === 0) window.setTimeout(() => window.location.reload(), 3000)
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
   *
   * s40: en la versión B no hay botón de empezar, así que `arcade_iniciado`
   * sale con la PRIMERA respuesta (mismo significado: empezó a jugar). Y cada
   * respuesta dispara `arcade_ronda` { paso } para ver en qué ronda se va la
   * gente: visto → ronda 1 → ronda 2 → … → completado.
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
    if (fase === 'inicio') setFase('play')
    if (!partidaIniciadaRef.current) {
      partidaIniciadaRef.current = true
      conOrigen('arcade_iniciado', { reto_numero: reto.number })
    }
    conOrigen('arcade_ronda', { reto_numero: reto.number, paso: nuevos.length, acierto: i === reto.rounds[idx].odd })
    if (nuevos.length === RONDAS_POR_RETO) {
      escribirLocal(llavePartida(reto.date, juego), JSON.stringify(nuevos))
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

  const codigo = useMemo(() => codigoResultado(reto.number, resultados), [reto.number, resultados])
  const texto = useMemo(
    () => textoCompartir(reto.number, resultados, dominio, reto.materia, juego),
    [reto.number, resultados, dominio, reto.materia, juego]
  )

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
    // s47: las imágenes de /arcade/r pintan "¿Cuál sobra?"; en vom no aplican.
    if (fase !== 'end' || picks.length !== RONDAS_POR_RETO || juego === 'vom') return
    void fetch(`/arcade/r/${codigo}/imagen`).catch(() => {})
  }, [fase, picks.length, codigo, juego])

  useEffect(() => {
    if (fase !== 'end' || picks.length !== RONDAS_POR_RETO || juego === 'vom') return
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
  }, [fase, picks.length, codigo, reto.number, juego])

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
  // En 'inicio' la ronda 1 es de la versión B por definición (el CSS la
  // esconde en A). En 'play' se mira la versión real: en A, la ronda 1 no
  // lleva la cabecera de B.
  const varianteVisible = (f: Fase): Variante => (f === 'inicio' ? 'B' : variante)
  // s45 — Un solo acento para todas las materias: el verde azulado del reto
  // de Biología, que se lee mejor como "toca aquí". La materia sigue en
  // textos y emoji; mat.acento queda para lo que se comparte (imágenes).
  const estiloMateria = { '--acento': ACENTO_ARCADE.acento, '--sobre-acento': ACENTO_ARCADE.sobreAcento } as React.CSSProperties

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

        <script dangerouslySetInnerHTML={{ __html: scriptVariante(s.soloA, s.soloB) }} />

        {(fase === 'intro' || fase === 'inicio') && (
          <section className={`${s.screen} ${fase === 'inicio' ? s.soloA : ''}`}>
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

        {(fase === 'play' || fase === 'inicio') && (
          <div
            className={`${s.screen} ${fase === 'inicio' ? s.soloB : ''} ${
              idx === 0 && varianteVisible(fase) === 'B' ? s.compacto : ''
            }`}
          >
            {/* Versión B, ronda 1: lo mínimo para saber qué es, y a jugar.
                Compacta a propósito: en el navegador de Instagram (~600 px de
                alto, con el aviso de cookies abajo) las 4 opciones tienen que
                verse sin hacer scroll. */}
            {idx === 0 && varianteVisible(fase) === 'B' && (
              <div className={s.bHead}>
                <div className={s.eyebrow}>
                  <span aria-hidden="true">{mat.emoji}</span> {mat.eyebrow(reto.number)}
                </div>
                <div className={s.bFacts}>5 rondas · 2 min · gratis · sin registro</div>
              </div>
            )}
            <Ronda reto={reto} idx={idx} picks={picks} onResponder={responder} onSiguiente={siguiente} />
            {idx === 0 && picks.length === 0 && varianteVisible(fase) === 'B' && retoDeHoy && (
              <p className={s.fine}>
                Es el reto de {mat.corto} más reciente. Hoy toca {nombreDeMateria(retoDeHoy.materia)}: lo juegas al
                terminar este.
              </p>
            )}
          </div>
        )}

        {fase === 'end' && (
          <section className={s.screen}>
            {/* s40: el resultado va COMPACTO y arriba de todo lo que sigue va
                "seguir jugando" (el reto de hoy y la Horda). Antes, compartir,
                el repaso y el puntaje grande empujaban la Horda hasta el final
                y nadie llegaba a verla. */}
            <div className={`${s.scoreBlock} ${s.scoreCompact}`}>
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

            {/* s41 — Orden pensado para quien viene de un anuncio y ya está en
                modo juego: primero una SEGUNDA partida (la Horda del tema que
                falló, o el reto de hoy si vino por materia), luego el repaso
                plegado, el hábito (mañana), y hasta después PASAS y compartir. */}
            <Puente reto={reto} resultados={resultados} hayOferta={!!ofertaPapa && !conCuenta} />

            {retoDeHoy && <SigueConHoy reto={reto} retoDeHoy={retoDeHoy} />}

            <details className={s.respuestas}>
              <summary>Ver mis {RONDAS_POR_RETO} respuestas</summary>
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
            </details>

            {/* Mañana: con reto por materia no se sabe la fecha de hoy aquí, y
                el "mañana" saldría de la fecha del reto viejo. */}
            {!retoDeHoy && (
              <div className={s.manana}>
                <div className={s.mananaTitulo}>
                  Mañana toca {manana} <span aria-hidden="true">{configMateria(materiaDeManana(reto.date)).emoji}</span>
                </div>
                <div className={s.mananaReloj}>
                  Nuevo reto en <RelojManana />
                </div>
              </div>
            )}

            {FEATURE_FLAGS.ENABLE_ARCADE_RECORDATORIO && <RecordatorioForm />}

            {ofertaPapa && !conCuenta && <Oferta oferta={ofertaPapa} reto={reto} aciertos={aciertos} dominio={dominio} />}

            {/* Compartir al final y con menos peso que el siguiente juego. */}
            <div className={s.share}>
              <p className={s.shareTitulo}>
                ¿Le ganaste a tus amigos? Comparte tu {aciertos}/{RONDAS_POR_RETO}
              </p>
              <div className={s.row3}>
                {puedeCompartir && (
                  <button className={`${s.btn} ${s.ghost} ${s.btnChico}`} type="button" onClick={compartirNativo}>
                    Compartir
                  </button>
                )}
                <a
                  className={`${s.btn} ${s.wa} ${s.btnChico}`}
                  href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
                  target="_blank"
                  rel="noopener"
                  onClick={() => compartirClic('whatsapp')}
                >
                  WhatsApp
                </a>
                <button className={`${s.btn} ${s.ghost} ${s.btnChico}`} type="button" onClick={copiar}>
                  Copiar
                </button>
              </div>
              <div className={s.toast} role="status" aria-live="polite">
                {aviso}
              </div>
              {/* Fuera de la vista: es lo que se copia si el portapapeles falla. */}
              <pre className={`${s.sharePreview} ${s.srOnly}`} ref={refCompartir}>
                {texto}
              </pre>
            </div>
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

      {r.kind === 'vom' ? (
        <div className={s.prompt}>
          <h2>{NOMBRE_JUEGO.vom}</h2>
          <p className={s.frase}>{r.statement}</p>
        </div>
      ) : (
        <div className={s.prompt}>
          <h2>{NOMBRE_JUEGO.sobra}</h2>
          <p>Tres tienen algo en común. Toca el que no.</p>
        </div>
      )}

      <div className={`${s.options} ${r.kind === 'vom' ? s.optionsVom : ''}`}>
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
              className={`${s.opt} ${r.kind === 'year' ? s.optYear : ''} ${r.kind === 'vom' ? s.optVom : ''} ${estado}`}
              disabled={elegida !== null}
              onClick={() => onResponder(j)}
            >
              {r.kind === 'vom' && <span aria-hidden="true">{j === 0 ? '✅' : '❌'}</span>}
              {texto}
            </button>
          )
        })}
      </div>

      {elegida !== null && (
        <div className={s.reveal} aria-live="polite">
          <span className={`${s.verdict} ${ok ? s.verdictOk : s.verdictBad}`}>
            {ok ? '¡Correcto!' : r.kind === 'vom' ? `Era ${r.odd === 0 ? 'verdad' : 'mentira'}` : `Sobraba ${r.options[r.odd]}`}
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

/**
 * s41 — Oferta de PASAS al terminar, después de "seguir jugando" y del
 * reto de mañana. Le habla al que juega (casi siempre el alumno) y deja una
 * línea para el papá o la mamá, que es quien paga. Lleva al registro con el slug de la campaña pegado
 * (conPromo), así el descuento llega aunque el navegador de la app no guarde
 * nada.
 */
function Oferta({
  oferta,
  reto,
  aciertos,
  dominio,
}: {
  oferta: OfertaPapa
  reto: RetoArcade
  aciertos: number
  dominio: string
}) {
  // Menores de 18: la cuenta la abre un adulto (el registro lo exige). El
  // alumno le manda el mensaje armado; el link va a la landing, que le
  // explica PASAS al papá, con la campaña pegada.
  const sitio = dominio.replace(/\/+$/, '')
  const linkPapa = `${sitio}/?${new URLSearchParams({
    ...(oferta.slug ? { promo: oferta.slug } : {}),
    utm_source: 'whatsapp',
    utm_campaign: 'pidele-a-papa',
  }).toString()}`
  const precio =
    oferta.finalTexto && oferta.despuesTexto
      ? `Tiene 7 días gratis y luego ${oferta.finalTexto.replace(' primer mes', '')} el primer mes (${oferta.despuesTexto}).`
      : 'Tiene 7 días gratis.'
  const mensajePapa =
    `Hola, encontré PASAS para estudiar todas mis materias con minijuegos. ` +
    `Hoy saqué ${aciertos}/${RONDAS_POR_RETO} en su reto diario. ${precio} ¿Me abres la cuenta?\n${linkPapa}`
  const vista = useRef(false)
  useEffect(() => {
    if (vista.current) return
    vista.current = true
    track('arcade_oferta_vista', { reto_numero: reto.number, score: aciertos, promo: oferta.slug ?? undefined })
  }, [reto.number, aciertos, oferta.slug])
  return (
    <div className={s.oferta}>
      <h3>Practica así todas las materias de secundaria y prepa</h3>
      <p>Minijuegos, quizzes y explicaciones con anime, videojuegos, K-pop o fútbol.</p>
      {oferta.listaTexto && oferta.finalTexto && (
        <div className={s.ofertaPrecio}>
          {oferta.badge && <span className={s.ofertaBadge}>{oferta.badge}</span>}
          <div className={s.ofertaMonto}>
            <s>{oferta.listaTexto}</s> <b>{oferta.finalTexto}</b>
          </div>
          <div className={s.ofertaDespues}>{oferta.despuesTexto}</div>
        </div>
      )}
      <Link
        className={`${s.btn} ${s.ofertaBtn}`}
        href={conPromo('/onboarding', oferta.slug)}
        onClick={() =>
          track('arcade_oferta_clic', {
            reto_numero: reto.number,
            score: aciertos,
            promo: oferta.slug ?? undefined,
            origen: leerOrigenArcade() ?? undefined,
            canal: atribucionJuegos().canal,
          })
        }
      >
        {oferta.cta}
      </Link>
      <p className={s.ofertaMicro}>{oferta.micro}</p>
      <div className={s.ofertaMenor}>
        <p>¿Tienes menos de 18? La cuenta la abre tu mamá, papá o tutor. Te dejamos el mensaje listo:</p>
        <a
          className={`${s.btn} ${s.ghost} ${s.btnChico}`}
          href={`https://wa.me/?text=${encodeURIComponent(mensajePapa)}`}
          target="_blank"
          rel="noopener"
          onClick={() =>
            track('arcade_pedir_papa_clic', {
              reto_numero: reto.number,
              score: aciertos,
              promo: oferta.slug ?? undefined,
              canal: atribucionJuegos().canal,
            })
          }
        >
          Pedírselo por WhatsApp
        </a>
      </div>
    </div>
  )
}

/** s45 — El acento del Arcade, igual en todas las materias (ver estiloMateria). */
const ACENTO_ARCADE = { acento: MATERIAS.biologia.acento, sobreAcento: MATERIAS.biologia.sobreAcento }

/**
 * s42 — ¿Hay sesión de PASAS en este navegador? Quien ya tiene cuenta no ve la
 * oferta de $1. Se mira la cookie de Supabase y nada más: meter el cliente de
 * Supabase al bundle del reto para esto costaría más carga que lo que ahorra.
 * Si la cookie engaña (sesión vencida), lo peor es no ver la oferta.
 */
const SIN_SUSCRIPCION = () => () => {}

/**
 * Cuenta regresiva al siguiente reto. Hoja con su propio intervalo: solo ella
 * se vuelve a pintar cada segundo. Se monta en la fase 'end', que nunca sale
 * del servidor (el primer render es 'inicio'), así que arranca ya con la hora.
 */
function RelojManana() {
  const [reloj, setReloj] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : formatoReloj(segundosParaSiguienteReto())
  )
  useEffect(() => {
    const id = window.setInterval(() => setReloj(formatoReloj(segundosParaSiguienteReto())), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <b suppressHydrationWarning>{reloj ?? '--:--:--'}</b>
}
function useConCuenta(): boolean {
  return useSyncExternalStore(
    SIN_SUSCRIPCION,
    () => /(?:^|;\s*)sb-[^=]+-auth-token/.test(document.cookie),
    () => false
  )
}

function Puente({ reto, resultados, hayOferta = false }: { reto: RetoArcade; resultados: boolean[]; hayOferta?: boolean }) {
  const r = rondaDelPuente(reto, resultados)
  const perfecto = !resultados.includes(false)
  const aciertos = resultados.filter(Boolean).length
  const conHorda = r.horde_ready && esMateriaPublica(r.subject_slug)
  /**
   * s45 — "¿Quieres jugar más?": poco texto y un toque. Cada hobby entra
   * DIRECTO al tema ya explicado con él (sin la pantalla de elegir temática,
   * donde se quedaba gente). La Horda queda como liga secundaria.
   */
  const medir = (destino: 'tema' | 'horda', theme?: string) =>
    track(destino === 'tema' ? 'arcade_tema_clic' : 'arcade_puente_clic', {
      reto_numero: reto.number,
      tema: r.topic,
      perfecto,
      materia: r.materia ?? undefined,
      score: aciertos,
      destino,
      theme,
      origen: leerOrigenArcade() ?? undefined,
      canal: atribucionJuegos().canal,
    })

  return (
    <div className={s.bridge}>
      <div className={s.bridgeInner}>
        <h3>{perfecto ? '¡5 de 5! ¿Quieres jugar más?' : '¿Quieres jugar más?'}</h3>
        <p>
          {perfecto ? 'Aprende' : 'Fallaste en'} <b>{r.topic}</b>
          {perfecto ? ' con lo que te gusta:' : '. Apréndelo con lo que te gusta:'}
        </p>
        <div className={s.hobbies}>
          {TEMATICAS.map((t) => (
            <Link
              key={t.clave}
              className={s.hobby}
              href={urlTemaMuestra(r.subject_slug, r.topic_slug, { tematica: t.clave, perfecto })}
              onClick={() => medir('tema', t.clave)}
            >
              <span aria-hidden="true">{t.emoji}</span>
              {t.corto}
            </Link>
          ))}
        </div>
        <div className={s.hobbyNota}>Gratis · sin registrarte · con audio, minijuegos y quiz</div>
        {conHorda && (
          <Link className={s.link} href={urlHorda(r)} onClick={() => medir('horda')}>
            {perfecto ? `O sube de nivel en la Horda de ${r.topic}` : 'O practica en la Horda'}
          </Link>
        )}
        {!hayOferta && (
          <Link className={s.link} href="/">
            ¿Qué es PASAS?
          </Link>
        )}
      </div>
    </div>
  )
}
