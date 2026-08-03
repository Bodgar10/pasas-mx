import type { Metadata } from 'next'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { autorizarMenor } from './actions'

export const metadata: Metadata = {
  title: 'Autorizar cuenta | Pasas.mx',
  robots: { index: false, follow: false },
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-md px-6 py-16">{children}</div>
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
    .select('full_name, parent_name, parental_consent_status, parental_consent_token_expires_at')
    .eq('parental_consent_token', token)
    .maybeSingle()

  // Éxito SOLO si la base lo dice. Antes esto se pintaba con un parámetro de
  // la URL, así que cualquiera podía ver "autorizado" sin haberlo hecho.
  if (usuario?.parental_consent_status === 'granted') {
    return (
      <Marco>
        <h1 className="text-2xl font-bold">Cuenta autorizada ✓</h1>
        <p className="mt-3 text-sm text-gray-400">
          Gracias. Ya puede entrar a estudiar. Guardamos la fecha y hora de tu
          autorización como constancia.
        </p>
      </Marco>
    )
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
          <input
            type="checkbox"
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
