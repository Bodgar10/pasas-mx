import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | Pasas.mx',
  description:
    'Términos y Condiciones Generales de Uso de Pasas.mx: suscripciones, pagos, cancelación, reembolsos y propiedad intelectual.',
}

const INDICE = [
  { id: 'preambulo', numero: '1', titulo: 'Preámbulo, identificación y objeto' },
  { id: 'cuenta', numero: '2', titulo: 'Cuenta de usuario y capacidad' },
  { id: 'pagos', numero: '3', titulo: 'Compras, pagos y facturación' },
  { id: 'prohibiciones', numero: '4', titulo: 'Prohibiciones de uso' },
  { id: 'propiedad', numero: '5', titulo: 'Propiedad intelectual y licencia de uso' },
  { id: 'responsabilidad', numero: '6', titulo: 'Responsabilidad y exclusión de garantías' },
  { id: 'asistencia', numero: '7', titulo: 'Asistencia y quejas' },
  { id: 'referidos', numero: '8', titulo: 'Programa de referidos' },
  { id: 'jurisdiccion', numero: '9', titulo: 'Legislación aplicable y jurisdicción' },
]

function Seccion({
  id,
  numero,
  titulo,
  children,
}: {
  id: string
  numero: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-white/10 pt-8">
      <h2 className="text-lg font-semibold text-white">
        <span className="mr-2 text-purple-400">{numero}.</span>
        {titulo}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-300">
        {children}
      </div>
    </section>
  )
}

