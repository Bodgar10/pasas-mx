import Link from 'next/link'
import type { Metadata } from 'next'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

export const metadata: Metadata = {
  title: 'Ayuda y preguntas frecuentes | Pasas.mx',
  description:
    'Respuestas a las preguntas más comunes sobre Pasas.mx: suscripción, cancelación, reembolsos, planes y más.',
}

const FAQS = [
  {
    category: 'Suscripción y pagos',
    items: [
      {
        q: '¿Cómo funciona la prueba gratuita?',
        a: 'Tienes 7 días de acceso completo sin costo. Necesitas registrar una tarjeta, pero no se cobra nada hasta que termine el período de prueba. Puedes cancelar antes y no te cobramos absolutamente nada.',
      },
      {
        q: '¿Cada cuánto se cobra?',
        a: 'Depende del plan que elijas: mensual (cada mes), semestral (un pago cada 6 meses) o anual (un pago al año). Siempre recibirás un aviso 5 días antes de cada renovación.',
      },
      {
        q: '¿Puedo cambiar de plan?',
        a: FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN
          ? 'Sí. Puedes cambiar entre plan Estándar y Personalizado, o entre ciclos de facturación, desde tu perfil en cualquier momento.'
          : 'Sí. Puedes cambiar entre ciclos de facturación (mensual, semestral o anual) desde tu perfil en cualquier momento.',
      },
      {
        q: '¿Aceptan tarjetas de débito?',
        a: 'Sí, aceptamos tarjetas de débito y crédito Visa, Mastercard y American Express emitidas en México.',
      },
    ],
  },
  {
    category: 'Cancelación',
    items: [
      {
        q: '¿Cómo cancelo mi suscripción?',
        a: 'Desde tu perfil → sección "Suscripción" → botón "Cancelar suscripción". Son máximo 2 clics. También puedes ver la guía detallada en nuestra página de cancelación.',
      },
      {
        q: '¿Qué pasa cuando cancelo?',
        a: 'Tu suscripción no se renueva en la siguiente fecha de cobro. Sigues teniendo acceso completo hasta el último día del período que ya pagaste. Tu cuenta y progreso se conservan.',
      },
      {
        q: '¿Me cobran algo por cancelar?',
        a: 'No. La cancelación es completamente gratuita y sin penalización. Es tu derecho según la Ley Federal de Protección al Consumidor.',
      },
    ],
  },
  {
    category: 'Reembolsos',
    items: [
      {
        q: '¿Tienen política de reembolso?',
        a: 'Sí. Si cancelaste dentro de los primeros 14 días naturales desde tu primer pago real (no aplica para período de prueba), puedes solicitar reembolso completo.',
      },
      {
        q: '¿Cómo solicito un reembolso?',
        a: 'Desde la página de reembolso puedes solicitarlo en línea. Si el reembolso aplica (dentro de 14 días), se procesa automáticamente. Después de ese plazo lo revisamos caso por caso.',
      },
    ],
  },
  {
    category: 'Contenido y funciones',
    items: [
      {
        q: '¿Qué materias cubre Pasas?',
        a: 'Cubre las materias principales de secundaria en México: Matemáticas, Español, Historia, Geografía, Ciencias, Biología, Química y Física, entre otras.',
      },
      ...(FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN ? [{
        q: '¿Cuál es la diferencia entre el plan Estándar y el Personalizado?',
        a: 'El plan Estándar cubre todas las materias del currículo oficial. El plan Personalizado agrega un diagnóstico inicial y genera una guía de estudio única, adaptada al nivel y estilo de aprendizaje de cada alumno.',
      }] : []),
      {
        q: '¿Funciona para preparatoria también?',
        a: 'Por ahora el contenido está enfocado en secundaria. Próximamente ampliaremos a más niveles educativos.',
      },
      {
        q: '¿Puedo usar Pasas desde el celular?',
        a: 'Sí, Pasas está diseñado mobile-first. Funciona en cualquier navegador moderno desde tu teléfono, sin necesidad de descargar app.',
      },
    ],
  },
  {
    category: 'Cuenta y datos',
    items: [
      {
        q: '¿Mis datos están seguros?',
        a: 'Sí. Usamos Supabase con cifrado en tránsito y en reposo. Nunca vendemos datos a terceros. Puedes consultar nuestro Aviso de Privacidad para más detalle.',
      },
      {
        q: '¿Puedo eliminar mi cuenta?',
        a: 'Sí. Escríbenos a hola@pasas.mx y eliminamos tu cuenta y todos tus datos en máximo 5 días hábiles.',
      },
    ],
  },
]

export default function AyudaPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
          >
            ← Volver al inicio
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-white">
            Preguntas frecuentes
          </h1>
          <p className="mt-3 text-gray-400">
            ¿No encuentras lo que buscas?{' '}
            <a
              href="mailto:hola@pasas.mx"
              className="text-purple-400 underline hover:text-purple-300"
            >
              Escríbenos
            </a>{' '}
            y te respondemos en menos de 24 horas.
          </p>
        </div>

        {/* FAQs por categoría */}
        <div className="space-y-10">
          {FAQS.map((section) => (
            <div key={section.category}>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-purple-400">
                {section.category}
              </h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-xl border border-white/10 bg-white/5 px-5 py-4 open:border-purple-500/30 open:bg-purple-500/5"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <span>{item.q}</span>
                        <span className="mt-0.5 shrink-0 text-gray-500 transition-transform group-open:rotate-45">
                          +
                        </span>
                      </div>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-gray-400">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA de soporte */}
        <div className="mt-14 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="mb-1 text-base font-semibold text-white">
            ¿Todavía tienes dudas?
          </p>
          <p className="mb-5 text-sm text-gray-400">
            Nuestro equipo responde en menos de 24 horas en días hábiles.
          </p>

          <a
            href="mailto:hola@pasas.mx"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Escribirnos por correo
          </a>
        </div>

        {/* Footer links */}
        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-8 text-sm text-gray-500">
          <Link href="/privacidad" className="hover:text-gray-300">Privacidad</Link>
          <Link href="/terminos" className="hover:text-gray-300">Términos</Link>
          <Link href="/como-cancelar" className="hover:text-gray-300">Cómo cancelar</Link>
          <Link href="/reembolso" className="hover:text-gray-300">Reembolso</Link>
        </div>

      </div>
    </main>
  )
}
