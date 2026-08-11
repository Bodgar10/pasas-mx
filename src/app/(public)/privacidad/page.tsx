import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad | Pasas.mx',
  description:
    'Aviso de Privacidad de Pasas.mx: qué datos personales recabamos, para qué los usamos y cómo ejercer tus derechos ARCO.',
}

const INDICE = [
  { id: 'responsable', numero: 'I', titulo: 'Responsable y domicilio' },
  { id: 'datos', numero: 'II', titulo: 'Datos personales que recabamos' },
  { id: 'finalidades', numero: 'III', titulo: 'Finalidades del tratamiento' },
  { id: 'cookies', numero: 'IV', titulo: 'Cookies y tecnologías de rastreo' },
  { id: 'pagos', numero: 'V', titulo: 'Transacciones financieras' },
  { id: 'arco', numero: 'VI', titulo: 'Derechos ARCO' },
  { id: 'transferencias', numero: 'VII', titulo: 'Transferencia de datos' },
  { id: 'consentimiento', numero: 'VIII', titulo: 'Consentimiento de la transferencia' },
  { id: 'resguardo', numero: 'IX', titulo: 'Resguardo de datos personales' },
  { id: 'cambios', numero: 'X', titulo: 'Cambios al aviso' },
  { id: 'limites', numero: 'XI', titulo: 'Límites al uso o divulgación' },
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

export default function PrivacidadPage() {
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
            Aviso de Privacidad
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Versión 1.0 · Actualizado al 14 de julio de 2026
          </p>
          <p className="mt-4 text-gray-400">
            Este documento explica qué datos personales recabamos, para qué los
            usamos y cómo puedes ejercer tus derechos sobre ellos.
          </p>
        </div>

        {/* Atajo ARCO */}
        <section className="mb-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ¿Quieres acceder, corregir o eliminar tus datos?
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Escríbenos a soporte@pasas.mx con el asunto “Solicitud de
            modificación, rectificación, cancelación u oposición”. Te
            confirmamos la recepción en máximo 5 días hábiles.
          </p>
          <a
            href="#arco"
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            Ver el procedimiento completo →
          </a>
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

        {/* Preámbulo */}
        <div className="mb-10 space-y-4 text-sm leading-relaxed text-gray-300">
          <p>
            En cumplimiento de lo dispuesto por la Ley Federal de Protección de
            Datos Personales en Posesión de los Particulares publicada en el
            Diario Oficial de la Federación el día 20 de marzo del 2025 (en lo
            sucesivo la “Ley”), el Reglamento de la Ley Federal de Protección de
            Datos Personales en Posesión de los Particulares (en adelante el
            “Reglamento”) y los Lineamientos del Aviso de Privacidad publicados
            en el Diario Oficial de la Federación el día 17 de enero de 2013 (en
            lo sucesivo los “Lineamientos”) y en armonía con el artículo Cuarto
            transitorio del Decreto por el que se expiden (i) la ley general de
            transparencia y acceso a la información pública; (ii) la ley general
            de protección de datos personales en posesión de sujetos obligados;
            (iii) la ley federal de protección de datos personales en posesión
            de los particulares; y (iv) se reforma el artículo 37, fracción XV,
            de la ley orgánica de la administración pública federal y demás
            disposiciones legales aplicables.
          </p>
          <p>
            Bodgar Jair Espinosa Miranda (en lo sucesivo, “Pasas.mx”) pone a
            disposición el presente Aviso de Privacidad, el cual regula el
            tratamiento de los datos personales de: (i) los usuarios de los
            dominios o sitios web https://pasas.mx y sus subdominios asociados
            (los “Usuarios”); y (ii) cualquier persona que establezca
            comunicación con Pasas.mx a través de formularios, correo
            electrónico, llamadas telefónicas, medios digitales o cualquier otro
            medio de comunicación, siempre que dicha interacción implique la
            entrega de datos personales.
          </p>
          <p>
            Por lo tanto, ponemos a tu disposición el Aviso de Privacidad en los
            siguientes términos:
          </p>
        </div>

        <div className="space-y-10">
          <Seccion
            id="responsable"
            numero="I"
            titulo="Responsable del tratamiento de los datos personales y domicilio"
          >
            <p>
              Pasas.mx es el responsable y persona encargada del tratamiento de
              tus datos personales. Para efecto de oír y recibir notificaciones
              relacionadas con el Aviso de Privacidad señala como domicilio el
              ubicado en Privada Lázaro Cárdenas Número 24 (veinticuatro), Tres
              Marías, Municipio de Huitzilac, Morelos, Código Postal 62515
              (sesenta y dos mil quinientos quince), México, así como la
              dirección de correo electrónico: soporte@pasas.mx
            </p>
            <p>
              A fin de garantizar la operatividad y correcta prestación de los
              servicios, Pasas.mx realiza la comunicación de datos personales
              (incluyendo nombre, correo electrónico, así como datos de
              analítica y experiencia de uso) hacia diversos aliados
              tecnológicos, tales como Supabase, Vercel, Cloudflare, Stripe,
              Gigstack, Anthropic, Resend y Posthog.
            </p>
            <p>
              Se hace constar explícitamente que dichas interacciones
              constituyen remisiones y no transferencias, toda vez que los
              citados terceros actúan en calidad de encargados. Estos
              proveedores brindan servicios que incluyen, de manera enunciativa
              más no limitativa: alojamiento en la nube, procesamiento de pagos,
              infraestructura de red y herramientas de análisis de datos.
            </p>
            <p>
              Las empresas mencionadas llevan a cabo el procesamiento y
              resguardo de la información en sedes ubicadas fuera del ámbito
              territorial nacional, con especial incidencia en los Estados
              Unidos de América. Estas transferencias de carácter transfronterizo
              se efectúan bajo el resguardo de Acuerdos de Procesamiento de
              Datos (DPA) de naturaleza estricta, que aseguran la implementación
              de salvaguardas técnicas y organizativas equivalentes a las
              dispuestas por el ordenamiento jurídico interno.
            </p>
          </Seccion>

          <Seccion
            id="datos"
            numero="II"
            titulo="Datos personales que serán recabados y sometidos a tratamiento"
          >
            <p>
              Un dato personal es cualquier información que se recaba
              concerniente a personas físicas identificadas o identificables. Al
              respecto, para la correcta prestación de los servicios, Pasas.mx
              recaba los siguientes datos personales del Usuario de la Página de
              Internet:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Nombre completo*.</li>
              <li>Fecha de nacimiento*.</li>
              <li>Nivel y grado escolar en curso*.</li>
              <li>
                Nombre del padre, madre o tutor* (en caso que el Usuario sea
                menor de edad conforme la legislación vigente en la República
                Mexicana).
              </li>
              <li>Correo electrónico*.</li>
              <li>Domicilio.</li>
              <li>Clave del Registro Federal del Contribuyente.</li>
              <li>Dirección IP*.</li>
            </ol>
            <p>
              Una misma Cuenta de Usuario puede comprender más de un Lugar de
              acceso y, en consecuencia, los datos personales de más de un
              Alumno. En tal supuesto, los datos señalados en los numerales 1, 2
              y 3 se recaban de forma independiente respecto de cada Alumno
              incorporado a la Cuenta, y reciben en todos los casos el mismo
              tratamiento y las mismas medidas de seguridad descritas en el
              presente Aviso.
            </p>
            <p>
              Los datos que se encuentran señalados con un (*) asterisco son
              indispensables para el control interno y para la prestación de los
              servicios; sin su consentimiento Pasas.mx no podrá realizar la
              prestación de los servicios.
            </p>
            <p>
              Los datos que no se encuentran señalados con un asterisco serán
              utilizados para las necesidades secundarias y no necesarias para
              la prestación de los servicios.
            </p>
            <p>
              En respeto al derecho a la intimidad y protección de datos
              personales de niñas, niños y adolescentes, previsto en el artículo
              13, fracción XVII, así como en los artículos 76, 77 y 78 de la Ley
              General de los Derechos de Niñas, Niños y Adolescentes, se
              reconoce que quienes ejercen la patria potestad, tutela o guarda y
              custodia tienen la responsabilidad de orientar, supervisar y, en
              su caso, restringir las conductas y hábitos digitales de las
              personas menores de edad, siempre bajo el principio del interés
              superior de la niñez.
            </p>
            <p>
              En este sentido, previo al tratamiento de los datos personales
              señalados en este numeral, Pasas.mx recabará el consentimiento
              expreso y por escrito —o mediante cualquier medio electrónico
              equivalente que permita su comprobación— de quienes ejercen la
              patria potestad o tutela legal, garantizando a su vez que se
              respete y tome en cuenta la opinión de la niña, niño o adolescente
              conforme a su edad, desarrollo evolutivo, cognoscitivo y madurez,
              en términos de lo previsto por el artículo 76, párrafo segundo, de
              la citada Ley.
            </p>
            <p>
              Asimismo, toda persona que ingrese datos personales de un menor de
              edad a través de la plataforma declara, bajo protesta de decir
              verdad, que cuenta con las facultades legales para otorgar el
              consentimiento en representación del menor. Dicha declaración se
              entiende otorgada de forma individual respecto de cada menor de
              edad cuyos datos se incorporen a la Cuenta de Usuario, con
              independencia del número de Lugares que ésta comprenda, y se
              recaba de nuevo en cada ocasión en que se incorpore a un menor
              distinto. En caso de no ser la
              persona facultada para ello (padre, madre o tutor legal), quien
              realice el ingreso de los datos responderá de manera solidaria e
              ilimitada por cualquier responsabilidad, daño o perjuicio derivado
              de la vulneración al derecho a la intimidad del menor,
              comprometiéndose expresamente a realizar las acciones necesarias
              para obtener y acreditar el consentimiento expreso de quien
              ostente la patria potestad o tutela.
            </p>
            <p>
              Al respecto, Pasas.mx se reserva el derecho de ejercer las
              acciones legales correspondientes ante las autoridades competentes,
              en caso de que dicha persona incumpla con las disposiciones del
              presente Aviso de Privacidad y la normativa aplicable en materia
              de protección de datos personales en posesión de particulares y de
              los derechos de niñas, niños y adolescentes.
            </p>
          </Seccion>

          <Seccion
            id="finalidades"
            numero="III"
            titulo="Finalidad del tratamiento de los datos personales"
          >
            <p>
              La información que nos proporcionan los Usuarios de la Página Web
              la dividimos en dos finalidades: (i) primarias, indispensables y
              necesarias para la adecuada prestación de los servicios; y (ii)
              secundarias, no necesarias para la prestación de los servicios.
            </p>

            <h3 className="pt-2 font-medium text-white">Finalidades primarias</h3>
            <p>
              Para el cumplimiento de las finalidades primarias, los datos serán
              utilizados para:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>
                Efectuar la verificación, creación y administración de la cuenta
                de acceso del usuario, así como de los distintos Lugares que
                ésta comprenda, manteniendo separados entre sí los datos de
                grado, temática y registro de avance correspondientes a cada
                Alumno;
              </li>
              <li>
                Obtención y registro del consentimiento respecto del tratamiento
                de los Datos Personales del Usuario (a través del padre, madre o
                tutor en el caso que el Usuario sea menor de edad);
              </li>
              <li>
                Suministrar el servicio educativo personalizado mediante el
                tratamiento automatizado de perfiles y la generación de
                contenidos con Inteligencia Artificial;
              </li>
              <li>
                Brindar atención técnica, soporte al usuario y el envío de
                comunicaciones transaccionales indispensables sobre el estado de
                su cuenta;
              </li>
              <li>
                Gestionar el procesamiento de pagos y suscripciones a través de
                las pasarelas de pago;
              </li>
              <li>
                Almacenar la dirección IP como mecanismo de identificación de la
                aceptación de los Términos y Condiciones de la plataforma;
              </li>
              <li>
                Atender las diversas obligaciones legales, contables y
                regulatorias derivadas de la relación jurídica existente y de
                conformidad con la legislación aplicable vigente en la República
                Mexicana.
              </li>
            </ol>

            <h3 className="pt-2 font-medium text-white">
              Finalidades secundarias
            </h3>
            <p>
              De manera adicional, si no se manifiesta la negativa, la
              información personal será utilizada para las siguientes
              finalidades secundarias que no son necesarias para el servicio
              principal, pero que nos permiten brindar una mejor experiencia y
              ofrecer beneficios adicionales:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>
                El envío de información promocional, comunicados, boletines
                informativos y ofertas comerciales sobre los servicios de
                Pasas.mx o de nuestros aliados estratégicos;
              </li>
              <li>
                La realización de encuestas de satisfacción, estudios de mercado
                y análisis estadísticos para evaluar la calidad de nuestros
                contenidos y mejorar nuestras funcionalidades;
              </li>
              <li>
                La personalización de publicidad y contenidos en redes sociales
                o plataformas de terceros mediante el uso de tecnologías de
                rastreo y píxeles, con el fin de mostrarle publicidad basada en
                sus preferencias y comportamiento de navegación;
              </li>
              <li>La emisión de comprobantes fiscales digitales por internet;</li>
              <li>Mercadotecnia, publicidad y marketing;</li>
              <li>Análisis de comportamiento de uso y mejora del producto;</li>
              <li>Programa de referidos.</li>
            </ol>
          </Seccion>

          <Seccion
            id="cookies"
            numero="IV"
            titulo="Uso de cookies y tecnologías de rastreo"
          >
            <p>
              Pasas.mx utiliza cookies, web beacons y pixel tags en su
              plataforma web para recopilar información técnica de navegación,
              asegurar las sesiones de usuario y optimizar sus estrategias
              comerciales. Los datos personales que obtenemos a través de estas
              tecnologías son los siguientes: identificadores de sesión,
              dirección IP, tipo de navegador, sistema operativo, páginas
              visitadas, enlaces accedidos y tiempo de navegación.
            </p>
            <p>Las tecnologías que empleamos son:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong className="text-white">Cookies:</strong> permiten
                conservar el estado de la sesión, asegurar la autenticación del
                usuario y mantener la persistencia de parámetros de origen
                (etiquetas UTM) para la atribución de campañas de marketing.
              </li>
              <li>
                <strong className="text-white">Web beacons:</strong> miden la
                tasa de apertura de correos electrónicos transaccionales y
                registran eventos específicos de conversión.
              </li>
              <li>
                <strong className="text-white">Pixel tags:</strong> rastrean de
                forma agregada el comportamiento de navegación, eventos de
                conversión, interactividad mediante mapas de calor y grabaciones
                de sesión en pantalla para la optimización publicitaria.
              </li>
            </ul>
            <p>
              <strong className="text-white">
                Gestión y desactivación de tecnologías:
              </strong>{' '}
              el Usuario conserva el control sobre el uso de estas herramientas.
              En todo momento es posible configurar el navegador para aceptar o
              rechazar automáticamente las cookies, o bien para recibir una
              notificación previa a su instalación definitiva. Para ajustar
              estas preferencias, se recomienda consultar el apartado de “Ayuda”
              o “Configuración” de su navegador habitual (tales como Google
              Chrome, Safari, Mozilla Firefox o Microsoft Edge).
            </p>
            <p>
              <strong className="text-white">Advertencia importante:</strong> se
              hace constar que el bloqueo o eliminación total de estas
              tecnologías de rastreo podría ocasionar que ciertas
              funcionalidades de la plataforma no operen adecuadamente,
              limitando la experiencia de navegación o reduciendo la calidad del
              servicio, al ser esenciales para la persistencia de la sesión.
            </p>
            <p>
              Ante cualquier duda sobre nuestra política de rastreo o si
              requiere asistencia adicional para su deshabilitación específica,
              favor de contactarnos en la dirección electrónica:
              soporte@pasas.mx.
            </p>
            <p>
              Actualmente se encuentran implementadas y activas las herramientas
              de medición Google Analytics 4, Microsoft Clarity y PostHog. Con
              fines previsores y de debida transparencia, se declaran integrados
              desde este momento los píxeles de Meta (Facebook), TikTok y Google
              Ads destinados a remarketing y optimización publicitaria. La
              plataforma podrá desplegar un banner de consentimiento que
              condicione la instalación de dichos píxeles publicitarios.
            </p>
          </Seccion>

          <Seccion
            id="pagos"
            numero="V"
            titulo="Sobre transacciones financieras"
          >
            <p>
              Pasas.mx redirige a sus usuarios de manera externa y directa a
              pasarelas de pago autorizadas para el procesamiento seguro de
              transacciones financieras y la gestión de cobros tokenizados. Se
              recomienda consultar el Aviso de Privacidad de dicha pasarela de
              pago para conocer el tratamiento específico de sus datos
              patrimoniales y financieros. Cualquier dato recopilado por Stripe
              es responsabilidad exclusiva de dicho proveedor, quedando Pasas.mx
              exenta de toda responsabilidad relacionada con el almacenamiento o
              resguardo de información bancaria.
            </p>
          </Seccion>

          <Seccion
            id="arco"
            numero="VI"
            titulo="Mecanismos de acceso para el ejercicio de los derechos ARCO"
          >
            <p>
              De conformidad con la Ley, el Reglamento y los Lineamientos,
              tienes el derecho de:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>Revocar tu consentimiento en cualquier momento.</li>
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar tus datos personales.</li>
              <li>Suprimir tus datos personales, cuando sea posible.</li>
              <li>Limitar el tratamiento de tus datos personales.</li>
              <li>Solicitar la portabilidad de tus datos personales.</li>
              <li>Oponerte al tratamiento de tus datos personales.</li>
            </ul>
            <p>
              La anterior serie de prerrogativas también se conocen como
              derechos “ARCO”. Para ello hemos habilitado diversas fuentes de
              información para atender las solicitudes de ejercicio sobre los
              derechos ARCO.
            </p>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="mb-3 font-medium text-white">
                Procedimiento para ejercer tus derechos ARCO
              </p>
              <ol className="ml-5 list-decimal space-y-3">
                <li>
                  Envíanos un correo electrónico a la dirección
                  soporte@pasas.mx y en el asunto coloca la leyenda “Solicitud
                  de modificación, rectificación, cancelación u oposición”
                  —según sea el caso—.
                </li>
                <li>
                  Adjunto al correo electrónico o a la solicitud por escrito
                  deberás acompañar los siguientes datos y documentos:
                  <ul className="ml-5 mt-2 list-disc space-y-1">
                    <li>Nombre completo del titular de los datos personales.</li>
                    <li>
                      Correo electrónico o domicilio (calle, número exterior y
                      en su caso interior, colonia, ciudad, estado, código
                      postal) para oír y recibir notificaciones.
                    </li>
                    <li>
                      Una descripción concreta del motivo de tu solicitud, junto
                      con la descripción clara y precisa de los datos personales
                      respecto de los que quieres ejercer alguno de los derechos
                      ARCO.
                    </li>
                    <li>Identificación oficial en formato PDF, JPG o JPEG.</li>
                    <li>
                      En su caso, la documentación que consideres necesaria para
                      facilitar la localización de los datos sobre los cuales
                      realizas tu solicitud.
                    </li>
                  </ul>
                  <p className="mt-2">
                    Cuando se trate de solicitudes para el ejercicio del derecho
                    de rectificación, adicionalmente deberás precisar las
                    modificaciones a realizarse y aportar la documentación que
                    sustente tu petición, de conformidad con el artículo 30 de
                    la Ley.
                  </p>
                </li>
                <li>
                  Una vez realizada tu solicitud, te enviaremos un correo
                  electrónico al correo o domicilio señalado donde te
                  confirmaremos la recepción de tu solicitud en un término de 5
                  (cinco) días hábiles contados a partir de su recepción. En
                  caso de que se necesite aclarar o precisar alguna parte de tu
                  solicitud, o bien sea necesario proporcionar más datos para
                  localizar la información, te enviaremos un correo electrónico.
                  Lo anterior debemos hacerlo en un término de 5 (cinco) días
                  hábiles contados a partir del siguiente en el que recibimos tu
                  solicitud, y tendrás el mismo plazo para complementarla.
                </li>
                <li>
                  Para responder sobre la procedencia o improcedencia de tu
                  solicitud tenemos un plazo no mayor a 20 (veinte) días hábiles
                  contados desde la fecha en que la recibimos. En caso de que tu
                  solicitud sea procedente, tendremos como máximo 15 (quince)
                  días hábiles para llevar a cabo su cumplimiento, contados a
                  partir del día siguiente al que te hagamos llegar la respuesta
                  sobre la procedencia de tu petición. Los plazos señalados
                  podrán ser ampliados por una sola vez y por un periodo igual,
                  siempre y cuando te avisemos los motivos por los cuales
                  necesitamos ampliarlos.
                </li>
                <li>
                  En caso de que requieras información más detallada o ayuda
                  para llevar a cabo el ejercicio de tus derechos ARCO, puedes
                  escribirnos a soporte@pasas.mx
                </li>
              </ol>
            </div>

            <p>
              No obstante, si con la resolución que adoptemos consideras que tus
              derechos ARCO fueron vulnerados, tienes el derecho de acudir a la
              Secretaría Anticorrupción y Buen Gobierno, quien es la autoridad
              competente para vigilar su ejercicio, y que para pronta referencia
              te dejamos su página web:{' '}
              <a
                href="https://www.gob.mx/buengobierno"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 underline hover:text-purple-300"
              >
                https://www.gob.mx/buengobierno
              </a>
            </p>
          </Seccion>

          <Seccion
            id="transferencias"
            numero="VII"
            titulo="Transferencia de datos"
          >
            <p>
              Los datos personales recabados por Pasas.mx podrán ser
              transferidos a:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                Entidades de la Administración Pública municipal, estatal o
                federal.
              </li>
              <li>Dependencias gubernamentales.</li>
            </ul>
            <p>
              Conforme al artículo 36 de la Ley se llevarán a cabo las
              transferencias nacionales o internacionales sin necesidad de tu
              consentimiento cuando ocurra alguno de los supuestos siguientes:
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>
                Cuando la transferencia esté prevista en una Ley o Tratado en el
                que México sea parte. Cuando la transferencia sea necesaria para
                la prevención o el diagnóstico médico, la prestación de
                asistencia sanitaria, tratamiento médico o la gestión de
                servicios sanitarios.
              </li>
              <li>
                Cuando la transferencia sea efectuada a sociedades controladoras,
                subsidiarias o afiliadas bajo el control común del responsable, o
                a una sociedad matriz o a cualquier sociedad del mismo grupo del
                responsable que opere bajo los mismos procesos y políticas.
              </li>
              <li>
                Cuando la transferencia sea necesaria por virtud de un contrato
                celebrado o por celebrar en interés del titular, por el
                responsable y un tercero.
              </li>
              <li>
                Cuando la transferencia sea necesaria o legalmente exigida para
                la salvaguarda de un interés público, o para la procuración o
                administración de justicia.
              </li>
              <li>
                Cuando la transferencia sea precisa para el reconocimiento,
                ejercicio o defensa de un derecho en un proceso judicial.
              </li>
              <li>
                Cuando la transferencia sea precisa para el mantenimiento o
                cumplimiento de una relación jurídica entre el responsable y el
                titular.
              </li>
            </ol>
          </Seccion>

          <Seccion
            id="consentimiento"
            numero="VIII"
            titulo="Consentimiento de la transferencia de los datos"
          >
            <p>
              Te informamos que para la transferencia de los datos personales
              que se encuentren señalados con un (*) asterisco requerimos tu
              consentimiento, por lo cual, si no manifiestas tu negativa para
              las transferencias señaladas, se entenderá que manifiestas tu
              consentimiento de manera tácita.
            </p>
          </Seccion>

          <Seccion
            id="resguardo"
            numero="IX"
            titulo="Resguardo de datos personales"
          >
            <p>
              Los datos personales que nos proporciones serán resguardados con
              base en los principios señalados en el artículo 5 de la Ley, los
              cuales son: licitud, consentimiento, información, calidad,
              finalidad, lealtad, proporcionalidad y responsabilidad.
            </p>
          </Seccion>

          <Seccion id="cambios" numero="X" titulo="Cambios al aviso de privacidad">
            <p>
              El presente aviso de privacidad puede sufrir modificaciones,
              cambios o actualizaciones derivadas de nuevos requerimientos
              legales; de nuestras necesidades para la prestación de nuestros
              servicios; de nuevas prácticas de privacidad que adoptemos; de
              cambios en nuestro modelo de negocio; o por otras causas.
            </p>
            <p>
              En ese caso nos comprometemos a mantenerte informado sobre los
              cambios que realicemos a nuestro Aviso de Privacidad, a través de
              una publicación general en la página web.
            </p>
            <p>
              De conformidad con la ley, y en relación a los artículos 11 y 17
              de la Ley, y trigésimo segundo de los Lineamientos, ante cualquier
              modificación en las finalidades del tratamiento o si Pasas.mx
              realiza variaciones en los datos solicitados, se procederá a
              solicitar nuevamente el consentimiento expreso de la persona
              titular. En el supuesto de que los datos no hayan sido obtenidos
              directamente del titular, dicho cambio se informará por este mismo
              medio.
            </p>
          </Seccion>

          <Seccion
            id="limites"
            numero="XI"
            titulo="Límites al uso o divulgación de los datos personales"
          >
            <p>
              Con el objeto de poder limitar el uso y divulgación de tu
              información personal, te ofrecemos registrarte en el listado de
              exclusión de Pasas.mx para que tus datos personales no sean
              tratados para las actividades secundarias mencionadas en el
              presente aviso de privacidad.
            </p>
            <p>
              Para solicitar tu registro en el listado de exclusión deberás
              enviar un correo a la dirección soporte@pasas.mx y establecer en
              el asunto “Solicitud de registro en el listado de exclusión”,
              adjuntando al correo una copia digitalizada de un documento
              oficial donde se acredite tu identidad como solicitante.
            </p>
            <p>
              De conformidad con el artículo séptimo de la Ley, por el simple
              hecho de no manifestar oposición al leer el presente Aviso se
              entenderá la aceptación a los términos del mismo.
            </p>
          </Seccion>
        </div>

        {/* Contacto */}
        <section className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ¿Tienes dudas sobre este aviso?
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            Escríbenos y te respondemos:
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
          <Link href="/terminos" className="hover:text-gray-300">
            Términos
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
