'use client'

import { useState } from 'react'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'

/**
 * Demo interactivo de Papel y Lápiz para la landing.
 *
 * No es un GIF ni un video: es la mecánica real, jugable. Quien lo prueba ya
 * vivió el producto antes de registrarse. Pesa unos KB en vez de los megas de
 * un GIF, no se pixela y funciona en móvil sin autoplay.
 *
 * 🔴 ESPEJO DE SolveBlock (src/components/guia/InteractiveBlocks.tsx:683). Si
 * el demo enseña una mecánica que el producto no tiene, es publicidad
 * engañosa; si esconde una que sí tiene, se vende de menos. Durante meses hizo
 * lo segundo: aquí solo salía pista al FALLAR, cuando el producto siempre tuvo
 * un botón para pedirla sin haberse equivocado, y además ofrece la solución
 * completa al agotarlas. El demo mostraba una versión peor que el producto.
 *
 * Lo que se replicó, línea por línea contra el original:
 *   · el botón 💡, su texto según cuántas pistas lleves y su desaparición
 *   · un solo contador: pedir y fallar consumen la MISMA lista, en orden
 *   · el mensaje de "ya viste todas las pistas"
 *   · la salida por "Ver la respuesta completa"
 *
 * Lo que NO se replicó, a propósito: la tanda de varios ejercicios, el
 * `Revisar` a lo ancho, la paleta ámbar de las pistas y el parseo tolerante de
 * la respuesta. Son cosméticos o estructurales, no cambian lo que se promete.
 */

const RESPUESTA = 66

const PISTAS = [
  'Empieza por el total. Son 3 ranuras y cada una guarda 27 bloques.',
  '3 × 27 = 81 bloques en total. Ahora quítale los que sacaste.',
  'La operación completa es: 81 − 15',
]

/**
 * El paso a paso, equivalente al `solution` de SolveBlock. Es lo ÚNICO que
 * cierra la cuenta: las pistas dejan al alumno a una operación, esto la
 * resuelve. Solo se ve tras agotar las pistas y pedirlo.
 */
const SOLUCION = ['3 × 27 = 81 bloques en total', '81 − 15 = 66 bloques']

