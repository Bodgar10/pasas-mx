import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { autorizarMenor } from './actions'
import { destinoBienvenida, type CheckoutPendiente } from './destino'
import Logo from '@/components/global/Logo'

export const metadata: Metadata = {
  title: 'Autorizar cuenta | Pasas.mx',
  robots: { index: false, follow: false },
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="mb-6 flex items-center gap-2 text-purple-400">
          <Logo size={26} />
          <span className="text-sm font-bold tracking-widest">PASAS.MX</span>
        </div>
        {children}
      </div>
    </main>
  )
}

export default async function AutorizarMenorPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ estado?: string }>
}) {
  const { token } = await params
  const { estado } = await searchParams

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: usuario } = await serviceClient
    .from('users')
    .select('full_name, parent_name, parental_consent_status, parental_consent_token_expires_at, pending_checkout')
    .eq('parental_consent_token', token)
    .maybeSingle()

  /**
   * 🔴 AQUÍ HABÍA UNA PANTALLA DE "Cuenta autorizada ✓". NO LA DEVUELVAS.
   *
   * Era un callejón sin salida: confirmaba la autorización y no ofrecía un solo
   * enlace. El titular que se registró sin elegir plan aterrizaba ahí con
   * sesión, siendo dueño de la cuenta, y sin ninguna puerta al producto.
   *
   * En su lugar, el mismo destino que usa el formulario: /bienvenida.
   *
   * 🔴 Y ESTE REDIRECT HACE FALTA DE VERDAD, no es simetría decorativa. El
   * token NO se borra al usarse (ver la nota de actions.ts), así que la URL
   * sigue resolviendo durante 7 días. Sin esto, quien vuelva —marcador, botón
   * Atrás, segundo clic en el correo— se encontraría el formulario otra vez y
   * se le pediría firmar de nuevo una manifestación bajo protesta de decir
   * verdad que ya firmó. Eso es peor que la pantalla que acabamos de quitar.
   */
  if (usuario?.parental_consent_status === 'granted') {
    redirect(destinoBienvenida(usuario.pending_checkout as CheckoutPendiente))
  }

  const vencido =
    usuario &&
    (!usuario.parental_consent_token_expires_at ||
      new Date(usuario.parental_consent_token_expires_at) < new Date())

  // Mismo mensaje para token inexistente, ya usado o vencido: no confirmamos
  // a un extraño si un token existe o no.
  if (!usuario || vencido || estado === 'invalido' || estado === 'vencido') {
    return (
      <Marco>
        <h1 className="text-2xl font-bold">Este enlace ya no sirve</h1>
        <p className="mt-3 text-sm text-gray-400">
          Puede que ya se haya usado o que hayan pasado más de 7 días. Pídele al
          alumno que entre a su cuenta para que te lleguen instrucciones nuevas,
          o escríbenos a soporte@pasas.mx
        </p>
      </Marco>
    )
  }

  const alumno = usuario.full_name || 'el alumno'
  const tutor = usuario.parent_name || ''

  return (
    <Marco>
      <h1 className="text-2xl font-bold">Autoriza la cuenta de {alumno}</h1>

      {estado === 'error' && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          No pudimos guardar tu autorización. Inténtalo de nuevo.
        </div>
      )}

      {/* Solo se llega aquí con un POST que no traía la casilla marcada, que en
          un navegador normal no ocurre: lo corta el `required`. El aviso existe
          para que ese caso diga algo en vez de recargar en silencio. */}
      {estado === 'falta_declaracion' && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          Falta marcar la declaración. Sin ella no podemos registrar tu
          autorización.
        </div>
      )}

      <p className="mt-4 text-sm leading-relaxed text-gray-300">
        {tutor ? `${tutor}: ` : ''}
        {alumno} registró una cuenta en Pasas.mx. Como es menor de edad,
        necesitamos tu autorización para tratar sus datos personales.
      </p>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
        <p className="mb-3 font-medium text-white">Antes de autorizar</p>
        <p className="leading-relaxed">
          Lee el{' '}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 underline hover:text-purple-300"
          >
            Aviso de Privacidad
          </a>
          , donde explicamos qué datos tratamos, con qué finalidad y cómo puedes
          ejercer los derechos ARCO en cualquier momento.
        </p>
      </div>

      <form action={autorizarMenor} className="mt-8 space-y-6">
        <input type="hidden" name="token" value={token} />

        <label className="flex cursor-pointer items-start gap-3">
          {/*
            🔴 EL `name` ES LO QUE HACE QUE ESTO LLEGUE AL SERVIDOR.

            Sin él, la casilla no entra en el FormData y `autorizarMenor()` no
            puede verificarla: lo único que la hacía obligatoria era el
            `required`, que es validación de navegador y se salta con un POST
            armado a mano. Es una manifestación bajo protesta de decir verdad
            sobre la patria potestad de un menor — se guardaban la fecha y la IP
            como constancia, pero no la afirmación que constatan.

            El `required` se queda: corta el envío en el navegador antes de
            llegar al servidor, que es mejor experiencia. La comprobación del
            servidor es la que manda.
          */}
          <input
            type="checkbox"
            name="declaracion"
            required
            className="mt-1 h-4 w-4 shrink-0 accent-[#7c3aed]"
          />
          <span className="text-sm text-gray-300">
            Bajo protesta de decir verdad, manifiesto que los datos asentados son
            verdaderos, que ejerzo la patria potestad o tutela de {alumno} y que
            autorizo el tratamiento de sus datos personales conforme al Aviso de
            Privacidad.
          </span>
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-700"
        >
          Autorizar la cuenta
        </button>
      </form>

      <p className="mt-6 text-xs text-gray-500">
        Si no reconoces esta solicitud, cierra esta página. La cuenta no se
        activará.
      </p>
    </Marco>
  )
}
