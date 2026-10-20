/**
 * Identificadores del contenido de los demos de la landing.
 *
 * 🔴 VIVEN AQUÍ Y NO EN DemoPistas/DemoHorda a propósito. La landing carga los
 * dos demos con next/dynamic para sacarlos del bundle inicial (están abajo del
 * pliegue). Si la landing importara estas constantes desde el módulo del
 * componente, ese import estático arrastraría el componente entero de vuelta
 * al bundle principal y el dynamic no serviría de nada.
 *
 * Son fijos y hardcodeados —hay UN ejercicio por demo—, así que esto solo le
 * pone nombre a lo que ya existe. Cuando haya más de uno, ya hay dónde
 * colgarlo.
 */
export const DEMO_PISTAS_ID = 'pistas_bloques'
export const DEMO_HORDA_ID = 'horda_oleadas'
