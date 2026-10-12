import { describe, it, expect } from 'vitest'
import {
  permutacionSinFijos,
  primerError,
  semillaDe,
  validarConnect,
  validarOrderSteps,
  CONNECT_MAX_CHARS,
} from '@/lib/minijuegos'
import { planear, generarSQL, TEMATICAS } from '../../scripts/minijuegos/cargar'

/** s43 — Conecta 🔗 y Arma los pasos 🧩. */

const conecta = {
  pairs: [
    { left: 'Ki que sube', right: 'Entero positivo' },
    { left: 'Ki que se drena', right: 'Entero negativo' },
    { left: 'Termómetro de ki', right: 'Recta numérica' },
  ],
  completion_feedback: 'Eso que viste en la pelea tiene nombre.',
}

const arma = {
  steps: ['Compara los signos', 'Resta los valores absolutos', 'Pon el signo del mayor'],
  completion_feedback: 'Primero signos, luego valores.',
}

describe('validarConnect', () => {
  it('acepta 2-4 pares cortos y únicos', () => {
    expect(validarConnect(conecta)).toEqual({ errores: [], avisos: [] })
  })

  it('rechaza menos de 2 o más de 4 pares', () => {
    expect(validarConnect({ pairs: [conecta.pairs[0]] }).errores[0]).toMatch(/2-4/)
    const cinco = Array.from({ length: 5 }, (_, i) => ({ left: `a${i}`, right: `b${i}` }))
    expect(validarConnect({ pairs: cinco }).errores[0]).toMatch(/2-4/)
  })

  it('rechaza tarjetas duplicadas: el par deja de ser inequívoco', () => {
    const d = { pairs: [{ left: 'A', right: 'X' }, { left: 'a ', right: 'Y' }] }
    expect(validarConnect(d).errores.join()).toMatch(/left duplicado/)
    const e = { pairs: [{ left: 'A', right: 'X' }, { left: 'B', right: 'x' }] }
    expect(validarConnect(e).errores.join()).toMatch(/right duplicado/)
  })

  it('rechaza tarjetas que no caben en móvil', () => {
    const largo = 'x'.repeat(CONNECT_MAX_CHARS + 1)
    expect(validarConnect({ pairs: [{ left: largo, right: 'b' }, { left: 'c', right: 'd' }] }).errores.join()).toMatch(/caracteres/)
  })

  it('basura no truena: devuelve error', () => {
    expect(validarConnect(null).errores.length).toBe(1)
    expect(validarConnect({ pairs: 'no' }).errores.length).toBe(1)
  })

  it('sin completion_feedback es aviso, no error', () => {
    const v = validarConnect({ pairs: conecta.pairs })
    expect(v.errores).toEqual([])
    expect(v.avisos).toContain('sin completion_feedback')
  })
})

describe('validarOrderSteps', () => {
  it('acepta 3-5 pasos', () => {
    expect(validarOrderSteps(arma)).toEqual({ errores: [], avisos: [] })
  })

  it('rechaza listas cortas o largas', () => {
    expect(validarOrderSteps({ steps: ['a', 'b'] }).errores[0]).toMatch(/3-5/)
    expect(validarOrderSteps({ steps: ['a', 'b', 'c', 'd', 'e', 'f'] }).errores[0]).toMatch(/3-5/)
  })

  it('rechaza pasos numerados: regalan el orden', () => {
    expect(validarOrderSteps({ steps: ['1. Haz esto', 'b', 'c'] }).errores.join()).toMatch(/número/)
    expect(validarOrderSteps({ steps: ['Paso 2 algo', 'b', 'c'] }).errores.join()).toMatch(/número/)
  })

  it('rechaza pasos repetidos', () => {
    expect(validarOrderSteps({ steps: ['a', 'A', 'c'] }).errores.join()).toMatch(/duplicado/)
  })
})

describe('permutacionSinFijos', () => {
  it('es determinista: servidor y navegador sacan el mismo orden', () => {
    const s = semillaDe(arma.steps)
    expect(permutacionSinFijos(4, s)).toEqual(permutacionSinFijos(4, s))
  })

  it('nunca deja un elemento en su lugar (n = 2..5, muchas semillas)', () => {
    for (let n = 2; n <= 5; n++) {
      for (let i = 0; i < 300; i++) {
        const p = permutacionSinFijos(n, `semilla-${n}-${i}`)
        expect([...p].sort()).toEqual(Array.from({ length: n }, (_, k) => k))
        p.forEach((v, k) => expect(v).not.toBe(k))
      }
    }
  })

  it('n = 1 y n = 0 no truenan', () => {
    expect(permutacionSinFijos(1, 'x')).toEqual([0])
    expect(permutacionSinFijos(0, 'x')).toEqual([])
  })
})

describe('primerError', () => {
  it('-1 si todo está en orden', () => expect(primerError([0, 1, 2, 3])).toBe(-1))
  it('señala SOLO el primer slot roto', () => {
    expect(primerError([0, 2, 1, 3])).toBe(1)
    expect(primerError([3, 2, 1, 0])).toBe(0)
  })
})

describe('cargador', () => {
  const temas = Object.fromEntries(TEMATICAS.map((t) => [t, { connect: conecta }]))
  const archivo = {
    subject: 'matematicas-sec-1',
    topics: { 'enteros-suma': { order_steps: arma, temas } },
  }

  it('aplana: 4 Conecta + Arma compartido copiado a las 4 temáticas', () => {
    const p = planear(archivo)
    expect(p.errores).toEqual([])
    expect(p.filas.filter((f) => f.type === 'connect')).toHaveLength(4)
    expect(p.filas.filter((f) => f.type === 'order_steps')).toHaveLength(4)
    expect(p.pares).toHaveLength(4)
  })

  it('null en una temática = no aplica (no inserta, pero sí limpia)', () => {
    const t2 = { ...temas, Fútbol: { connect: null } }
    const p = planear({ ...archivo, topics: { 'enteros-suma': { order_steps: null, temas: t2 } } })
    expect(p.filas.filter((f) => f.type === 'connect')).toHaveLength(3)
    expect(p.filas.filter((f) => f.type === 'order_steps')).toHaveLength(0)
    expect(p.pares).toHaveLength(4)
  })

  it('exige las 4 temáticas', () => {
    const tres = Object.fromEntries(Object.entries(temas).filter(([k]) => k !== 'Fútbol'))
    expect(planear({ ...archivo, topics: { x: { temas: tres } } }).errores.join()).toMatch(/faltan temáticas Fútbol/)
  })

  it('un error en cualquier bloque se reporta con su ubicación', () => {
    const malo = { ...temas, Videojuegos: { connect: { pairs: [conecta.pairs[0]] } } }
    const p = planear({ ...archivo, topics: { 'enteros-suma': { temas: malo } } })
    expect(p.errores.join()).toMatch(/enteros-suma · Videojuegos · connect/)
  })

  it('el SQL es transaccional, verifica slugs y solo borra connect/order_steps', () => {
    const sql = generarSQL('matematicas-sec-1', planear(archivo))
    expect(sql.startsWith('-- Minijuegos')).toBe(true)
    expect(sql).toContain('BEGIN;')
    expect(sql.trim().endsWith('COMMIT;')).toBe(true)
    expect(sql).toContain("RAISE EXCEPTION 'tema no encontrado")
    expect(sql).toMatch(/DELETE FROM public\.sections WHERE user_id IS NULL AND type IN \('connect','order_steps'\)/)
    expect(sql.match(/INSERT INTO/g)).toHaveLength(8)
  })
})
