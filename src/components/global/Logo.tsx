/**
 * Isotipo de Pasas.mx.
 *
 * El SVG va incrustado, no como <img>: así hereda el color por `currentColor`,
 * no cuesta una petición extra y se puede animar.
 *
 * La palomita es un HUECO, no una forma blanca encima. Se logra con los dos
 * subtrazos del mismo `d` girando en sentidos opuestos. Si algún día alguien
 * separa ese path en dos, la palomita dejará de ser transparente y el logo se
 * romperá sobre cualquier fondo que no sea el previsto. No lo separes.
 */

const ISOTIPO_PATH =
  'M283.619 32H110.305C90.8787 32 75 47.8238 75 67.561V445.97C75 450.735 76.1825 479.83 102.196 479.83C106.757 479.83 117.062 479.319 122.467 475.916C126.183 473.534 194.597 427.084 194.597 427.084C198.82 424.021 201.354 418.406 202.367 413.132V374.338H270.274C271.794 374.338 273.146 374.338 274.666 374.338C358.958 372.126 427.203 306.959 437.169 224.267V181.73C427.203 101.25 362.843 38.4656 283.619 32ZM334.802 189.387L244.26 280.586C244.26 280.586 243.753 281.097 243.584 281.267C243.415 281.607 243.077 281.777 242.909 282.118L241.219 283.819C231.084 294.028 214.53 294.028 204.225 283.819L158.616 237.879C148.481 227.67 148.481 210.996 158.616 200.617L160.306 198.915C170.441 188.706 186.995 188.706 197.3 198.915L222.638 224.438L296.119 150.423C305.579 140.895 320.782 140.895 330.241 150.423L334.802 155.017C344.262 164.545 344.262 179.859 334.802 189.387Z'

export default function Logo({
  size = 40,
  className,
  title = 'Pasas.mx',
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      style={{ display: 'block' }}
    >
      <path d={ISOTIPO_PATH} fill="currentColor" />
    </svg>
  )
}
