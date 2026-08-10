/**
 * FUENTE ÚNICA de la Pasita.
 *
 * El personaje NO es una imagen: son 52 piezas SVG que se apilan en pantalla.
 * Así el parpadeo es intercambiar dos archivos de 1 KB en vez de exportar
 * cientos de frames, y cambiar un color no obliga a reexportar nada.
 *
 * Las coordenadas salieron de la guía en PDF de Samuel, comparando cada pieza
 * contra el dibujo compuesto. Las de `ANCLAS` concuerdan en varias páginas;
 * las de los brazos son propias de cada pose porque los brazos se mueven.
 *
 * 🔴 Los nombres de carpeta son EXACTOS, tal como los exportó Samuel:
 * 'Cuerpo', 'Ojos', 'Brazos', 'Cejas', 'Boca', 'Sombra', 'Aura' con mayúscula
 * y 'pies' en minúscula. macOS no distingue mayúsculas pero Vercel corre en
 * Linux y sí: si se "corrige" el caso aquí, funciona en local y truena en
 * producción con un 404 silencioso.
 */

/** Lienzo del cuerpo. Todas las coordenadas son relativas a su esquina. */
export const LIENZO = { w: 114, h: 181 } as const

/**
 * Márgenes para que quepan los brazos y la sombra, que sobresalen del cuerpo.
 * El brazo del lápiz llega a x=-47 y el zombie a x=-54, de ahí el margen
 * izquierdo generoso.
 */
export const MARGEN = { x: 60, y: 20 } as const

export const VIEWBOX = {
  x: -MARGEN.x,
  y: -MARGEN.y,
  w: LIENZO.w + MARGEN.x * 2,
  h: LIENZO.h + MARGEN.y * 2,
} as const

type Pieza = {
  src: string
  x: number
  y: number
  /**
   * Se pinta DELANTE del cuerpo en vez de detrás.
   *
   * Por defecto los brazos van detrás, que es lo correcto para las manos en
   * cintura: el brazo pasa por atrás y solo asoma la mano. Pero cuando el
   * brazo cruza por encima del cuerpo —el de pensativa llega hasta la
   * barbilla— quedar detrás lo hace desaparecer.
   */
  delante?: boolean
}

/**
 * Anclas fijas: viven siempre en el mismo punto del cuerpo.
 * Confirmadas por coincidencia entre 2 y 8 páginas de la guía.
 *
 * ⚠️ La cara varía un par de unidades entre poses porque Samuel redibujó cada
 * una a mano. Estas son la mediana; si una pose se ve descuadrada, se corrige
 * en su receta con `ajuste`, no aquí.
 */
export const ANCLAS: Record<string, { x: number; y: number }> = {
  'Sombra/sombra-01.svg':  { x: 10.1,  y: 11.9 },
  'Sombra/sombra-02.svg':  { x: 4.0,   y: 3.0 },
  'pies/pie-der01.svg':    { x: 69.4,  y: 170.7 },
  'pies/pie-izq01.svg':    { x: -7.4,  y: 170.7 },

  'Ojos/ojo-der01.svg':    { x: 62.9,  y: 75.3 },
  'Ojos/ojo-izq01.svg':    { x: 19.4,  y: 73.6 },
  'Ojos/ojo-der02.svg':    { x: 63.3,  y: 71.3 },
  'Ojos/ojo-izq02.svg':    { x: 20.0,  y: 71.3 },
  'Ojos/ojo-der03.svg':    { x: 63.2,  y: 66.1 },
  'Ojos/ojo-izq03.svg':    { x: 24.3,  y: 64.6 },
  'Ojos/ojo-der04.svg':    { x: 62.9,  y: 75.2 },
  'Ojos/ojo-izq04.svg':    { x: 20.0,  y: 75.2 },

  'Cejas/ceja-der01.svg':  { x: 64.8,  y: 60.7 },
  'Cejas/ceja-izq01.svg':  { x: 22.5,  y: 60.7 },
  'Cejas/ceja-der02.svg':  { x: 65.2,  y: 59.8 },
  'Cejas/ceja-izq02.svg':  { x: 22.2,  y: 59.8 },
  'Cejas/ceja-der03.svg':  { x: 64.8,  y: 59.6 },
  'Cejas/ceja-izq03.svg':  { x: 27.1,  y: 59.6 },

  // 🔴 boca-01 salió medida en y=173, a la altura de los tenis: encajó contra
  // su contorno en seis páginas. Falso positivo consistente, que es el más
  // difícil de detectar. Se corrigió a mano contra la página 2 de la guía.
  'Boca/boca-01.svg':      { x: 41.9,  y: 96.0 },
  'Boca/boca-02.svg':      { x: 42.5,  y: 93.5 },
  'Boca/boca-03.svg':      { x: 43.2,  y: 96.0 },
  'Boca/boca-04.svg':      { x: 40.0,  y: 107.5 },
}

