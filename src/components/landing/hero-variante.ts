/**
 * Variante del hero de la landing, resuelta ANTES DEL PRIMER PINTADO.
 *
 * Antes la variante nacía en 'D' (useState) y cambiaba en un useEffect: el
 * tráfico de papás (utm meta_papas/google) y la mitad que cae en E veían
 * "Estudia sin estudiar." y, tras hidratar, otro H1 de distinto alto. Eso
 * movía el layout y retrasaba el LCP justo en la pantalla donde el 69% de los
 * anuncios se va en menos de 5 s.
 *
 * Cómo funciona —mismo truco que el A/B del Arcade (arcade-client.tsx):
 *   1. El HTML trae el texto de LAS TRES variantes, cada uno en un
 *      <span class="hv-X">. CSS_BASE_HERO deja visible solo D.
 *   2. Un <script> en línea, colocado antes del hero, calcula la variante con
 *      la misma lógica de siempre y, si no es D, mete en <head> un <style> que
 *      esconde D y muestra la suya. Corre mientras el navegador parsea: el
 *      primer pintado ya sale con el texto correcto.
 *   3. El useEffect de la landing toma el resultado del script (no lo vuelve a
 *      sortear), sincroniza el estado React `variant` para la analítica y
 *      llama a aplicarCssHero() por si el script no corrió.
 *
 * 🔴 NO SE TOCAN ATRIBUTOS DE <html> NI DE NADA QUE PINTE REACT. Eso es un
 * desajuste de hidratación. El script solo escribe en window y en un <style>
 * propio dentro de <head>.
 *
 * 🔴 LA PÁGINA ES ISR (revalidate 3600): el servidor no puede leer la cookie,
 * el storage ni el utm de cada visita. Por eso se decide en el navegador y no
 * en el render.
 */

export type VariantKey = 'D' | 'E' | 'PAPA'

export const VARIANTES_HERO: readonly VariantKey[] = ['D', 'E', 'PAPA']

/** La misma clave de localStorage de siempre. Cambiarla reasigna a todos. */
export const CLAVE_VARIANTE_HERO = 'pasas_hero_variant'

/** id del <style> que inyecta el script. Lo reutiliza aplicarCssHero(). */
const ID_CSS_HERO = 'pasas-hero-css'

/** Lo que deja el script en window para que el efecto no vuelva a sortear. */
type VariantePrevia = { v: VariantKey; p: boolean }
type VentanaConHero = Window & { __pasasHero?: VariantePrevia }

/**
 * Estático, va en un <style> del propio componente (igual en servidor y en
 * cliente). Sin JS, o mientras no llegue nada más, se ve D, como antes.
 */
export const CSS_BASE_HERO = '.hv-E,.hv-PAPA{display:none}'

/** Regla que muestra solo `v`. Para D no hace falta ninguna: es la base. */
function cssDeVariante(v: VariantKey): string {
  if (v === 'D') return ''
  return `.hv-D{display:none!important}.hv-${v}{display:inline!important}`
}

/**
 * Script en línea. Es la lógica de siempre, en JS plano:
 *   · utm_source → audiencia (espejo de detectAudience)
 *   · papa → PAPA, que NUNCA se persiste: depende del utm de esa visita
 *   · si no, D/E 50/50, pegajoso en localStorage
 *
 * 🔴 ESPEJO DE detectAudience (src/lib/audience-detection.ts). Si ahí cambia
 * qué utm cuenta como papá, hay que cambiarlo aquí. Si se olvida, no se rompe
 * nada: el efecto vuelve a calcular la audiencia con la función real y, si
 * discrepa, corrige la variante (con un parpadeo, que es lo que había antes).
 *
 * 🔴 EL SCRIPT ES EL QUE SORTEA Y PERSISTE, no el efecto. Si el efecto
 * volviera a llamar a getOrAssignVariant(), encontraría guardado lo que el
 * script acaba de escribir y mandaría `es_persistida: true` en una visita
 * nueva: el A/B se leería mal.
 *
 * Con el storage bloqueado se sortea igual y no se persiste (`p: false`).
 */
