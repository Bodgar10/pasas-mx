import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import ConsentimientoLegal from '@/components/legal/ConsentimientoLegal'
import CookieConsentInput from '@/components/legal/CookieConsentInput'
import Logo from '@/components/global/Logo'
import { guardarConsentimiento } from './actions'

export const metadata: Metadata = {
  title: 'Antes de empezar | Pasas.mx',
  robots: { index: false, follow: false },
}

export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.is_anonymous) {
    redirect('/login')
  }

  // Si ya aceptó, no tiene nada que hacer aquí. Esto además rompe cualquier
  // ciclo de redirección si el middleware se equivocara al leer el perfil.
  const { data: profile } = await supabase
    .from('users')
    .select('tos_accepted_at, role')
    .eq('id', user.id)
    .single()

  if (profile?.tos_accepted_at) {
    redirect(profile.role === 'admin' ? '/admin' : '/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="mb-6 flex items-center gap-2 text-purple-400">
          <Logo size={26} />
          <span className="text-sm font-bold tracking-widest">PASAS.MX</span>
        </div>
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
          <CookieConsentInput />

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
