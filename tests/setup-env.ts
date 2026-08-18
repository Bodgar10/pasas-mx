import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

/**
 * Carga .env.test ANTES de que corra cualquier archivo de prueba.
 *
 * Vitest garantiza que los `setupFiles` se ejecutan antes de importar los
 * tests, y eso es exactamente lo que hace falta: config.ts evalúa
 * PRICE_TO_PLAN en el momento del import, así que las variables tienen que
 * estar puestas antes de esa línea.
 *
 * 🔴 SE CARGA .env.test Y NADA MÁS.
 *
 * Vite carga por su cuenta la cascada .env → .env.local → .env.[mode], y
 * .env.local de este repo tiene la SUPABASE_SERVICE_ROLE_KEY de producción y
 * la ANTHROPIC_API_KEY reales. Nada de la capa unitaria las necesita, y
 * meterlas en el entorno de un proceso de pruebas es exponerlas sin motivo.
 * Apuntando a un path explícito, esa cascada no ocurre.
 *
 * `override: true` porque el valor del archivo tiene que ganarle a lo que ya
 * traiga el shell. Sin esto, una terminal donde alguien exportó las claves
 * reales para depurar produciría pruebas que pasan con los price IDs de
 * producción y fallan en cualquier otra máquina.
 */
const ruta = resolve(__dirname, '../.env.test')

if (!existsSync(ruta)) {
  throw new Error(
    `No se encontró ${ruta}.\n` +
      'La capa unitaria lo necesita para que PRICE_TO_PLAN se construya con ' +
      'seis claves distintas en vez de colapsar en "undefined".\n' +
      'Nota: .gitignore excluye .env* , así que este archivo puede no haber ' +
      'viajado con el repo.'
  )
}

config({ path: ruta, override: true, quiet: true })
