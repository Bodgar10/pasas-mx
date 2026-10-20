import s from './HuecoPromo.module.css'

/**
 * El hueco que ocupa un contenido que todavía no se puede pintar: un precio o
 * un CTA mientras se sabe si hay campaña, o el bloque de conteos de
 * /onboarding/preview mientras llegan los números.
 *
 * 🔴 SU ÚNICO TRABAJO ES MEDIR LO MISMO QUE EL CONTENIDO FINAL. Si mide
 * distinto, el flash de copy se cambia por un salto de layout y no se arregló
 * nada. Por eso no tiene dimensiones propias: `alto`, `ancho` y `radio` los
 * pasa quien lo usa, copiados del elemento que sustituye.
 *
 * 🔴 NADA de spinners ni de "Cargando...". Un texto que luego se reemplaza es
 * exactamente el problema que esto viene a resolver; y un spinner sobre un
 * precio invita a leerlo como un error. Solo un bloque tenue que late.
 *
 * `aria-hidden` porque no comunica nada: quien use lector de pantalla oirá el
 * precio y el botón cuando existan, no un "cargando" que no puede accionar.
 */
export function Hueco({
  alto,
  ancho = '100%',
  radio,
  margenAbajo,
}: {
  /** Copiado del `minHeight`/altura de línea del elemento real. */
  alto: number
  ancho?: number | string
  /** Copiado del `borderRadius` del elemento real. */
  radio: number
  margenAbajo?: number
}) {
  return (
    <div
      aria-hidden="true"
      className={s.hueco}
      style={{
        height: alto,
        width: ancho,
        borderRadius: radio,
        marginBottom: margenAbajo,
        // Tenue a propósito: tiene que leerse como "aquí va algo", no como un
        // componente vacío ni como un error.
        background: 'rgba(167,139,250,0.10)',
      }}
    />
  )
}
