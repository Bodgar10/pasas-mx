import { describe, it, expect } from 'vitest'
import { verificarDestinoDb, URLS_PERMITIDAS, REF_PRODUCCION } from '../guarda-db'

/**
 * La guarda, probada.
 *
 * 🔴 UNA GUARDA QUE NUNCA SE HA VISTO DISPARAR NO ES UNA GUARDA: ES UNA
 * SUPOSICIÓN. Estas pruebas la ven disparar en cada `npm test`, y por tanto
 * en cada `git push`.
 *
 * Viven en tests/unit/ a propósito, no en tests/integracion/: no necesitan
 * base de datos, corren en milisegundos y entran en el pre-push. La pieza que
 * protege la base es la primera que no puede depender de la base.
 */

const URL_PRODUCCION = `https://${REF_PRODUCCION}.supabase.co`

describe('verificarDestinoDb — deja pasar la base local', () => {
  it('acepta las dos formas de la URL local', () => {
    expect(() => verificarDestinoDb('http://127.0.0.1:54321')).not.toThrow()
    expect(() => verificarDestinoDb('http://localhost:54321')).not.toThrow()
  })

  it('acepta la URL local con path detrás (es como la usa el cliente)', () => {
    expect(() => verificarDestinoDb('http://127.0.0.1:54321/rest/v1')).not.toThrow()
  })
})

describe('🔴 verificarDestinoDb — ABORTA contra producción', () => {
  it('lanza si la URL es la del proyecto de producción', () => {
    expect(() => verificarDestinoDb(URL_PRODUCCION)).toThrow()
  })

  it('el mensaje NOMBRA el peligro, no habla de formatos de URL', () => {
    // Es la diferencia entre que alguien lea el error y entienda que estuvo a
    // punto de borrar clientes, o que lo lea como un problema de config.
    expect(() => verificarDestinoDb(URL_PRODUCCION)).toThrow(/PRODUCCIÓN/)
  })

  it('el mensaje dice QUÉ URL encontró', () => {
    expect(() => verificarDestinoDb(URL_PRODUCCION)).toThrow(new RegExp(REF_PRODUCCION))
  })

  it('lo atrapa aunque venga con el pooler o con otro subdominio', () => {
    expect(() => verificarDestinoDb(`https://${REF_PRODUCCION}.pooler.supabase.com:6543`)).toThrow(
      /PRODUCCIÓN/
    )
  })
})

describe('verificarDestinoDb — aborta contra cualquier cosa que no sea la local', () => {
  it('lanza con la URL vacía, undefined o null', () => {
    expect(() => verificarDestinoDb('')).toThrow(/vacía o sin definir/)
    expect(() => verificarDestinoDb(undefined)).toThrow(/vacía o sin definir/)
    expect(() => verificarDestinoDb(null)).toThrow(/vacía o sin definir/)
  })

  it('🔴 lanza con un proyecto de Supabase CUALQUIERA, no solo con producción', () => {
    // El punto de la lista blanca. Un staging nuevo tampoco pasa: la pregunta
    // es "¿es exactamente la local?", no "¿es producción?". Que entre algo
    // nuevo tiene que ser una decisión de alguien, no el default.
    expect(() => verificarDestinoDb('https://proyectocualquiera.supabase.co')).toThrow()
    expect(() => verificarDestinoDb('https://staging-nuevo.supabase.co')).toThrow()
  })

  it('lanza con el puerto equivocado, aunque sea localhost', () => {
    // 54322 es Postgres directo, no la API. Apuntar ahí no destruiría nada,
    // pero fallaría de forma rarísima; mejor cortarlo aquí.
    expect(() => verificarDestinoDb('http://127.0.0.1:54322')).toThrow(/esperada/)
    expect(() => verificarDestinoDb('http://127.0.0.1:3000')).toThrow()
  })

  it('lanza con https contra localhost (el stack local sirve http)', () => {
    expect(() => verificarDestinoDb('https://127.0.0.1:54321')).toThrow()
  })

  it('el mensaje dice qué encontró Y qué esperaba', () => {
    try {
      verificarDestinoDb('https://otra-cosa.supabase.co')
      expect.unreachable('debió lanzar')
    } catch (err) {
      const msg = (err as Error).message
      expect(msg).toContain('https://otra-cosa.supabase.co')
      expect(msg).toContain(URLS_PERMITIDAS[0])
      expect(msg).toContain(URLS_PERMITIDAS[1])
    }
  })
})
