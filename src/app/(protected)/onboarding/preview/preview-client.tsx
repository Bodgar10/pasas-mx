'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PLAN_DISPLAY } from '@/lib/payments/config'
import Logo from '@/components/global/Logo'
import Pasita from '@/components/mascota/Pasita'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import { conPromo } from '@/lib/promos'

/**
 * LA FRASE DE "ASÍ APRENDERÍAS" — POR NIVEL, GRADO Y TEMÁTICA
 * ---------------------------------------------------------------------------
 * 🔴 ANTES ERA UNA SOLA FRASE POR TEMÁTICA, para las 21 combinaciones. A un
 * alumno de 1° de secundaria se le prometía "las derivadas" —que son de 3° de
 * prepa, tres años después— y a uno de 3° de prepa, "ecuaciones lineales", que
 * son de 1° de secundaria. Ninguna de las cuatro frases era correcta para más
 * de dos de las ocho casillas de su temática.
 *
 * Esta es la última pantalla antes de /planes: un padre que sabe de
 * matemáticas leía "derivadas" en secundaria y concluía, con razón, que no
 * conocemos el temario.
 *
 * 🔴 CADA FRASE ESTÁ VERIFICADA CONTRA LA BASE. No basta con que el tema sea
 * del grado correcto: tiene que existir el `topic` de esa materia y ese grado,
 * Y tener secciones publicadas en las cuatro temáticas. Se midió tema por tema
 * (9-10 secciones por casilla, sin huecos). Si algún día se propone una frase
 * nueva, se comprueba igual antes: una promesa concreta sin contenido detrás
 * es el problema que preview_stats cerró en s26.
 *
 * 🔴 SIN MARCAS. Vocabulario genérico, el mismo de la landing: "mundo de
 * bloques", "battle royale", "tu grupo favorito", "tu liga". Esta pantalla es
 * pre-registro y accesible sin sesión, así que cuenta como material
 * promocional.
 */

type TemaKey = 'videojuegos' | 'kpop' | 'futbol' | 'anime'
type FrasesPorTema = Record<TemaKey, string>

/**
 * 🔴 EL MATCH DE TEMÁTICA ES EXPLÍCITO, NO POR SUBCADENA.
 *
 * Antes era `Object.keys(...).find((k) => theme.includes(k))`, y funcionaba de
 * casualidad: en la base las temáticas se llaman "K-pop & K-dramas" y
 * "Anime & Manga", y el `includes` las capturaba porque el nombre corto es
 * prefijo del largo. Bastaba con que alguien renombrara una temática desde
 * admin —"K-Pop", "Anime/Manga", "Fut"— para que la frase cayera al fallback
 * sin un solo error visible.
 *
 * Ahora los alias se declaran a mano y se comparan normalizados (sin
 * mayúsculas ni espacios de sobra). Lo que no esté aquí es desconocido, y lo
 * desconocido va a la frase genérica — nunca a una promesa equivocada.
 */
const ALIAS_TEMA: Record<string, TemaKey> = {
  'videojuegos': 'videojuegos',
  'k-pop & k-dramas': 'kpop',
  'k-pop': 'kpop',
  'kpop': 'kpop',
  'fútbol': 'futbol',
  'futbol': 'futbol',
  'anime & manga': 'anime',
  'anime': 'anime',
}

function temaCanonico(theme: string): TemaKey | null {
  return ALIAS_TEMA[theme.trim().toLowerCase()] ?? null
}