export default function DemoPistas({ onIntento }: { onIntento?: () => void }) {
  const [valor, setValor] = useState('')
  const [pistas, setPistas] = useState(0)
  // Mismos cuatro estados que SolveBlock. `fallo` era un booleano suelto que
  // no sabía distinguir "fallaste y quedan pistas" de "fallaste y ya no".
  const [estado, setEstado] = useState<'escribiendo' | 'acierto' | 'fallo' | 'solucion'>('escribiendo')

  const pistasRestantes = PISTAS.length - pistas
  const acertado = estado === 'acierto'

  function revisar() {
    const n = Number(valor.replace(',', '.'))
    onIntento?.()

    if (!valor.trim() || Number.isNaN(n)) return

    if (n === RESPUESTA) {
      setEstado('acierto')
      return
    }

    // 🔴 UN SOLO CONTADOR. Fallar consume la siguiente pista de la MISMA lista
    // que consume el botón de pedirla, en el mismo orden. No hay dos caminos:
    // es exactamente el `setShown` compartido de SolveBlock:719 y :870.
    setEstado('fallo')
    setPistas((p) => Math.min(p + 1, PISTAS.length))
  }

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1.5px solid ${COLORS.primary}44`,
        borderRadius: RADIUS.xxl,
        padding: '22px 20px',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: COLORS.primary,
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}
      >
        Pruébalo aquí
      </p>

      {/*
        ⚠️ LOS NÚMEROS NO SE TOCAN: 3 ranuras × 27 = 81, −15 = 66. Las tres
        pistas y el paso a paso están escritos sobre ellos; cambiar uno los
        rompe todos.

        El contexto narrativo sí cambió en su momento —era "un cofre de
        Minecraft"— porque la landing es material promocional y citar la marca
        ahí es uso comercial ajeno. "Inventario", "ranuras" y "bloques" son
        vocabulario genérico de videojuegos.
      */}
      <p style={{ fontSize: 16, color: COLORS.text, lineHeight: 1.6, margin: '0 0 18px', fontWeight: 600 }}>
        En tu inventario tienes 3 ranuras llenas y cada una guarda 27 bloques.
        Si sacas 15 bloques, ¿cuántos quedan?
      </p>

      {!acertado && estado !== 'solucion' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            inputMode="numeric"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value)
              // Editar la respuesta devuelve al estado de escritura, igual que
              // en SolveBlock:815. Es lo que hace reaparecer el botón de pista.
              if (estado === 'fallo') setEstado('escribiendo')
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') revisar() }}
            placeholder="Tu respuesta"
            aria-label="Tu respuesta"
            style={{
              flex: 1,
              minHeight: 48,
              background: COLORS.card2 ?? '#1C1033',
              border: `1.5px solid ${estado === 'fallo' ? '#f87171' : COLORS.inputBorder}`,
              borderRadius: RADIUS.lg,
              padding: '0 14px',
              color: COLORS.text,
              fontFamily: FONTS.nunito,
              fontSize: 16,
              fontWeight: 700,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={revisar}
            style={{
              minHeight: 48,
              padding: '0 20px',
              background: COLORS.primary,
              border: 'none',
              borderRadius: RADIUS.lg,
              color: '#fff',
              fontFamily: FONTS.nunito,
              fontWeight: 900,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {estado === 'fallo' ? 'Volver a intentar' : 'Revisar'}
          </button>
        </div>
      )}

      {/*
        🔴 EL BOTÓN QUE FALTABA. Copia de SolveBlock:867-886.

        · El texto cambia con el contador: "Necesito una pista" a las cero,
          "Dame otra pista" a partir de la primera.
        · Estilo secundario a propósito —transparente, sin borde, ámbar, más
          bajo que Revisar—: es una salida disponible, no la acción principal.
        · DESAPARECE al agotarse. No se deshabilita: deja de renderizarse, que
          es lo que hace el `{hintsLeft > 0 && …}` del original.
        · Solo en estado de escritura, como en el real: tras fallar, el hueco
          lo ocupa el mensaje de error.
      */}
      {estado === 'escribiendo' && pistasRestantes > 0 && (
        <button
          type="button"
          onClick={() => setPistas((p) => Math.min(p + 1, PISTAS.length))}
          style={{
            width: '100%',
            minHeight: 40,
            marginTop: -6,
            marginBottom: 12,
            background: 'transparent',
            border: 'none',
            color: '#fbbf24',
            fontFamily: FONTS.nunito,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          💡 {pistas === 0 ? 'Necesito una pista' : 'Dame otra pista'}
        </button>
      )}

      {acertado && (
        <div
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: RADIUS.lg,
            padding: '14px 16px',
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 16, color: COLORS.success, fontWeight: 800, margin: 0 }}>
            ✓ Eso es. 66 bloques.
          </p>
          <p style={{ fontSize: 14, color: COLORS.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
            {pistas === 0
              ? 'Y lo sacaste sin pistas.'
              : 'Lo sacaste tú. Las pistas solo te empujaron.'}
          </p>
        </div>
      )}

      {/* Las pistas se apilan, no se reemplazan: se ve cómo va bajando el andamio */}
      {estado !== 'solucion' && PISTAS.slice(0, pistas).map((pista, i) => (
        <div
          key={i}
          style={{
            background: `${COLORS.primary}12`,
            borderLeft: `3px solid ${COLORS.primary}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 8,
            animation: 'fadeUp 0.35s ease both',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary, margin: '0 0 2px' }}>
            Pista {i + 1}
          </p>
          <p style={{ fontSize: 15, color: COLORS.text, margin: 0, lineHeight: 1.5 }}>
            {pista}
          </p>
        </div>
      ))}

      {/*
        🔴 EL CALLEJÓN SIN SALIDA, CERRADO.

        Antes decía "Sin regaños. Solo otra pista." para siempre — incluso tras
        la tercera, cuando ya no venía ninguna. Prometía una pista inexistente y
        no había forma de terminar salvo acertar.

        Ahora son los dos mensajes del producto (SolveBlock:960-962), y al
        agotarse aparece la salida real.
      */}
      {estado === 'fallo' && (
        <p style={{ fontSize: 13, color: COLORS.muted, margin: '10px 0 0', opacity: 0.85 }}>
          {pistasRestantes > 0
            ? '✗ Todavía no. Te dejé una pista arriba — inténtalo otra vez.'
            : '✗ No es esa. Ya viste todas las pistas.'}
        </p>
      )}

      {estado === 'fallo' && pistasRestantes === 0 && (
        <button
          type="button"
          onClick={() => setEstado('solucion')}
          style={{
            width: '100%',
            minHeight: 40,
            marginTop: 10,
            background: 'transparent',
            border: 'none',
            color: COLORS.muted,
            fontFamily: FONTS.nunito,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ver la respuesta completa
        </button>
      )}

      {estado === 'solucion' && (
        <div
          style={{
            background: `${COLORS.primary}1F`,
            border: `1px solid ${COLORS.primary}4D`,
            borderRadius: RADIUS.lg,
            padding: 14,
          }}
        >
          <p style={{ fontSize: 12, color: COLORS.primary, fontWeight: 800, letterSpacing: '0.05em', margin: '0 0 10px' }}>
            PASO A PASO
          </p>
          {SOLUCION.map((paso, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: `${COLORS.primary}4D`,
                  color: COLORS.text,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONTS.orbitron,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.5, fontWeight: 600 }}>
                {paso}
              </span>
            </div>
          ))}
          <p style={{ fontSize: 14, color: COLORS.success, fontWeight: 800, margin: '10px 0 0' }}>
            Resultado: 66 bloques
          </p>
        </div>
      )}
    </div>
  )
}
