import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { verificarDestinoDb } from './guarda-db'

/**
 * Setup de la capa de INTEGRACIÓN. Carga el entorno y después comprueba,
 * antes de que corra una sola prueba, que la base de destino es la local.
 *
 * 🔴 VA EN `setupFiles`, NO EN UN `beforeAll`.
 *
 * Un `beforeAll` se ejecuta DESPUÉS de resolver los imports del archivo de
 * prueba. Si alguno de esos imports abre un cliente de Supabase al cargarse
 * —cosa que hace más de un módulo de este repo—, la conexión a producción ya
 * estaría hecha cuando el `beforeAll` se dignara a mirar. Los `setupFiles`
 * corren antes de todo eso.
 */
const ruta = resolve(__dirname, '../.env.test')

if (!existsSync(ruta)) {
  throw new Error(
    `No se encontró ${ruta}. La capa de integración lo necesita para saber ` +
      'a qué base apuntar.'
  )
}

/**
 * 🔴 SIN `override`, Y AL REVÉS QUE EN setup-env.ts DE LA CAPA UNITARIA.
 *
 * Con `override: true`, .env.test PISA lo que traiga el entorno. Eso allá es
 * correcto —no hay base de datos y el objetivo es que los price IDs sean
 * deterministas—, pero AQUÍ DEJABA LA GUARDA CIEGA: por muy mal que
 * apuntara el entorno, dotenv lo sustituía por la URL local antes de que
 * nadie mirara, y la guarda solo podía detectar que alguien hubiera editado
 * .env.test.
 *
 * Lo descubrió tests/unit/guarda-db-e2e.test.ts, que arrancaba la suite con
 * una URL de producción y la veía correr tan tranquila.
 *
 * Sin `override`, la URL que gana es la EFECTIVA —la del entorno si la hay,
 * .env.test si no— y es esa la que se somete a la guarda. Si alguien tiene
 * exportada una URL de producción en su shell, la suite se niega a arrancar
 * y le dice por qué, que es exactamente lo que debe pasar.
 */
config({ path: ruta, quiet: true })

// 🔴 La línea que importa de todo este archivo.
verificarDestinoDb(process.env.NEXT_PUBLIC_SUPABASE_URL)