/** Claves de nivel: las etiquetas que manda el onboarding, tal cual. */
const EJEMPLOS: Record<string, Record<string, FrasesPorTema>> = {
  Secundaria: {
    // Ecuaciones lineales — Matemáticas 1°
    '1°': {
      videojuegos: 'Ecuaciones lineales con la economía de un mundo de bloques',
      kpop:        'Ecuaciones lineales con los horarios de ensayo de tu grupo favorito',
      futbol:      'Ecuaciones lineales con las estadísticas de tu equipo',
      anime:       'Ecuaciones lineales con el entrenamiento de tu personaje favorito',
    },
    // Sistemas de dos ecuaciones — Matemáticas 2°
    '2°': {
      videojuegos: 'Sistemas de dos ecuaciones con el crafteo de un mundo de bloques',
      kpop:        'Sistemas de dos ecuaciones con la gira de tu grupo favorito',
      futbol:      'Sistemas de dos ecuaciones con los fichajes de tu liga',
      anime:       'Sistemas de dos ecuaciones con los arcos de tu serie favorita',
    },
    // Teorema de Pitágoras — Matemáticas 3°
    '3°': {
      videojuegos: 'El teorema de Pitágoras con las diagonales de un mundo de bloques',
      kpop:        'El teorema de Pitágoras con la coreografía en el escenario',
      futbol:      'El teorema de Pitágoras con los tiros libres de tu liga',
      anime:       'El teorema de Pitágoras con los cortes de espada de tu serie favorita',
    },
  },
  'Preparatoria / Bachillerato': {
    // Factorización — Matemáticas I (Álgebra)
    '1°': {
      videojuegos: 'Factorización con el inventario de un battle royale',
      kpop:        'Factorización con los ensayos de tu grupo favorito',
      futbol:      'Factorización con las tablas de posiciones de tu liga',
      anime:       'Factorización con los poderes de tu personaje favorito',
    },
    // Funciones cuadráticas — Matemáticas IV (Funciones)
    '2°': {
      videojuegos: 'Funciones cuadráticas con la trayectoria de un proyectil en el juego',
      kpop:        'Funciones cuadráticas con las ventas de un álbum semana a semana',
      futbol:      'Funciones cuadráticas con la parábola de un tiro libre',
      anime:       'Funciones cuadráticas con el salto de tu personaje favorito',
    },
    // La derivada: definición e interpretación — Cálculo Diferencial.
    // La ÚNICA casilla donde "derivadas" es honesto.
    '3°': {
      videojuegos: 'Las derivadas explicadas con las mecánicas de un mundo de bloques',
      kpop:        'Las derivadas con la curva de streams de un lanzamiento',
      futbol:      'Las derivadas con la aceleración en un contragolpe',
      anime:       'Las derivadas con la velocidad de un combate',
    },
  },
}

/**
 * 🔴 FRASES DE RESERVA. No nombran ningún tema.
 *
 * Los niveles de examen entran SIN grado (needsGrade: false en el onboarding),
 * así que no hay casilla que resolver; y sus materias —"Matemáticas COMIPEMS",
 * "Cálculo"— no existen como `subjects` en la base. Es la única combinación
 * sin respaldo, y ahí se prefiere no prometer nada concreto.
 *
 * El default cubre lo que todavía no existe: un grado nuevo, un nivel nuevo o
 * una temática que alguien dé de alta desde admin. Agregar una temática NO
 * puede romper esta pantalla ni producir una promesa falsa.
 */
const GENERICA_POR_NIVEL: Record<string, string> = {
  'Examen de Preparatoria': 'Repaso de matemáticas para tu examen, con la temática que elegiste.',
  'Examen de Universidad':  'Repaso de matemáticas para tu examen, con la temática que elegiste.',
}
const GENERICA_DEFAULT = 'Todo el temario de tu grado, con la temática que elegiste.'

function frasePorDefecto(level: string): string {
  return GENERICA_POR_NIVEL[level] ?? GENERICA_DEFAULT
}

/**
 * La frase de la tarjeta. Cae a la genérica —nunca revienta, nunca inventa—
 * si falta el nivel, el grado o la temática, o si alguno no está en la tabla.
 */
function getExampleTitle(level: string, grade: string | null, theme: string): string {
  const tema = temaCanonico(theme)
  if (!tema) return frasePorDefecto(level)

  const porGrado = EJEMPLOS[level]?.[grade ?? '']
  if (!porGrado) return frasePorDefecto(level)

  return porGrado[tema] ?? frasePorDefecto(level)
}

/**
 * 🔴 `bloqueStats` llega YA RENDERIZADO desde el servidor (page.tsx). No es
 * un componente que este archivo monte: es markup terminado que se coloca en
 * su sitio. Por eso aquí no queda ni fetch, ni estado de carga, ni la lógica
 * de "ocultar si no hay datos" — todo eso vive del lado servidor, que es
 * donde están los números.
 *
 * `null` significa "no hay bloque": el server ya decidió que no hay nada que
 * enseñar y aquí no se pinta nada en su lugar.
 */
