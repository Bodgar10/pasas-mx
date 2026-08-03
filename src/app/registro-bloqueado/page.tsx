import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'El registro lo debe hacer un adulto | Pasas.mx',
  robots: { index: false, follow: false },
}

export default function RegistroBloqueadoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-bold">
          El registro lo debe hacer tu padre, madre o tutor
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-gray-300">
          Como eres menor de edad, la cuenta tiene que quedar a nombre de un
          adulto responsable. Ya cerramos la cuenta que se había creado y no
          guardamos tus datos.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
          <p className="mb-2 font-medium text-white">¿Qué sigue?</p>
          <p className="leading-relaxed">
            Pídele a tu padre, madre o tutor que entre a Pasas.mx y haga el
            registro. Tarda dos minutos, y tú puedes usar la cuenta para
            estudiar igual.
          </p>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-700"
        >
          Volver al inicio
        </Link>

        <p className="mt-6 text-xs text-gray-500">
          ¿Dudas? Escríbenos a soporte@pasas.mx
        </p>
      </div>
    </main>
  )
}
