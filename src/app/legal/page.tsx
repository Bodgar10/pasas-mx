import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import ConsentimientoLegal from '@/components/legal/ConsentimientoLegal'
import { guardarConsentimiento, reenviarAutorizacion } from './actions'

export const metadata: Metadata = {
  title: 'Antes de empezar | Pasas.mx',
  robots: { index: false, follow: false },
}

export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reenvio?: string }>
}) {
  const { error, reenvio } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.is_anonymous) {
    redirect('/login')
  }

  // Si ya aceptó, no tiene nada que hacer aquí. Esto además rompe cualquier
  // ciclo de redirección si el middleware se equivocara al leer el perfil.
  const { data: profile } = await supabase
    .from('users')
    .select('tos_accepted_at, role, parental_consent_status, parent_email')
    .eq('id', user.id)
    .single()

  // Ya consintió pero falta el tutor: pantalla de espera, no formulario.
  if (profile?.tos_accepted_at && profile.parental_consent_status === 'pending') {
    return (
      <main className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="mx-auto max-w-md px-6 py-16">
          <h1 className="text-2xl font-bold">Falta la autorización de tu tutor</h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-300">
            Le enviamos un correo a{' '}
            <strong className="text-white">{profile.parent_email}</strong> para
            que autorice tu cuenta. En cuanto lo haga, puedes entrar a estudiar.
          </p>
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-gray-300">
            <p className="mb-2 font-medium text-white">¿No le llegó?</p>
            <p className="leading-relaxed">
              Pídele que revise la carpeta de correo no deseado. También puedes
              volver a enviarlo:
            </p>

            {reenvio === 'ok' && (
              <p className="mt-3 text-green-400">
                Listo, se lo enviamos otra vez. El enlace anterior ya no sirve.
              </p>
            )}
            {reenvio === 'error' && (
              <p className="mt-3 text-amber-300">
                No pudimos enviarlo. Escríbenos a soporte@pasas.mx y lo
                resolvemos a mano.
              </p>
            )}

            <form action={reenviarAutorizacion} className="mt-4">
              <button
                type="submit"
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
              >
                Reenviar correo
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  if (profile?.tos_accepted_at) {
    redirect(profile.role === 'admin' ? '/admin' : '/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-bold text-white">Antes de empezar</h1>
        <p className="mt-3 text-sm text-gray-400">
          Nos faltan un par de datos para poder abrirte la cuenta. Es rápido y
          solo se pide una vez.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
            {error}
          </div>
        )}

        <form action={guardarConsentimiento} className="mt-8 space-y-6">
          <ConsentimientoLegal />

          <button
            type="submit"
            className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-700"
          >
            Continuar
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          Puedes consultar el{' '}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 underline hover:text-purple-300"
          >
            Aviso de Privacidad
          </a>{' '}
          en cualquier momento.
        </p>
      </div>
    </main>
  )
}
