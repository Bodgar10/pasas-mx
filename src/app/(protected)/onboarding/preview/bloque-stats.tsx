import { Hueco } from '@/components/global/HuecoPromo'
import { leerStats, statsUtilizables, type Nivel } from '@/lib/preview-stats'

/**
 * "LO QUE VAS A ENCONTRAR" — componente de SERVIDOR.
 *
 * 🔴 Antes esto vivía en el cliente y pedía los números con un fetch dentro de
 * un useEffect. Medido: con la caché caliente el endpoint responde en 3-6ms,
 * y aun así el bloque tardaba 1-2s en pintarse, porque el camino real era
 * navegación → bundle → hidratación → fetch → pintado. La query nunca fue el
 * problema; la cascada sí.
 *
 * Ahora los números se leen en el servidor y viajan YA RENDERIZADOS en el
 * HTML. El componente es async y va envuelto en <Suspense>, así que el resto
 * de la pantalla —ejemplo, temática, CTA— no espera por él: si toca un miss de
 * caché, se transmite después y mientras tanto se ve el esqueleto.
 *
 * `Fila` se mudó aquí desde el cliente: no tiene estado ni handlers, así que
 * como componente de servidor no manda ni un byte de JS al navegador.
 */

function Fila({
  emoji,
  titulo,
  detalle,
}: {
  emoji: string
  titulo: string
  detalle: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        backgroundColor: '#1a1035',
        borderLeft: '2px solid #7c3aed',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1.2 }}>{emoji}</span>
      <div>
        <p style={{ fontSize: 15, color: '#e2d9f3', fontWeight: 700, margin: 0 }}>
          {titulo}
        </p>
        <p style={{ fontSize: 13, color: '#a78bfa', margin: '2px 0 0', lineHeight: 1.4 }}>
          {detalle}
        </p>
      </div>
    </div>
  )
}

/** La caja exterior, idéntica en el esqueleto y en el contenido real. */
function Marco({ esTutor, children }: { esTutor: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: '#0f0a1e',
        border: '1px solid #2D2048',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <p
        style={{
          fontSize: 12,
          color: '#7c3aed',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}
      >
        {esTutor ? 'LO QUE VA A ENCONTRAR' : 'LO QUE VAS A ENCONTRAR'}
      </p>
      {children}
    </div>
  )
}

/**
 * Red de seguridad, no el camino normal.
 *
 * Es el `fallback` del <Suspense>: solo se ve mientras el servidor resuelve un
 * miss de caché (~930ms medidos), y nunca en un hit (~5ms). Antes se veía
 * siempre, porque el fetch no arrancaba hasta después de hidratar.
 *
 * 🔴 Las medidas copian la forma real del contenido: cabecera de 72 con 10 de
 * margen, y cuatro filas de 58 con gap 8. Con las cuatro cajas de 46 que había
 * antes, el bloque medía 208px contra los ~338 del contenido y la tarjeta
 * pegaba un salto de 130px al llegar los datos.
 */
export function EsqueletoStats({ esTutor }: { esTutor: boolean }) {
  return (
    <Marco esTutor={esTutor}>
      {/* Desaparece con los datos: no es un encabezado, es el aviso de que se
          está contando. */}
      <p style={{ fontSize: 13, color: '#a78bfa', margin: '0 0 10px', fontWeight: 600 }}>
        Sacando la cuenta de tu grado…
      </p>
      <Hueco alto={72} radio={10} margenAbajo={10} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <Hueco key={i} alto={58} radio={8} />
        ))}
      </div>
    </Marco>
  )
}

export default async function BloqueStats({
  nivel,
  grado,
  grade,
  level,
  esTutor,
}: {
  nivel: Nivel
  grado: number
  /** La etiqueta del grado tal como la eligió el usuario ("2°"), para el copy. */
  grade: string | null
  level: string
  esTutor: boolean
}) {
  const stats = await leerStats(nivel, grado)

  /**
   * 🔴 SI NO HAY NÚMEROS, NO HAY BLOQUE — rótulo incluido.
   *
   * Cubre dos de los tres caminos: lectura fallida (RPC en error, devuelve
   * null) y cero temas (statsUtilizables). El tercero —nivel sin grado, que es
   * el caso de los niveles de examen— se resuelve antes, en page.tsx, que ni
   * siquiera llega a montar este componente.
   *
   * Devolver null aquí es lo correcto y no deja hueco: el <Suspense> de arriba
   * también desaparece con él.
   */
  if (!statsUtilizables(stats)) return null

  return (
    <Marco esTutor={esTutor}>
      {/* Cabecera con el alcance del grado */}
      <div
        style={{
          backgroundColor: '#1a1035',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: 22,
            fontWeight: 900,
            color: '#e2d9f3',
            margin: 0,
          }}
        >
          {stats.materias} materias · {stats.temas} temas
        </p>
        <p style={{ fontSize: 13, color: '#a78bfa', margin: '4px 0 0' }}>
          para {grade ? `${grade} de ` : ''}
          {level.startsWith('Examen') ? 'tu examen' : level.split(' / ')[0]}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Fila
          emoji="⚡"
          titulo="Lecciones interactivas"
          detalle={`${stats.interactivos.toLocaleString('es-MX')} ejercicios para arrastrar, ordenar y resolver`}
        />
        {stats.horda_preguntas > 0 && (
          <Fila
            emoji="🧟"
            titulo="Modo Horda"
            detalle={`${stats.horda_preguntas.toLocaleString('es-MX')} preguntas por oleadas en ${stats.horda_temas} temas`}
          />
        )}
        {stats.papel_lapiz > 0 && (
          <Fila
            emoji="✏️"
            titulo="Papel y Lápiz"
            detalle={`${stats.papel_lapiz.toLocaleString('es-MX')} ejercicios con pistas paso a paso`}
          />
        )}
        {stats.audios > 0 && (
          <Fila
            emoji="🎧"
            titulo="Audio"
            detalle={`${stats.audios.toLocaleString('es-MX')} lecciones narradas para escuchar`}
          />
        )}
      </div>
    </Marco>
  )
}