export function scriptVarianteHero(): string {
  const css = {
    E: cssDeVariante('E'),
    PAPA: cssDeVariante('PAPA'),
  }
  return `(function(){try{var v='D',p=false,a='';try{a=(new URLSearchParams(location.search).get('utm_source')||'').toLowerCase()}catch(e){}if(a==='meta_papas'||a==='google'){v='PAPA'}else{var k=${JSON.stringify(CLAVE_VARIANTE_HERO)},g=null;try{g=localStorage.getItem(k)}catch(e){}if(g==='D'||g==='E'){v=g;p=true}else{v=Math.random()<0.5?'D':'E';try{localStorage.setItem(k,v)}catch(e){}}}window.__pasasHero={v:v,p:p};var c=${JSON.stringify(css)}[v];if(c){var st=document.createElement('style');st.id=${JSON.stringify(ID_CSS_HERO)};st.textContent=c;document.head.appendChild(st)}}catch(e){}})();`
}

/**
 * Lee Y BORRA lo que dejó el script. Se borra para que sirva una sola vez:
 * si el visitante navega a otra ruta y vuelve a "/" por navegación de
 * cliente, el script no se ejecuta otra vez (React no ejecuta <script> al
 * renderizar en cliente) y el valor viejo diría `p: false` de una variante
 * que ya está guardada.
 */
export function tomarVariantePrevia(): VariantePrevia | null {
  if (typeof window === 'undefined') return null
  const w = window as VentanaConHero
  const previa = w.__pasasHero ?? null
  delete w.__pasasHero
  if (!previa || !VARIANTES_HERO.includes(previa.v)) return null
  return previa
}

/**
 * Deja en <head> la regla de `v`. Idempotente: en una carga normal el script
 * ya la puso igual y esto no cambia nada. Corrige los dos casos en que el
 * script no acertó: navegación de cliente (no corrió) y discrepancia con
 * detectAudience.
 */
export function aplicarCssHero(v: VariantKey): void {
  if (typeof document === 'undefined') return
  const css = cssDeVariante(v)
  let st = document.getElementById(ID_CSS_HERO) as HTMLStyleElement | null
  if (!css) {
    st?.remove()
    return
  }
  if (!st) {
    st = document.createElement('style')
    st.id = ID_CSS_HERO
    document.head.appendChild(st)
  }
  if (st.textContent !== css) st.textContent = css
}

/**
 * Asignación D/E para cuando el script no corrió (navegación de cliente).
 * Misma lógica que el script: 50/50 entre D y E, pegajosa en localStorage, y
 * dice TAMBIÉN si la variante venía guardada o se sorteó en esta carga.
 *
 * 🔴 Sin ese dato el A/B se lee mal: PAPA nunca se persiste, así que un papá
 * que vuelve sin utm recibe D o E y su `hero_variant_seen` parece una visita
 * nueva cuando es una reasignación.
 *
 * Con el storage bloqueado sortea sin persistir en vez de reventar el efecto
 * (antes lanzaba y la landing se quedaba en D sin mandar hero_variant_seen).
 */
export function getOrAssignVariant(): { variant: VariantKey; persistida: boolean } {
  if (typeof window === 'undefined') return { variant: 'D', persistida: false }
  let stored: string | null = null
  try { stored = localStorage.getItem(CLAVE_VARIANTE_HERO) } catch { /* bloqueado */ }
  if (stored === 'D' || stored === 'E') return { variant: stored, persistida: true }
  const assigned: VariantKey = Math.random() < 0.5 ? 'D' : 'E'
  try { localStorage.setItem(CLAVE_VARIANTE_HERO, assigned) } catch { /* bloqueado */ }
  return { variant: assigned, persistida: false }
}