export type PoseId =
  | 'compacta' | 'confiada' | 'celebrando' | 'pensativa'
  | 'aprobando' | 'flexionando' | 'zombie' | 'lapiz'

/**
 * Cada pose es una receta: qué piezas y en qué orden. El orden del array ES
 * el orden de pintado, así que un brazo listado después del cuerpo queda por
 * delante, y antes queda por detrás.
 */
export type Pose = {
  cuerpo: string
  /** Piezas con posición propia de esta pose (brazos). */
  propias: Pieza[]
  /** Piezas que usan su ancla fija. */
  ancladas: string[]
  /** Se pinta detrás del cuerpo. */
  aura?: string
  /** Corrección fina de toda la cara, si esta pose la lleva desplazada. */
  ajusteCara?: { x: number; y: number }
}

export const POSES: Record<PoseId, Pose> = {
  // Sin brazos ni pies a propósito: es la de 48 px del dashboard, donde las
  // extremidades se convierten en manchas.
  compacta: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    propias: [],
    ancladas: [
      'Cejas/ceja-der01.svg', 'Cejas/ceja-izq01.svg',
      'Ojos/ojo-der01.svg', 'Ojos/ojo-izq01.svg',
      'Boca/boca-01.svg',
    ],
  },
  confiada: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    propias: [
      { src: 'Brazos/brazo-der01.svg', x: 102.5, y: 98.9 },
      { src: 'Brazos/brazo-izq01.svg', x: -26.2, y: 98.9 },
    ],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der01.svg', 'Cejas/ceja-izq01.svg',
      'Ojos/ojo-der01.svg', 'Ojos/ojo-izq01.svg',
      'Boca/boca-01.svg',
    ],
  },
  celebrando: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    propias: [
      { src: 'Brazos/brazo-der02.svg', x: 99.6, y: 19.6 },
      { src: 'Brazos/brazo-izq02.svg', x: -41.6, y: 19.6 },
    ],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg',
      'Ojos/ojo-der02.svg', 'Ojos/ojo-izq02.svg',
      'Boca/boca-02.svg',
    ],
  },
  pensativa: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    propias: [{ src: 'Brazos/brazo-izq03.svg', x: -7.5, y: 102.1, delante: true }],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg',
      'Ojos/ojo-der03.svg', 'Ojos/ojo-izq03.svg',
      'Boca/boca-03.svg',
    ],
  },
  aprobando: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    propias: [
      { src: 'Brazos/brazo-der03.svg', x: 95.4, y: 61.4 },
      { src: 'Brazos/brazo-izq01.svg', x: -25.4, y: 88.2 },
    ],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg',
      'Ojos/ojo-der04.svg', 'Ojos/ojo-izq04.svg',
      'Boca/boca-03.svg',
    ],
  },
  flexionando: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    aura: 'Aura/Aura-morado.svg',
    propias: [
      { src: 'Brazos/brazo-der04.svg', x: 62.0, y: 99.6, delante: true },
      { src: 'Brazos/brazo-izq04.svg', x: 0.0, y: 99.6, delante: true },
    ],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der03.svg', 'Cejas/ceja-izq03.svg',
      'Ojos/ojo-der01.svg', 'Ojos/ojo-izq02.svg',
      'Boca/boca-03.svg',
    ],
  },
  // La única que usa cuerpo-02: lleva la cicatriz y los tornillos dibujados.
  zombie: {
    cuerpo: 'Cuerpo/cuerpo-02.svg',
    propias: [
      { src: 'Brazos/brazo-der06.svg', x: 105.4, y: 106.8 },
      { src: 'Brazos/brazo-izq06.svg', x: -54.3, y: 94.6 },
    ],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg',
      'Ojos/ojo-der04.svg', 'Ojos/ojo-izq04.svg',
      'Boca/boca-04.svg',
    ],
  },
  lapiz: {
    cuerpo: 'Cuerpo/cuerpo-01.svg',
    propias: [
      { src: 'Brazos/brazo-der01.svg', x: 101.1, y: 100.4 },
      { src: 'Brazos/brazo-izq07.svg', x: -47.5, y: 38.2 },
    ],
    ancladas: [
      'pies/pie-der01.svg', 'pies/pie-izq01.svg',
      'Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg',
      'Ojos/ojo-der04.svg', 'Ojos/ojo-izq04.svg',
      'Boca/boca-03.svg',
    ],
  },
}

/** Ojos cerrados, para el parpadeo. */
export const PARPADEO = {
  der: 'Ojos/ojo-der02.svg',
  izq: 'Ojos/ojo-izq02.svg',
} as const
