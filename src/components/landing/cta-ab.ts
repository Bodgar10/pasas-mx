/**
 * PRUEBA A/B DEL BOTÓN PRINCIPAL DE LA LANDING (s51, desde el 26-oct-2026).
 *
 *   'reto'  — A, la de siempre: "Juega el reto de hoy, gratis" → /arcade
 *   'clase' — B: "Toma tu primera clase gratis" → /clase-gratis
 *
 * Por qué: en la semana 1 de anuncios (19-25 oct) todos los registros y el
 * primer cliente salieron del anuncio que lleva a la landing, no del que
 * lleva al reto. La gente que se registró necesitaba entender qué es PASAS.
 * La pregunta ahora es si una clase de su materia, con su hobby, convence más
 * que el reto.
 *
 * 50/50 pegajoso por navegador (localStorage), resuelto ANTES DEL PRIMER
 * PINTADO con el mismo truco que hero-variante.ts: el HTML trae los dos
 * botones (y los dos banners), CSS_BASE_CTA deja visible A, y el script en
 * línea, si toca B, mete en <head> el <style> que lo cambia. Sin JS se ve A.
 *
 * 🔴 Independiente del A/B del H1 (hero-variante.ts, D/E): otra clave, otro
 * sorteo. Las dos pruebas corren a la vez sin estorbarse.
 *
 * 🔴 La medición: contarAnonimo (lib/analytics/conteo.ts) lee esta clave y
 * pone `ab_landing` en TODOS los eventos de ese navegador, también los del
 * onboarding, el registro y la clase. Así se puede comparar "empiezan el
 * registro por visita" entre A y B sin unir eventos entre sí.
 */

export type BrazoCta = 'reto' | 'clase'

export const CLAVE_CTA_AB = 'pasas_landing_cta'

const ID_CSS_CTA = 'pasas-cta-ab-css'

/** Base, igual en servidor y cliente: se ve A. */
export const CSS_BASE_CTA = '.ab-clase{display:none}'

const CSS_CLASE = '.ab-reto{display:none!important}.ab-clase{display:block!important}'

/** Script en línea: sortea (o lee) el brazo y, si es B, cambia el CSS. */
export function scriptCtaAb(): string {
  return `(function(){try{var k=${JSON.stringify(CLAVE_CTA_AB)},v=null,p=false;try{v=localStorage.getItem(k)}catch(e){}if(v==='reto'||v==='clase'){p=true}else{v=Math.random()<0.5?'reto':'clase';try{localStorage.setItem(k,v)}catch(e){}}window.__pasasCta={v:v,p:p};if(v==='clase'){var st=document.createElement('style');st.id=${JSON.stringify(ID_CSS_CTA)};st.textContent=${JSON.stringify(CSS_CLASE)};document.head.appendChild(st)}}catch(e){}})();`
}

/**
 * El brazo vigente. En una carga normal lo dejó el script; en navegación de
 * cliente (el script no corre) se lee o se sortea aquí con la misma regla, y
 * se aplica el CSS.
 */
export function brazoCta(): BrazoCta {
  if (typeof window === 'undefined') return 'reto'
  const w = window as Window & { __pasasCta?: { v: BrazoCta } }
  let v: BrazoCta | null = w.__pasasCta?.v ?? null
  if (v !== 'reto' && v !== 'clase') {
    try {
      const g = localStorage.getItem(CLAVE_CTA_AB)
      if (g === 'reto' || g === 'clase') v = g
    } catch {}
  }
  if (v !== 'reto' && v !== 'clase') {
    v = Math.random() < 0.5 ? 'reto' : 'clase'
    try {
      localStorage.setItem(CLAVE_CTA_AB, v)
    } catch {}
  }
  aplicarCssCta(v)
  return v
}

function aplicarCssCta(v: BrazoCta): void {
  if (typeof document === 'undefined') return
  let st = document.getElementById(ID_CSS_CTA) as HTMLStyleElement | null
  if (v === 'reto') {
    st?.remove()
    return
  }
  if (!st) {
    st = document.createElement('style')
    st.id = ID_CSS_CTA
    document.head.appendChild(st)
  }
  if (st.textContent !== CSS_CLASE) st.textContent = CSS_CLASE
}

/** Lo que lee el conteo anónimo. null si este navegador nunca vio la landing. */
export function leerBrazoGuardado(): BrazoCta | null {
  try {
    const g = window.localStorage.getItem(CLAVE_CTA_AB)
    return g === 'reto' || g === 'clase' ? g : null
  } catch {
    return null
  }
}
