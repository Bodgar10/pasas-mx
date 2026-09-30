/**
 * Materias del reto diario "¿Cuál sobra?": calendario, nombres, colores y
 * textos. FUENTE ÚNICA del lado de la app.
 *
 * 🔴 El calendario de verdad vive en la base (arcade_materia_del_dia,
 * migración 056) y es la que arma cada reto. `materiaDelDia` es su espejo:
 * solo sirve para textos como "Mañana: Biología". Si cambias uno, cambia el
 * otro. El reto de hoy SIEMPRE trae su materia real (`reto.materia`), que
 * puede ser 'historia' aunque el calendario diga otra cosa si esa materia
 * todavía no tiene rondas.
 */

export const MATERIAS_ARCADE = ['historia', 'biologia', 'geografia', 'ciencias', 'espanol', 'papas'] as const
export type MateriaArcade = (typeof MATERIAS_ARCADE)[number]

export type ConfigMateria = {
  /** "Historia", "Química y Física"… Va en "Reto de <nombre> #n". */
  nombre: string
  /** Para textos cortos y para compartir: "· Historia". */
  corto: string
  emoji: string
  /** Color de acento (botones, eyebrow, barra de progreso). */
  acento: string
  /** Texto sobre el acento: blanco en los oscuros, tinta en los claros. */
  sobreAcento: string
  /** "Reto de Historia #12" / "Reto para papás #12". */
  eyebrow: (n: number) => string
  lead: string
  /** Ejemplo de "Así se juega". NO sale del banco: nunca adelanta una ronda. */
  ejemplo: { opciones: [string, string, string, string]; sobra: number; nota: string }
}

export const MATERIAS: Record<MateriaArcade, ConfigMateria> = {
  historia: {
    nombre: 'Historia',
    corto: 'Historia',
    emoji: '🏛️',
    acento: '#7c3aed',
    sobreAcento: '#ffffff',
    eyebrow: (n) => `Reto de Historia #${n}`,
    lead: 'Cinco rondas. En cada una, tres cosas tienen algo en común y una no. Toca la que sobra.',
    ejemplo: {
      opciones: ['Mexicas', 'Mayas', 'Romanos', 'Olmecas'],
      sobra: 2,
      nota: 'Sobran los romanos: los otros tres son culturas de Mesoamérica.',
    },
  },
  biologia: {
    nombre: 'Biología',
    corto: 'Biología',
    emoji: '🧬',
    acento: '#0d9488',
    sobreAcento: '#ffffff',
    eyebrow: (n) => `Reto de Biología #${n}`,
    lead: 'Cinco rondas de seres vivos, células y cuerpo humano. Tres tienen algo en común y una no. Toca la que sobra.',
    ejemplo: {
      opciones: ['Perro', 'Delfín', 'Tiburón', 'Murciélago'],
      sobra: 2,
      nota: 'Sobra el tiburón: es un pez; los otros tres son mamíferos.',
    },
  },
  geografia: {
    nombre: 'Geografía',
    corto: 'Geografía',
    emoji: '🌎',
    acento: '#0284c7',
    sobreAcento: '#ffffff',
    eyebrow: (n) => `Reto de Geografía #${n}`,
    lead: 'Cinco rondas de países, ríos, regiones y mapas. Tres tienen algo en común y una no. Toca la que sobra.',
    ejemplo: {
      opciones: ['Nilo', 'Amazonas', 'Everest', 'Misisipi'],
      sobra: 2,
      nota: 'Sobra el Everest: es una montaña; los otros tres son ríos.',
    },
  },
  ciencias: {
    nombre: 'Química y Física',
    corto: 'Química y Física',
    emoji: '⚗️',
    acento: '#f59e0b',
    sobreAcento: '#1a1035',
    eyebrow: (n) => `Reto de Química y Física #${n}`,
    lead: 'Cinco rondas de elementos, energía, fuerzas y materia. Tres tienen algo en común y una no. Toca la que sobra.',
    ejemplo: {
      opciones: ['Oro', 'Oxígeno', 'Plata', 'Cobre'],
      sobra: 1,
      nota: 'Sobra el oxígeno: es un no metal; los otros tres son metales.',
    },
  },
  espanol: {
    nombre: 'Español',
    corto: 'Español',
    emoji: '📖',
    acento: '#db2777',
    sobreAcento: '#ffffff',
    eyebrow: (n) => `Reto de Español #${n}`,
    lead: 'Cinco rondas de palabras, textos y literatura. Tres tienen algo en común y una no. Toca la que sobra.',
    ejemplo: {
      opciones: ['Correr', 'Mesa', 'Saltar', 'Comer'],
      sobra: 1,
      nota: 'Sobra "mesa": es un sustantivo; las otras tres son verbos.',
    },
  },
  papas: {
    nombre: 'papás',
    corto: 'Reto para papás',
    emoji: '👨‍👩‍👧',
    acento: '#fbbf24',
    sobreAcento: '#1a1035',
    eyebrow: (n) => `Reto para papás #${n}`,
    lead: '¿Sabes más que un alumno de secundaria? Cinco rondas de lo que ven tus hijos en la escuela, una de cada materia.',
    ejemplo: {
      opciones: ['Mercurio', 'Venus', 'Luna', 'Marte'],
      sobra: 2,
      nota: 'Sobra la Luna: es un satélite; los otros tres son planetas.',
    },
  },
}

export function esMateriaArcade(x: unknown): x is MateriaArcade {
  return typeof x === 'string' && (MATERIAS_ARCADE as readonly string[]).includes(x)
}

/** La config de una materia; si llega algo desconocido, la de historia. */
export function configMateria(m: string | null | undefined): ConfigMateria {
  return MATERIAS[esMateriaArcade(m) ? m : 'historia']
}

/**
 * Espejo de arcade_materia_del_dia (056): lun historia, mar biología, mié
 * geografía, jue química y física, vie español, sáb papás, dom historia.
 * `fecha` es YYYY-MM-DD (hora de México).
 */
export function materiaDelDia(fecha: string): MateriaArcade {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay() // 0 domingo … 6 sábado
  return (['historia', 'historia', 'biologia', 'geografia', 'ciencias', 'espanol', 'papas'] as const)[dia]
}

/** La materia de mañana, para "Siguiente reto: Biología". */
export function materiaDeManana(fecha: string): MateriaArcade {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return materiaDelDia(d.toISOString().slice(0, 10))
}

/** El nombre para frases como "Mañana toca Biología" o "Mañana: reto para papás". */
export function nombreParaManana(m: MateriaArcade): string {
  return m === 'papas' ? 'reto para papás' : MATERIAS[m].nombre
}