export default function TerminosPage() {
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
            Términos y Condiciones Generales de Uso
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Última actualización: 5 de agosto de 2026
          </p>
          <p className="mt-4 text-gray-400">
            Este documento regula la relación entre Pasas.mx y quienes usan o
            contratan sus servicios. Puedes leerlo, imprimirlo o descargarlo en
            cualquier momento.
          </p>
        </div>

        {/* Atajo cancelación */}
        <section className="mb-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ¿Buscas cómo cancelar tu suscripción?
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Puedes hacerlo en dos clics desde tu perfil, sin llamadas ni
            penalizaciones. Te avisamos por correo 5 días hábiles antes de cada
            renovación.
          </p>
          <Link
            href="/como-cancelar"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            Ver instrucciones →
          </Link>
        </section>

        {/* Índice */}
        <nav className="mb-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Contenido</h2>
          <ol className="space-y-2 text-sm">
            {INDICE.map(({ id, numero, titulo }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-purple-400 hover:text-purple-300"
                >
                  <span className="mr-2 text-gray-500">{numero}.</span>
                  {titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Seccion
            id="preambulo"
            numero="1"
            titulo="Preámbulo, identificación y objeto"
          >
            <h3 className="pt-2 font-medium text-white">1.1. Bienvenida y aceptación</h3>
            <p>
              ¡Bienvenido a Pasas.mx! El presente documento constituye el
              contrato que regula las condiciones de uso (en adelante, los
              “Términos y Condiciones”) entre Bodgar Jair Espinosa Miranda (en
              adelante, “Pasas.mx”, el “Prestador” o la “Plataforma”) y los
              usuarios que accedan, naveguen o se suscriban a sus servicios.
            </p>
            <p>
              El acceso, navegación, uso de la Plataforma y la aceptación de la
              casilla de verificación dispuesta en el flujo de registro, ya sea
              mediante el sitio web o la aplicación móvil (en adelante, el
              “Sitio”), implica la aceptación total, incondicional y expresa del
              contenido de los presentes Términos y Condiciones.
            </p>
            <p>
              El Usuario puede acceder, imprimir, descargar y guardar los
              Términos y Condiciones en todo momento. Estos Términos y
              Condiciones estarán permanentemente accesibles en el Sitio a
              través del enlace https://pasas.mx/terminos
            </p>
            <p>
              Pasas.mx se reserva la posibilidad de modificar el contenido de
              los Términos y Condiciones en cualquier momento. Se recomienda que
              el Usuario lea detenidamente los textos contenidos en los mismos
              antes del acceso y la utilización de cualquier servicio del Sitio.
              En caso de modificaciones, éstas serán informadas a través de una
              publicación general en la Plataforma o bien a través del correo
              electrónico dado de alta para la creación de la cuenta de Usuario.
            </p>

            <h3 className="pt-2 font-medium text-white">1.2. Identificación del Prestador</h3>
            <p>
              En cumplimiento de lo dispuesto con el Artículo 76 BIS de la Ley
              Federal de Protección al Consumidor (LFPC), se proporciona la
              siguiente información del Prestador:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Nombre: Bodgar Jair Espinosa Miranda.</li>
              <li>
                Domicilio: Privada Lázaro Cárdenas Número 24, Tres Marías,
                Municipio de Huitzilac, Morelos, Código Postal 62515, México.
              </li>
              <li>Sitio web: https://pasas.mx</li>
              <li>Correo de contacto: soporte@pasas.mx</li>
            </ol>

            <h3 className="pt-2 font-medium text-white">1.3. Definiciones</h3>
            <p>
              Para efectos de seguridad jurídica y precisión técnica, se adoptan
              los siguientes términos:
            </p>
            <ol className="ml-5 list-[upper-roman] space-y-2">
              <li>
                <strong className="text-white">Alumno:</strong> Usuario final
                menor de edad (entre 12 y 17 años) que utiliza el contenido
                educativo de la Plataforma.
              </li>
              <li>
                <strong className="text-white">CFDI:</strong> Comprobante Fiscal
                Digital por Internet. Documento electrónico que constituye la
                factura válida ante el Servicio de Administración Tributaria
                (SAT) que acredita la adquisición de los servicios por parte del
                Usuario.
              </li>
              <li>
                <strong className="text-white">Click to cancel:</strong> Estándar
                internacional de facilidad de cancelación que garantiza que el
                usuario pueda cancelar su suscripción de manera tan sencilla
                como la realizó, mediante un procedimiento directo y accesible.
              </li>
              <li>
                <strong className="text-white">Cuenta de Usuario:</strong>{' '}
                Credencial de acceso y licencia obligatoria otorgada por
                Pasas.mx que permitirá al alumno navegar por el portal educativo
                y acceder de forma individual a sus lecciones y diagnósticos
                personalizados.
              </li>
              <li>
                <strong className="text-white">Inteligencia Artificial (IA):</strong>{' '}
                Se refiere a los algoritmos, modelos computacionales y
                tecnologías de procesamiento de datos utilizados por la
                Plataforma para generar, personalizar y estructurar las rutas de
                aprendizaje, guías de estudio y diagnósticos educativos
                ofrecidos al Alumno.
              </li>
              <li>
                <strong className="text-white">Know-how:</strong> El término que
                hace referencia al conjunto de habilidades, conocimientos
                prácticos y experiencias acumuladas por Pasas.mx.
              </li>
              <li>
                <strong className="text-white">LFDA:</strong> Ley Federal del
                Derecho de Autor.
              </li>
              <li>
                <strong className="text-white">LFPDPPP:</strong> Ley Federal de
                Protección de Datos Personales en Posesión de los Particulares.
              </li>
              <li>
                <strong className="text-white">LFPC:</strong> Ley Federal de
                Protección al Consumidor.
              </li>
              <li>
                <strong className="text-white">LFPPI:</strong> Ley Federal de
                Protección a la Propiedad Intelectual.
              </li>
              <li>
                <strong className="text-white">LGDNNA:</strong> Ley General de
                los Derechos de Niñas, Niños y Adolescentes. Ordenamiento
                jurídico que establece los principios rectores y derechos de los
                menores, cuyo cumplimiento es obligatorio para la Plataforma en
                el tratamiento de datos y protección de los usuarios menores de
                edad.
              </li>
              <li>
                <strong className="text-white">Pasas.mx:</strong> Plataforma de
                servicios educativos digitales, propiedad de Bodgar Jair
                Espinosa Miranda.
              </li>
              <li>
                <strong className="text-white">Periodo de prueba:</strong> Lapso
                de 7 (siete) días naturales otorgado al Usuario tras el
                registro, durante el cual puede evaluar las funciones del
                ecosistema digital sin costo alguno, previo a la activación del
                primer cobro recurrente.
              </li>
              <li>
                <strong className="text-white">PROFECO:</strong> Procuraduría
                Federal del Consumidor. Organismo descentralizado del Estado
                mexicano encargado de promover y proteger los derechos e
                intereses de los consumidores, ante quien el Usuario puede
                acudir en caso de controversias no resueltas.
              </li>
              <li>
                <strong className="text-white">Sitio:</strong> Se refiere a la
                página web interactiva https://pasas.mx
              </li>
              <li>
                <strong className="text-white">Stripe:</strong> Procesador de
                pagos externo y autorizado que gestiona la pasarela de
                transacciones financieras de la Plataforma, siendo el único
                responsable del tratamiento y resguardo de los datos bancarios
                del Usuario.
              </li>
              <li>
                <strong className="text-white">Suscripción:</strong> Modalidad
                de acceso al servicio mediante el pago recurrente (mensual,
                semestral o anual) que otorga al Usuario el derecho de uso de la
                plataforma y sus recursos educativos durante el periodo
                contratado.
              </li>
              <li>
                <strong className="text-white">Tutor/Padre/Madre:</strong>{' '}
                Persona mayor de edad que ejerce la patria potestad o tutela
                legal del Alumno y que es la titular de la Cuenta de Usuario y
                responsable de los pagos.
              </li>
              <li>
                <strong className="text-white">Uso Sustancial del Servicio:</strong>{' '}
                Se considerará que el Usuario ha hecho un “uso sustancial” de la
                Plataforma, impidiendo la procedencia de un reembolso, cuando
                ocurra cualquiera de las siguientes condiciones:
                <ul className="ml-5 mt-2 list-[upper-alpha] space-y-1">
                  <li>
                    <strong className="text-white">Consumo de Contenido:</strong>{' '}
                    El Alumno haya completado al menos 1 (una) unidad de
                    aprendizaje, lección, ejercicio o diagnóstico personalizado
                    disponible en la Plataforma.
                  </li>
                  <li>
                    <strong className="text-white">Tiempo de Conexión:</strong>{' '}
                    El Usuario registre un tiempo de navegación acumulado
                    superior a 60 (sesenta) minutos dentro de la Plataforma.
                  </li>
                  <li>
                    <strong className="text-white">Descargas:</strong> El Usuario
                    haya descargado cualquier material de estudio, PDF o recurso
                    educativo exclusivo disponible para su nivel académico.
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-white">Usuario:</strong> Cualquier
                persona física que acceda y contrate los servicios ofrecidos por
                Pasas.mx y que cree una cuenta de usuario.
              </li>
            </ol>

            <h3 className="pt-2 font-medium text-white">1.4. Objeto</h3>
            <p>
              El objeto del presente contrato es formalizar y regular la
              prestación de servicios educativos digitales ofrecidos por
              Pasas.mx a través de su plataforma web interactiva. Este servicio
              se constituye como una herramienta de apoyo académico integral
              basada en un modelo de suscripción, diseñada para proporcionar a
              los Usuarios acceso a contenidos educativos especializados, guías
              de estudio, lecciones interactivas por materia, evaluaciones
              diagnósticas y planes de estudio personalizados, orientados
              específicamente a estudiantes de nivel secundaria y bachillerato
              en los Estados Unidos Mexicanos.
            </p>
            <p>
              Dichos contenidos y rutas de aprendizaje se generan y personalizan
              mediante el uso de tecnologías de Inteligencia Artificial en
              atención al grado académico, nivel escolar e intereses
              particulares informados por el Alumno. Los Planes se ofrecen en
              modalidades mensual, semestral y anual.
            </p>
            <p>
              El acceso al servicio se encuentra condicionado de forma
              obligatoria a la creación previa de una Cuenta de Usuario.
            </p>

            <h3 className="pt-2 font-medium text-white">
              1.5. Requisitos técnicos y de conectividad
            </h3>
            <p>
              Para garantizar el funcionamiento óptimo y una experiencia de
              usuario adecuada, el acceso a la Plataforma requiere que el
              Usuario cuente con un dispositivo electrónico (computadora,
              tableta o teléfono inteligente) con una conexión a internet
              estable y suficiente. Asimismo, el Usuario deberá utilizar un
              navegador web moderno (Google Chrome, Safari, Mozilla Firefox,
              Microsoft Edge o navegadores basados en tecnología Chromium),
              actualizado a su versión más reciente.
            </p>
            <p>
              Dado que la Plataforma es un entorno web con diseño responsivo, es
              responsabilidad exclusiva del Usuario disponer del hardware,
              software y servicios de telecomunicaciones necesarios para el
              acceso al servicio. Pasas.mx no se hace responsable por
              deficiencias, interrupciones o fallas en la visualización del
              contenido que sean atribuibles a la calidad de la conexión a
              internet del Usuario, al uso de dispositivos obsoletos, o a
              configuraciones de software incompatibles o desactualizadas por
              parte de este.
            </p>
          </Seccion>

          <Seccion id="cuenta" numero="2" titulo="Cuenta de usuario y capacidad">
            <h3 className="pt-2 font-medium text-white">2.1. Capacidad jurídica y registro</h3>
            <p>
              En estricto cumplimiento con la LFPDPPP y la LGDNNA, y reconociendo
              que los usuarios finales del contenido educativo son
              predominantemente menores de edad (entre 12 y 17 años), se
              establece que el titular de la Cuenta de Usuario y responsable de
              las obligaciones contractuales y de pago deberá ser, de forma
              imperativa, una persona mayor de edad con plena capacidad legal que
              ejerza la patria potestad o tutela legal del Alumno.
            </p>
            <p>
              Mediante el registro, el tutor legal otorga su consentimiento
              expreso para el tratamiento de sus datos personales y los del
              Alumno, conforme al Aviso de Privacidad. El Usuario declara bajo
              protesta de decir verdad que la información proporcionada es
              auténtica y legítima. En caso de detectarse el uso de datos falsos,
              suplantación de identidad o falta de capacidad legal por parte del
              registrante, Pasas.mx se reserva el derecho de proceder a la
              cancelación inmediata y unilateral de la cuenta, sin que esto
              genere responsabilidad alguna para la Plataforma.
            </p>

            <h3 className="pt-2 font-medium text-white">2.2. Datos requeridos para el registro</h3>
            <p>
              El registro para la creación de una Cuenta de Usuario requerirá que
              se proporcione la siguiente información personal y del alumno,
              misma que deberá ser exacta, completa y actualizada:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>
                Del padre, madre o tutor (responsable del pago y titular de la
                cuenta):
                <ul className="ml-5 mt-2 list-[lower-alpha] space-y-1">
                  <li>Nombre completo.</li>
                  <li>Correo electrónico.</li>
                  <li>
                    Declaración bajo protesta de patria potestad (para acreditar
                    la mayoría de edad). Domicilio.
                  </li>
                  <li>Datos de pago.</li>
                </ul>
              </li>
              <li>
                Del Alumno (usuario final):
                <ul className="ml-5 mt-2 list-[lower-alpha] space-y-1">
                  <li>Nombre completo.</li>
                  <li>Nombre del padre, madre o tutor.</li>
                  <li>Grado académico y nivel escolar.</li>
                  <li>Intereses educativos.</li>
                </ul>
              </li>
            </ol>
            <p>
              Asimismo, las personas mayores de edad (18 años o más) podrán
              realizar la contratación de los servicios de la Plataforma por su
              propia cuenta y a su nombre, para lo cual deberán cumplir con los
              mismos requisitos de registro e información señalados anteriormente
              para el padre, madre o tutor.
            </p>
            <p>
              Se hace del conocimiento del Usuario que la administración de sus
              activos financieros y bancarios se efectúa de manera exclusiva
              mediante Stripe, procesador de pagos externo y facultado por la
              Plataforma. El tratamiento de dicha información se limita
              estrictamente a la gestión de transacciones y cobros automáticos,
              precisando que Pasas.mx no almacena ni recopila estos datos
              sensibles, cuya custodia recae únicamente en el citado proveedor.
              Para mayor información respecto al manejo de su esfera personal, se
              recomienda la consulta del{' '}
              <Link href="/privacidad" className="text-purple-400 underline hover:text-purple-300">
                Aviso de Privacidad
              </Link>
              .
            </p>
            <p>
              El Usuario se compromete a mantener la información exacta, completa
              y actualizada; de lo contrario, podrá resultar en la imposibilidad
              para acceder a la cuenta.
            </p>

            <h3 className="pt-2 font-medium text-white">
              2.3. Restricciones para la creación de la cuenta de usuario
            </h3>
            <p>
              Las personas menores de edad (entre 12 y 17 años) pueden navegar y
              usar el entorno educativo, pero no podrán crear una cuenta de
              usuario de forma autónoma ni contratar las suscripciones sin la
              intervención de sus padres o tutores legales, quienes responden de
              manera expresa por las obligaciones contraídas.
            </p>
            <p>
              En respeto al derecho a la intimidad y protección de datos
              personales de niñas, niños y adolescentes, previsto en el artículo
              13, fracción XVII, así como en los artículos 76, 77 y 78 de la
              LGDNNA, se reconoce que quienes ejercen la patria potestad, tutela
              o guarda y custodia tienen la responsabilidad de orientar,
              supervisar y, en su caso, restringir las conductas y hábitos
              digitales de las personas menores de edad, siempre bajo el
              principio del interés superior de la niñez.
            </p>
            <p>
              Sin perjuicio de los mecanismos de verificación implementados por
              Pasas.mx, la Plataforma no asume responsabilidad alguna por el
              acceso, registro o navegación realizados por menores de edad que
              contravengan las presentes restricciones o que se ejecuten sin la
              supervisión efectiva, autorización y consentimiento expreso de sus
              padres o tutores legales. El uso del sitio por parte del menor bajo
              la premisa de haber obtenido dicha supervisión recae exclusivamente
              en la esfera de responsabilidad de quien ejerce la patria potestad
              o tutela.
            </p>
          </Seccion>

          <Seccion id="pagos" numero="3" titulo="Compras, pagos y facturación">
            <h3 className="pt-2 font-medium text-white">
              3.1. Proceso de compra, confirmación y facturación
            </h3>
            <p>
              Pasas.mx utiliza plataformas y pasarelas de pago externas para el
              procesamiento de las transacciones financieras. Una vez realizada
              la contratación y procesado el pago de la suscripción, la
              Plataforma procederá a formalizar la prestación del servicio
              mediante el envío de la confirmación correspondiente, conforme a lo
              establecido en los incisos siguientes.
            </p>
            <p className="font-medium text-white">A. Confirmación de pago y plazos</p>
            <p>
              Dentro de las 24 (veinticuatro) horas siguientes a la recepción del
              pago, Pasas.mx enviará un correo electrónico de confirmación a la
              dirección registrada por el Usuario. Dicho correo contendrá el
              resumen de la transacción (producto o servicio adquirido,
              periodicidad, monto y fecha de cobro), así como:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>El número de folio de la operación.</li>
              <li>Las instrucciones para acceder al servicio contratado.</li>
              <li>La información de contacto para aclaraciones o quejas.</li>
            </ol>
            <p>
              El correo de confirmación constituye el recibo de pago para efectos
              informativos, y su contenido no constituye un comprobante fiscal
              con efectos ante el Servicio de Administración Tributaria (SAT).
            </p>
            <p className="font-medium text-white">
              B. Emisión del Comprobante Fiscal Digital por Internet (CFDI)
            </p>
            <p>
              El Usuario podrá solicitar la emisión del CFDI correspondiente a la
              operación, mediante el envío de un correo electrónico a
              soporte@pasas.mx, con el asunto “Solicitud de CFDI - [Nombre del
              Usuario]” y adjuntando los siguientes datos:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Nombre completo (razón social o nombre del titular).</li>
              <li>
                Registro Federal de Contribuyentes (RFC) de la persona física o
                moral que adquiere el servicio.
              </li>
              <li>
                Domicilio fiscal (calle, número exterior e interior, colonia,
                ciudad, estado, código postal).
              </li>
              <li>Correo electrónico para la recepción del CFDI.</li>
              <li>
                Número de folio de la operación (contenido en el correo de
                confirmación).
              </li>
              <li>En su caso, el régimen fiscal del contribuyente.</li>
            </ol>
            <p>
              Pasas.mx emitirá el CFDI en un plazo máximo de 5 (cinco) días
              hábiles, contados a partir de la recepción de la solicitud
              completa. El comprobante será enviado al correo electrónico del
              Usuario en formato XML y PDF, o en cualquier otro formato permitido
              por la legislación fiscal vigente, dando así cumplimiento a lo
              dispuesto por el Código Fiscal de la Federación y demás normativas
              aplicables.
            </p>
            <p className="font-medium text-white">C. Tratamiento de datos fiscales</p>
            <p>
              Los datos fiscales proporcionados por el Usuario (RFC, domicilio
              fiscal y demás información) serán tratados exclusivamente para la
              emisión del CFDI y el cumplimiento de las obligaciones fiscales de
              Pasas.mx y en cumplimiento del Aviso de Privacidad vigente.
            </p>
            <p className="font-medium text-white">D. Responsabilidad del Usuario</p>
            <p>
              El Usuario es el único responsable de la veracidad y exactitud de
              los datos fiscales proporcionados para la emisión del CFDI.
              Pasas.mx no se hace responsable por errores, omisiones o
              inexactitudes en el comprobante derivados de información incorrecta
              proporcionada por el Usuario. En caso de que el Usuario requiera la
              cancelación o sustitución de un CFDI emitido, deberá solicitarlo
              dentro de los 5 (cinco) días hábiles siguientes a su recepción,
              acreditando la causa de la corrección. Pasas.mx atenderá dicha
              solicitud en un plazo no mayor a 5 (cinco) días hábiles, siempre
              que la solicitud sea procedente conforme a la legislación fiscal
              aplicable.
            </p>
            <p className="font-medium text-white">E. Sin perjuicio del derecho a facturar</p>
            <p>
              La falta de solicitud del CFDI por parte del Usuario no exime a
              Pasas.mx de la obligación de expedir el comprobante, en términos
              del artículo 29 del Código Fiscal de la Federación. Pasas.mx
              conservará un registro de las operaciones y emitirá el CFDI a
              solicitud del Usuario, aun cuando la solicitud se realice con
              posterioridad, siempre que la operación se encuentre dentro del
              plazo legal para su expedición (generalmente dentro del mes
              calendario en que se realizó el cargo).
            </p>

            <h3 className="pt-2 font-medium text-white">3.2. Pagos</h3>
            <p>
              Los servicios podrán ser contratados bajo las modalidades: (i)
              mensual, (ii) semestral o (iii) anual.
            </p>
            <p>
              El procesamiento de pagos mediante tarjeta de crédito o débito se
              realiza exclusivamente a través de pasarelas externas seleccionadas
              por Pasas.mx.
            </p>
            <p>
              La Plataforma no almacena ni procesa datos bancarios, limitándose a
              redirigir al Usuario hacia Stripe, el procesador autorizado, quien
              es el único responsable del tratamiento de la información
              financiera y de la custodia de los fondos. Por consiguiente,
              Pasas.mx no asume responsabilidad directa ni actúa como
              intermediario en el procesamiento de dichos pagos.
            </p>

            <h3 className="pt-2 font-medium text-white">3.3. Precios y moneda</h3>
            <p>
              Todos los precios publicados en la Plataforma se encuentran
              expresados en Moneda Nacional (Pesos Mexicanos/MXN) e incluyen el
              Impuesto al Valor Agregado (IVA), de conformidad con lo establecido
              en el Artículo 7 BIS de la LFPC.
            </p>
            <p>
              Los planes de suscripción semestral y anual cuentan con tarifas
              preferenciales respecto a la modalidad mensual.
            </p>
            <p>
              Pasas.mx podrá, a su absoluta discreción, implementar promociones
              temporales o descuentos especiales, los cuales serán publicados en
              el Sitio o comunicados directamente a los Usuarios. Dichas
              promociones estarán sujetas a la vigencia y condiciones que se
              establezcan de manera visible en el aviso respectivo.
            </p>

            <h3 className="pt-2 font-medium text-white">3.4. Renovación y cancelación</h3>
            <p>
              En apego a lo dispuesto por el artículo 76 bis, fracciones VIII y
              IX de la LFPC, se informa lo siguiente:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>
                El servicio contratado implica cobros automáticos recurrentes a
                la cuenta bancaria señalada por el Usuario, bajo la modalidad
                elegida (mensual, semestral o anual). El monto del cobro será el
                precio vigente publicado en el Sitio para el plan seleccionado.
                Para las modalidades semestral o anual, el precio se mantendrá
                fijo durante la vigencia del periodo contratado.
              </li>
              <li>
                Pasas.mx realizará el cobro de manera automática. Para ello,
                notificará al Usuario con al menos 5 (cinco) días hábiles de
                anticipación a la renovación automática del servicio o, en su
                caso, a cualquier incremento en el costo del servicio, mediante
                correo electrónico enviado a la dirección registrada. Ante la
                recepción de dicha notificación, el Usuario contará con un plazo
                de 5 (cinco) días contados a partir de la fecha de recepción para
                ejercer su derecho a cancelar los servicios sin penalización
                alguna.
              </li>
              <li>
                De conformidad con el estándar internacional “Click to Cancel” y
                lo establecido en la fracción IX del artículo 76 bis de la LFPC,
                Pasas.mx implementará los mecanismos eficaces para que el Usuario
                pueda realizar la cancelación inmediata de la suscripción. El
                Usuario podrá ejercer este derecho en cualquier momento desde su
                panel de control de usuario, mediante un procedimiento
                simplificado. La cancelación detendrá las renovaciones
                automáticas subsecuentes y el Usuario mantendrá el derecho de
                acceso al servicio hasta la conclusión del periodo previamente
                pagado.
              </li>
            </ol>
            <p>
              Para cualquier aclaración relacionada con los costos, pagos o
              periodos de cobro, el Usuario podrá escribir al siguiente correo
              electrónico: soporte@pasas.mx.
            </p>

            <h3 className="pt-2 font-medium text-white">3.5. Reembolsos</h3>
            <p>
              El Usuario podrá solicitar un reembolso mediante correo electrónico
              a soporte@pasas.mx, indicando el motivo de su solicitud y
              adjuntando el comprobante de pago correspondiente. Pasas.mx se
              compromete a emitir una resolución respecto a la solicitud recibida
              en un término no mayor a 5 (cinco) días hábiles. Es imperativo
              precisar que dicho periodo comprende exclusivamente la gestión
              interna para el inicio del procedimiento de devolución. El equipo
              de Pasas.mx no asume responsabilidad alguna por demoras o falta de
              acreditación de los fondos, toda vez que dichas operaciones
              financieras se ejecutan a través de entes externos y se encuentran
              fuera de la esfera de competencia técnica de la Plataforma.
            </p>
            <p>Las condiciones para la procedencia de reembolsos son las siguientes:</p>
            <ol className="ml-5 list-[upper-alpha] space-y-2">
              <li>
                <strong className="text-white">Derecho de retracto:</strong> Se
                otorgará un reembolso total si la solicitud se presenta dentro de
                los 7 (siete) días naturales siguientes al primer cobro, siempre
                que el Usuario no haya hecho un uso sustancial del servicio.
              </li>
              <li>
                <strong className="text-white">Renovaciones y periodos en curso:</strong>{' '}
                No procederán reembolsos por periodos ya transcurridos ni por
                renovaciones automáticas que hayan iniciado su vigencia. La
                cancelación detendrá únicamente la siguiente renovación, sin
                reembolsar el periodo en curso.
              </li>
              <li>
                <strong className="text-white">Falta de uso:</strong> Transcurrido
                el plazo de 7 (siete) días naturales posterior al primer cobro,
                la falta de uso del servicio por parte del Usuario no generará
                derecho a reembolso alguno.
              </li>
              <li>
                <strong className="text-white">Fallas técnicas:</strong> En caso
                de fallas técnicas imputables exclusivamente a Pasas.mx, se
                evaluará la procedencia de un reembolso o la aplicación de un
                crédito a favor del Usuario.
              </li>
            </ol>
          </Seccion>

          <Seccion id="prohibiciones" numero="4" titulo="Prohibiciones de uso">
            <p>
              El uso de Pasas.mx está destinado exclusivamente a fines
              educativos, personales e individuales del Alumno, orientados al
              estudio y refuerzo de materias escolares mediante las herramientas
              de la Plataforma (guías, lecciones, diagnósticos y planes
              personalizados). Cualquier uso comercial, institucional o distinto
              a los fines educativos descritos se encuentra estrictamente
              prohibido sin autorización previa y por escrito de Pasas.mx.
            </p>
            <p>
              Sin perjuicio de lo anterior, el Usuario se compromete a hacer un
              uso lícito y apropiado del Sitio, quedando expresamente prohibido
              llevar a cabo, de manera enunciativa más no limitativa, las
              siguientes conductas:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>
                Compartir, transferir o divulgar la cuenta de usuario o las
                credenciales de acceso con terceras personas.
              </li>
              <li>
                Revender, redistribuir, sublicenciar o explotar económicamente el
                contenido alojado en la plataforma.
              </li>
              <li>
                Copiar, reproducir, descargar masivamente o extraer datos o
                contenidos mediante herramientas automatizadas o mecanismos de
                scraping.
              </li>
              <li>
                Vulnerar, corromper o violar las medidas de seguridad de la
                infraestructura tecnológica de la plataforma.
              </li>
              <li>
                Utilizar los servicios de Pasas.mx con fines ilícitos o contrarios
                a las normativas vigentes.
              </li>
              <li>Registrar datos falsos o suplantar la identidad de un tutor legal.</li>
              <li>
                Eludir, modificar, descompilar, aplicar ingeniería inversa o
                extraer los modelos, algoritmos, conjuntos de datos,
                instrucciones o parámetros de IA utilizados por la Plataforma.
              </li>
              <li>
                Utilizar el contenido para entrenar, alimentar o validar modelos
                de inteligencia artificial propios o de terceros.
              </li>
            </ol>
            <p>
              El Usuario es consciente de que el uso del Sitio ocurre bajo su
              única y exclusiva responsabilidad. La violación de estas
              prohibiciones será causa de suspensión o cancelación unilateral de
              la cuenta sin responsabilidad para Pasas.mx.
            </p>
          </Seccion>

          <Seccion
            id="propiedad"
            numero="5"
            titulo="Propiedad intelectual, protección de la inversión y licencia de uso"
          >
            <h3 className="pt-2 font-medium text-white">
              5.1. Titularidad de la Plataforma y contenidos originales
            </h3>
            <p>
              Pasas.mx es titular o licenciataria legítima de todos los derechos
              de propiedad intelectual e industrial que recaen sobre la
              estructura, diseño, código fuente, interfaz, bases de datos,
              marcas, nombres comerciales, logotipos, gráficos, textos originales
              y demás elementos creativos de naturaleza humana incorporados a la
              Plataforma. Dichos elementos están protegidos por la LFDA y la
              LFPPI.
            </p>

            <h3 className="pt-2 font-medium text-white">
              5.2. Contenido generado por Inteligencia Artificial y protección de
              los programas de IA
            </h3>
            <p>
              La Plataforma integra herramientas de Inteligencia Artificial como
              parte de su servicio, las cuales asisten en la generación,
              estructuración y personalización de guías, lecciones, ejercicios y
              diagnósticos.
            </p>
            <p>
              Pasas.mx no reclama autoría ni titularidad de derechos de autor
              sobre aquellos materiales que sean generados de manera
              exclusivamente artificial, en el entendido de que dicha producción
              carece, por su naturaleza, de un autor humano en los términos de la
              ley. No obstante, las partes reconocen que:
            </p>
            <ol className="ml-5 list-[upper-alpha] space-y-2">
              <li>
                <strong className="text-white">Protección del software de IA.</strong>{' '}
                Los programas de computación, incluidos aquellos que implementan
                sistemas de inteligencia artificial utilizados en la Plataforma,
                se protegen en los mismos términos que las obras literarias, de
                conformidad con el artículo 102 de la LFDA. Dicha protección se
                extiende tanto al código fuente como al código objeto, así como a
                los modelos entrenados, parámetros, arquitectura y demás
                elementos que constituyen el programa, sin que ello implique
                atribuir autoría a la IA sobre los contenidos que esta genera.
              </li>
              <li>
                <strong className="text-white">Protección de la compilación y la inversión.</strong>{' '}
                La selección, coordinación, disposición, estructuración y
                personalización de los contenidos ofrecidos en la Plataforma
                constituye una inversión económica, técnica y organizativa
                sustancial por parte de Pasas.mx, y se protege como obra
                colectiva, compilación o base de datos en los términos de la
                legislación mexicana.
              </li>
              <li>
                <strong className="text-white">Secretos industriales y confidencialidad.</strong>{' '}
                Los algoritmos, modelos, instrucciones (prompts), procesos de
                curación y el know-how involucrados en la prestación del servicio
                constituyen secretos industriales y/o información confidencial
                propiedad de Pasas.mx, protegidos por la legislación de propiedad
                industrial y por las obligaciones contractuales establecidas.
              </li>
            </ol>

            <h3 className="pt-2 font-medium text-white">5.3. Licencia contractual de uso</h3>
            <p>
              Independientemente del régimen de protección intelectual aplicable
              a cada elemento, el acceso y uso de la Plataforma se otorga
              mediante una licencia contractual limitada, personal,
              intransferible, revocable y no exclusiva. Esta licencia se concede
              exclusivamente para fines educativos propios y no comerciales,
              durante la vigencia de la Suscripción activa, y está condicionada
              al cumplimiento estricto de los presentes Términos y Condiciones.
            </p>

            <h3 className="pt-2 font-medium text-white">
              5.4. Protección contractual y prohibiciones
            </h3>
            <p>
              Con independencia de que ciertos materiales generados por IA
              pudieran, en el futuro, ser considerados no susceptibles de
              protección autoral, el Usuario asume la obligación contractual
              expresa de:
            </p>
            <ol className="ml-5 list-[upper-alpha] space-y-2">
              <li>
                No reproducir, distribuir, comunicar públicamente, transformar,
                comercializar, licenciar, sublicenciar, alquilar, vender o crear
                obras derivadas a partir de cualquier contenido, material, dato o
                resultado obtenido a través de la Plataforma.
              </li>
              <li>
                No eludir, modificar, descompilar, aplicar ingeniería inversa o
                extraer los modelos, algoritmos, conjuntos de datos,
                instrucciones o parámetros de IA utilizados por la Plataforma,
                cuya protección se reconoce en el artículo 102 de la LFDA y en
                las normas sobre secretos industriales.
              </li>
              <li>
                No utilizar el contenido para entrenar, alimentar o validar
                modelos de inteligencia artificial propios o de terceros.
              </li>
              <li>
                Abstenerse, declarando bajo protesta de decir verdad, de solicitar
                el registro de las guías, materiales o cualquier contenido
                derivado de la Plataforma ante el Instituto Nacional del Derecho
                de Autor (INDAUTOR) o ante cualquier otra autoridad competente
                del Estado mexicano.
              </li>
            </ol>
            <p>
              Estas obligaciones contractuales son válidas y exigibles conforme a
              los artículos 1792 y demás relativos del Código Civil Federal, y su
              incumplimiento dará lugar a las sanciones previstas en estos
              Términos y la legislación aplicable, incluyendo la terminación
              inmediata de la cuenta y la reclamación de daños y perjuicios.
            </p>

            <h3 className="pt-2 font-medium text-white">5.5. Aclaración sobre dominio público</h3>
            <p>
              La prestación del servicio no implica la dedicación voluntaria de
              contenido alguno al dominio público. Cualquier limitación en la
              protección autoral no autoriza al Usuario a apropiarse, redistribuir
              o explotar comercialmente el contenido, pues el acceso se encuentra
              restringido por estos Términos y Condiciones así como por las
              medidas tecnológicas de protección que Pasas.mx implementa.
            </p>

            <h3 className="pt-2 font-medium text-white">5.6. Marcas y signos distintivos</h3>
            <p>
              Las marcas, nombres comerciales, avisos comerciales y demás signos
              distintivos que aparecen en la Plataforma son titularidad de
              Pasas.mx o de terceros licenciantes, y no pueden ser utilizados sin
              autorización previa y por escrito, en los términos de la LFPPI.
            </p>
          </Seccion>

          <Seccion
            id="responsabilidad"
            numero="6"
            titulo="Responsabilidad y exclusión de garantías"
          >
            <h3 className="pt-2 font-medium text-white">6.1. Garantías</h3>
            <p>
              Pasas.mx es un servicio 100% digital. En razón de su naturaleza
              intangible y de prestación continua, no resulta aplicable el
              régimen de garantías previsto para bienes físicos, sin que ello
              implique renuncia o limitación a los derechos que como consumidor
              le asisten conforme a la LFPC.
            </p>
            <p>
              No obstante lo anterior, Pasas.mx garantiza que el servicio será
              prestado conforme a las características, condiciones y términos
              informados al momento de la contratación, durante todo el periodo
              de vigencia de la suscripción. Adicionalmente, se otorga al usuario
              un periodo de prueba gratuito de 7 (siete) días naturales, cuyo
              único objeto es permitirle evaluar el servicio antes de generar
              obligación de pago alguna.
            </p>
            <p>
              El inicio de dicho periodo ocurre al momento de la activación de la
              suscripción durante el registro, para lo cual se requiere el
              ingreso de los datos de una tarjeta bancaria (crédito o débito),
              destacando que durante los 7 días de prueba no se efectuará ningún
              cargo.
            </p>
            <p>
              El usuario podrá cancelar la suscripción en cualquier momento
              dentro del periodo de prueba, sin costo ni cargo alguno, a través
              de su panel de control. En caso de no ejercer la cancelación dentro
              de dicho término, al finalizar el periodo de prueba se realizará
              automáticamente el primer cargo correspondiente al plan contratado.
            </p>
            <p>
              Lo estipulado en la presente cláusula no restringe, modifica ni
              excluye los derechos que la ley confiere al consumidor, los cuales
              podrá ejercer ante las instancias competentes en caso de
              incumplimiento en la prestación del servicio.
            </p>

            <h3 className="pt-2 font-medium text-white">
              6.2. Limitación de responsabilidad por IA
            </h3>
            <p>
              El Usuario reconoce y acepta que los contenidos educativos son
              asistidos y estructurados a través de mecanismos computacionales de
              IA, por lo que la información proporcionada podría llegar a
              presentar imprecisiones (alucinaciones). El servicio digital es una
              herramienta de reforzamiento y de ninguna manera sustituye ni
              reemplaza la asesoría pedagógica o la cátedra personalizada
              impartida por un docente calificado o por una institución de
              Educación Pública o Privada.
            </p>

            <h3 className="pt-2 font-medium text-white">6.3. Fallas técnicas</h3>
            <p>
              Pasas.mx procura la disponibilidad del servicio, pero no será
              susceptible de responsabilidad por interrupciones o fallas
              atribuibles a terceros (proveedores de hosting o infraestructura),
              mantenimientos o causas de fuerza mayor. Los créditos o
              compensaciones que Pasas.mx llegue a otorgar por incidencias se
              ofrecen como una cortesía y no constituyen una obligación
              contractual.
            </p>
          </Seccion>

          <Seccion id="asistencia" numero="7" titulo="Asistencia y quejas">
            <h3 className="pt-2 font-medium text-white">7.1. Canales de atención</h3>
            <p>
              Las solicitudes de asistencia técnica, información y orientación
              sobre el servicio serán gestionadas de manera directa y exclusiva
              por el personal interno de Pasas.mx a través de los siguientes
              canales:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Correo electrónico: soporte@pasas.mx</li>
              <li>WhatsApp: 55 2714 9106</li>
            </ol>
            <p>
              Horario de atención: lunes a viernes de 9:00 a 18:00 h (hora del
              centro de México). Las solicitudes recibidas fuera de ese horario
              se atienden el siguiente día hábil.
            </p>

            <h3 className="pt-2 font-medium text-white">7.2. Quejas</h3>
            <p>
              El Usuario podrá formalizar cualquier reclamación o queja a través
              de los mismos canales. Pasas.mx se compromete a emitir un acuse de
              recibo inmediato y a resolver la queja en un plazo máximo de 5
              (cinco) días hábiles.
            </p>
          </Seccion>

          <Seccion id="referidos" numero="8" titulo="Programa de referidos">
            <p>
              Pasas.mx podrá implementar en el futuro un programa de referidos.
              En caso de ser lanzado, las condiciones particulares de dicho
              programa serán publicadas y notificadas oportunamente a los
              Usuarios, y se regirán por un documento complementario a los
              presentes Términos y Condiciones.
            </p>
          </Seccion>

          <Seccion
            id="jurisdiccion"
            numero="9"
            titulo="Legislación aplicable y jurisdicción"
          >
            <p>
              Los presentes Términos y Condiciones se rigen por la legislación de
              los Estados Unidos Mexicanos. Para la interpretación, cumplimiento
              y ejecución de lo aquí dispuesto, las partes se someten a la
              jurisdicción de los tribunales competentes del domicilio del
              consumidor, en términos del artículo 90 de la LFPC. Lo anterior,
              sin menoscabo de la competencia administrativa de la Procuraduría
              Federal del Consumidor (PROFECO).
            </p>
          </Seccion>
        </div>

        {/* Contacto */}
        <section className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ¿Tienes dudas sobre estos términos?
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Escríbenos y te respondemos en máximo 5 días hábiles:
          </p>
          <a
            href="mailto:soporte@pasas.mx"
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
          <Link href="/como-cancelar" className="hover:text-gray-300">
            Cómo cancelar
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
