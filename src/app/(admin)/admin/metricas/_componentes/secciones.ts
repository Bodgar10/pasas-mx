/**
 * Catálogo de pestañas del tablero de métricas.
 *
 * 🔴 VIVE EN SU PROPIO MÓDULO, SIN 'use client', Y NO PUEDE VOLVER A
 * Pestanas.tsx.
 *
 * Estaba exportado desde ahí, que es `'use client'`. Un server component
 * —`[seccion]/page.tsx`— que importa un valor de un módulo cliente no recibe
 * el array: recibe un proxy de referencia de cliente. El síntoma fue
 * `TypeError: h.SECCIONES.map is not a function` en `next build`, y no
 * reventaba en `next dev` porque ahí los módulos se resuelven distinto.
 *
 * El build ENTERO caía por esto, no solo /admin/metricas. Lo que se comparte
 * entre servidor y cliente va en un módulo neutral; los componentes de cliente
 * lo importan igual que antes.
 */
export const SECCIONES = [
  { slug: 'dinero', emoji: '💰', label: 'Dinero' },
  { slug: 'suscripciones', emoji: '📊', label: 'Suscripciones' },
  { slug: 'adquisicion', emoji: '📣', label: 'Adquisición' },
  { slug: 'aprendizaje', emoji: '📚', label: 'Aprendizaje' },
  { slug: 'contenido', emoji: '🧪', label: 'Contenido' },
  { slug: 'salud', emoji: '🩺', label: 'Salud' },
] as const

export type SlugSeccion = (typeof SECCIONES)[number]['slug']
