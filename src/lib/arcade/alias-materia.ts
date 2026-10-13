/**
 * El ?materia= de los anuncios y los links, en la clave del reto. Acepta
 * acentos y sinónimos (quimica, fisica → ciencias). null si no es materia.
 * Lo usan /arcade/materia/[materia] y /arcade/vom/materia/[materia] (s47).
 */
const ALIAS: Record<string, string> = {
  historia: 'historia',
  biologia: 'biologia',
  geografia: 'geografia',
  ciencias: 'ciencias',
  ciencia: 'ciencias',
  quimica: 'ciencias',
  fisica: 'ciencias',
  espanol: 'espanol',
  papas: 'papas',
  papa: 'papas',
}

export function normalizarMateria(crudo: string): string | null {
  let t = crudo
  try {
    t = decodeURIComponent(crudo)
  } catch {}
  const clave = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return ALIAS[clave] ?? null
}