function PreviewContent({ bloqueStats }: { bloqueStats: React.ReactNode }) {
  // 🔴 useSearchParams SE QUEDA. Es lo que alimenta conPromo() en el CTA de
  // más abajo: el ?promo= tiene que seguir viajando a /planes o se rompe el
  // embudo de campaña. Que el bloque de stats se haya ido al servidor no
  // cambia nada aquí.
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ?? ''
  const grade = searchParams.get('grade')
  const theme = searchParams.get('theme') ?? ''
  const esTutor = searchParams.get('registrante') === 'tutor'

  const exampleTitle = getExampleTitle(level, grade, theme)

  const personalizedParams = new URLSearchParams({ level })
  if (grade) personalizedParams.set('grade', grade)
  personalizedParams.set('theme', theme)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px 40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 390 }}>

        {/* A) Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, color: '#a78bfa' }}>
          <Logo size={22} />
          <p
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.2em',
              margin: 0,
            }}
          >
            PASAS.MX
          </p>
        </div>

        {/* B) Context pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <span
            style={{
              backgroundColor: '#2d1b69',
              color: '#a78bfa',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {level}
          </span>
          {grade && (
            <span
              style={{
                backgroundColor: '#2d1b69',
                color: '#a78bfa',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 999,
                padding: '4px 12px',
              }}
            >
              {grade}
            </span>
          )}
          <span
            style={{
              backgroundColor: '#1a0f00',
              color: '#fbbf24',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {theme}
          </span>
        </div>

        {/* La Pasita presentando lo que viene. Es el momento en que el
            visitante ve por primera vez qué contiene su grado, así que la
            pose confiada acompaña sin celebrar todavía. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <Pasita pose="confiada" size={100} animacion="flotar" />
        </div>

        {/* C) Main preview card */}
        <div
          style={{
            backgroundColor: '#1a1035',
            border: '1.5px solid #2D2048',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 999,
              padding: '3px 12px',
              marginBottom: 14,
            }}
          >
            Vista previa
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-orbitron)',
              fontSize: 24,
              fontWeight: 900,
              color: '#e2d9f3',
              margin: '0 0 8px',
            }}
          >
            {esTutor ? 'Así aprendería' : 'Así aprenderías tú'}
          </h2>

          <p
            style={{
              fontSize: 16,
              color: '#a78bfa',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            {exampleTitle}
          </p>

          <div style={{ height: 1, backgroundColor: '#2D2048', marginBottom: 16 }} />

          {/*
            Lo que incluye — números reales de la base.

            Llega renderizado desde el servidor, envuelto en su propio
            <Suspense>: si toca miss de caché se transmite después, y mientras
            tanto se ve el esqueleto. En un hit viene en el HTML inicial.

            Si el server decidió que no hay nada que enseñar, esto es null y
            aquí no queda ni hueco ni rótulo.
          */}
          {bloqueStats}

          {/* Lock row */}
          <div
            style={{
              backgroundColor: '#0d1f0d',
              border: '1px solid rgba(16,185,129,0.19)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              fontWeight: 700,
              color: '#10b981',
            }}
          >
            🔒 Desbloquea todos los temas con el plan
          </div>
        </div>

        {/* D) CTA section */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => router.push(conPromo('/planes?plan=estandar', searchParams.get('promo')))}
              style={{
                width: '100%',
                minHeight: 52,
                backgroundColor: '#7c3aed',
                borderRadius: 12,
                border: 'none',
                fontWeight: 900,
                fontSize: 16,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Ver planes — todas las materias →
            </button>
            <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Matemáticas, Español, Historia, Ciencias y más · Desde ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount}/mes
            </p>
          </div>

          {FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && (
          <>
          <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', margin: '16px 0' }}>
            {esTutor ? '¿Le falla solo una materia?' : '¿Te falla solo una materia?'}
          </p>

          <div>
            <button
              type="button"
              onClick={() => router.push(`/personalizado/materia?${personalizedParams.toString()}`)}
              style={{
                width: '100%',
                minHeight: 52,
                backgroundColor: 'transparent',
                borderRadius: 12,
                border: '1.5px solid #ec4899',
                fontWeight: 800,
                fontSize: 17,
                color: '#ec4899',
                cursor: 'pointer',
              }}
            >
              {/*
                🔴 Antes decía "Quiero guías solo de {subject} →", con subject
                salido de getSubject(): 'Matemáticas COMIPEMS' o 'Cálculo' en
                los niveles de examen. Ninguna de las dos existe como materia
                en la base —las de prepa son "Cálculo Diferencial" y "Cálculo
                Integral", y no hay nada llamado COMIPEMS—, así que el botón
                nombraba un destino inexistente.

                No se cambió por el nombre real de la base porque no hay UNO:
                depende del grado, y en los niveles de examen no hay ninguno
                que corresponda. Además el destino es /personalizado/materia,
                que es precisamente el SELECTOR de materia: nombrarla aquí
                adelanta una elección que el usuario todavía no ha hecho.
              */}
              Quiero guías de una sola materia →
            </button>
            <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', margin: '6px 0 0' }}>
              Una sola materia, adaptada exactamente a lo que {esTutor ? 'le' : 'te'} falla · Desde ${PLAN_DISPLAY.personalizado_v2.prices.mensual.amount}/mes
            </p>
          </div>
          </>
          )}
        </div>

        {/* E) Trust line */}
        <p style={{ fontSize: 14, color: '#a78bfa', textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
          7 días gratis · No se cobra hasta el día 8 · Cancela cuando quieras
        </p>

      </div>
    </div>
  )
}

export default function PreviewClient({ bloqueStats }: { bloqueStats: React.ReactNode }) {
  // <Suspense> por useSearchParams, igual que antes.
  return (
    <Suspense>
      <PreviewContent bloqueStats={bloqueStats} />
    </Suspense>
  )
}
