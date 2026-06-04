import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cómo cancelar tu suscripción | Pasas.mx',
  description:
    'Puedes cancelar tu suscripción de Pasas.mx en cualquier momento, sin penalización y en máximo 2 pasos.',
}

export default function ComoCancelarPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
          >
            ← Volver al inicio
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-white">
            Cómo cancelar tu suscripción
          </h1>
          <p className="mt-3 text-gray-400">
            Puedes cancelar cuando quieras, sin penalización. Seguirás teniendo
            acceso hasta el fin del periodo que ya pagaste.
          </p>
        </div>

        {/* Pasos */}
        <section className="mb-10 space-y-6">
          <h2 className="text-lg font-semibold text-white">
            Pasos para cancelar (máximo 2 clics)
          </h2>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold">
                1
              </span>
              <div>
                <p className="font-medium text-white">
                  Entra a tu perfil
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Inicia sesión y ve a{' '}
                  <Link
                    href="/perfil"
                    className="text-purple-400 underline hover:text-purple-300"
                  >
                    Pasas.mx/perfil
                  </Link>
                  . Ahí encontrarás la sección{' '}
                  <strong className="text-white">Mi suscripción</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold">
                2
              </span>
              <div>
                <p className="font-medium text-white">
                  Haz clic en "Cancelar suscripción"
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Confirma que deseas cancelar. Listo. No hay formularios extra
                  ni llamadas requeridas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Qué pasa después */}
        <section className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            ¿Qué pasa después de cancelar?
          </h2>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-400">✓</span>
              Tu suscripción <strong className="text-white">no se renueva</strong>{' '}
              en la siguiente fecha de cobro.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-400">✓</span>
              Sigues teniendo acceso completo hasta el{' '}
              <strong className="text-white">último día del periodo pagado</strong>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-400">✓</span>
              Tu cuenta y progreso se conservan. Puedes reactivar cuando quieras.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-400">✓</span>
              Recibirás un correo de confirmación de cancelación.
            </li>
          </ul>
        </section>

        {/* Reembolsos */}
        <section className="mb-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ¿Quieres reembolso?
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Si cancelaste dentro de los primeros 14 días de tu primer pago
            (no aplica para periodo de prueba), puedes solicitar reembolso completo
            desde tu perfil.
          </p>
          <Link
            href="/reembolso"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            Ver política de reembolso →
          </Link>
        </section>

        {/* Aviso PROFECO */}
        <section className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          <p className="font-medium text-white mb-1">Transparencia total</p>
          <p>
            De acuerdo con la Ley Federal de Protección al Consumidor (reforma
            diciembre 2025, Art. 76 Bis), tienes derecho a cancelar tu
            suscripción de renovación automática en cualquier momento y sin
            penalización. Pasas.mx cumple con esta obligación: la cancelación
            es efectiva en máximo 2 clics, sin obstáculos.
          </p>
        </section>

        {/* ¿Necesitas ayuda? */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ¿Necesitas ayuda?
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Si tienes algún problema al cancelar, escríbenos directamente:
          </p>

          <a
            href="mailto:hola@pasas.mx"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Contactar soporte
          </a>
        </section>

        {/* Footer links */}
        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-8 text-sm text-gray-500">
          <Link href="/privacidad" className="hover:text-gray-300">
            Privacidad
          </Link>
          <Link href="/terminos" className="hover:text-gray-300">
            Términos
          </Link>
          <Link href="/reembolso" className="hover:text-gray-300">
            Reembolso
          </Link>
          <Link href="/ayuda" className="hover:text-gray-300">
            Ayuda
          </Link>
        </div>
      </div>
    </main>
  )
}
