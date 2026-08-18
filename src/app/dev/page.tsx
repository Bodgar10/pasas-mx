import { notFound } from 'next/navigation'
import DevClient from './dev-client'

/**
 * Banco de pruebas de la tubería de analítica. TEMPORAL.
 *
 * 🔴 404 en producción. La ruta es pública y no pasa por el middleware de
 * rutas protegidas, así que sin esta guarda quedaría un botón que dispara
 * eventos reales al alcance de cualquiera que adivine la URL.
 *
 * Para quitarlo: borrar la carpeta `src/app/dev/`. No lo importa nadie.
 */
export default function DevPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DevClient />
}
