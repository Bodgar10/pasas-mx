import { POSTHOG_INSIGHTS } from './posthog-links'

/**
 * CÓMO SE LEE CADA MÉTRICA. Fuente única, misma disciplina que PLAN_DISPLAY.
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 * Un embudo de PostHog no dice si un 6% es bueno o malo, ni qué hacer si
 * sale mal, ni cuál es la trampa de lectura que casi todo el mundo comete.
 * Sin eso, el botón lleva a una pantalla que nadie sabe interpretar y el
 * tablero se deja de mirar a las tres semanas.
 *
 * 🔴 REGLA DE ADMISIÓN: si una Lectura no puede decir QUÉ HARÍAS DISTINTO
 * MAÑANA, esa métrica no merece estar en el tablero. `siSaleMal` no se
 * rellena de relleno: se deja fuera la métrica.
 *
 * 🔴 `link` está tipado contra POSTHOG_INSIGHTS: si alguien borra un
 * insight y regenera posthog-links.ts, este archivo DEJA DE COMPILAR. Es
 * a propósito — un tutorial que apunta a un insight inexistente es peor
 * que no tener tutorial.
 */
export type Lectura = {
  id: string
  titulo: string
  /** Una frase. Qué mide, en el idioma del negocio. */
  queMide: string
  /** 2-4 líneas. Cómo se interpreta lo que se ve en pantalla. */
  comoSeLee: string[]
  /** El umbral bueno. */
  bien: string
  /** El umbral malo. */
  mal: string
  /** El error de lectura más común. */
  trampa: string
  /** Acciones concretas. Si no hay ninguna, la métrica sobra. */
  siSaleMal: string[]
  link: keyof typeof POSTHOG_INSIGHTS
}

export const LECTURAS: Record<string, Lectura> = {
  // ═══ ADQUISICIÓN ═══════════════════════════════════════════════════
  embudoLanding: {
    id: 'embudoLanding',
    titulo: 'Embudo landing → registro',
    queMide: 'De cada 100 personas que ven el hero, cuántas terminan con cuenta creada.',
    comoSeLee: [
      'Cada barra es PERSONAS ÚNICAS, no eventos. Alguien que pulsa el CTA tres veces cuenta una.',
      'El % debajo de cada paso es contra el paso anterior; el de arriba, contra el primero.',
      'La caída más grande es dónde trabajar. El número final solo dice si vas bien o mal.',
      '🔴 El primer paso es `hero_variant_seen`, NO una visita: solo cuenta a quien aceptó "Análisis de uso" en el banner. El embudo mide sobre los medibles, no sobre el tráfico total.',
    ],
    bien: '5-8% del hero al registro.',
    mal: 'Menos de 2%.',
    trampa:
      'La ventana de conversión está en 14 días. Si la bajas a 1 hora, la conversión "cae" sin que nada haya cambiado: solo dejaste fuera a quien volvió al día siguiente. Déjala en 14 y no la muevas entre revisiones, o comparas dos cosas distintas.',
    siSaleMal: [
      'Abre Session Replay filtrado por quienes llegaron al paso 2 y no al 3.',
      'Mira "CTAs de la landing": si uno concentra los clics, los demás sobran o están mal colocados.',
      'Cruza con "Secciones vistas": si la gente no llega a precios, el problema es de orden, no de copy.',
    ],
    link: 'embudoLanding',
  },

  abHero: {
    id: 'abHero',
    titulo: 'A/B del hero',
    queMide: 'Cuál de las tres versiones del hero convierte mejor.',
    comoSeLee: [
      'El mismo embudo, partido por `variant`: D, E y PAPA.',
      'Mínimo 1,000 personas por variante y 14 días corridos. Antes de eso la diferencia es ruido aunque se vea enorme.',
      '🔴 PAPA no se guarda en localStorage: solo aparece con `utm_source` de campaña de papás. Un papá que vuelve escribiendo la URL recibe D o E, así que PAPA siempre tendrá menos volumen y no es comparable de tú a tú.',
    ],
    bien: 'Una variante gana por más de 2 puntos porcentuales de forma estable dos semanas.',
    mal: 'Diferencias que cambian de signo cada pocos días: no hay ganador, hay ruido.',
    trampa:
      'Una variante que gana los primeros tres días y pierde después es lo más común que hay. No se decide en martes.',
    siSaleMal: [
      'Si tras 14 días no hay diferencia, quédate con la más corta de escribir y prueba otra cosa: el hero no es el cuello de botella.',
      'Si gana una, ponla como única y arranca un experimento nuevo. Un A/B eterno no decide nada.',
    ],
    link: 'abHero',
  },

  seccionesVistas: {
    id: 'seccionesVistas',
    titulo: 'Secciones de la landing vistas',
    queMide: 'Hasta dónde llega la gente y qué secciones se ve de verdad.',
    comoSeLee: [
      'Una sección cuenta como vista cuando lleva 1 segundo con al menos la mitad en pantalla. Pasar de largo no cuenta.',
      'Léelo como una escalera descendente: cada escalón que baja mucho es una sección que expulsa.',
      'La sección `capturas` no aparecerá: está apagada por `ENABLE_LANDING_SCREENSHOTS`. No es una caída.',
    ],
    bien: 'Al menos la mitad de quienes ven el hero llegan a `precios`.',
    mal: 'Menos de un cuarto llega a `precios`.',
    trampa:
      'Una sección muy alta puede no alcanzar nunca el 50% de sí misma en móvil. El observador lo compensa contando cuando lo visible llena medio viewport — pero si una sección sale sospechosamente baja, mírala en móvil antes de reescribirla.',
    siSaleMal: [
      'Mueve arriba la sección donde se cae la gente, o córtala.',
      'Si `precios` recibe poco tráfico, sube un CTA antes de esa sección en vez de reescribir precios.',
    ],
    link: 'seccionesVistas',
  },

  scrollDepth: {
    id: 'scrollDepth',
    titulo: 'Scroll depth de la landing',
    queMide: 'Qué porcentaje de la página recorre la gente.',
    comoSeLee: [
      'Cuatro hitos: 25, 50, 75 y 100. Cada persona dispara cada hito una sola vez por carga.',
      'Es la versión gruesa de "Secciones vistas". Úsalo para el titular; usa el otro para decidir qué mover.',
    ],
    bien: 'Más del 40% llega al 75%.',
    mal: 'Menos del 20% pasa del 50%: la página es demasiado larga para lo que promete arriba.',
    trampa:
      'Llegar al 100% no significa haber leído. Alguien que arrastra la barra hasta abajo dispara los cuatro hitos en dos segundos. Cruza siempre con el tiempo activo del `landing_exit`.',
    siSaleMal: [
      'Acorta la página: mueve el CTA final y la sección de precios por encima del 50%.',
    ],
    link: 'scrollDepth',
  },

  demoConversion: {
    id: 'demoConversion',
    titulo: 'Demo jugable → registro',
    queMide: 'Si jugar el demo hace que se registren más.',
    comoSeLee: [
      'Este embudo arranca en `demo_iniciado`: solo cuenta a quien tocó el demo.',
      'Se lee CONTRA "Landing → registro (sin demo)", que es el embudo global.',
      '🔴 El embudo global INCLUYE a los que jugaron: no es "con demo vs sin demo", es "jugadores vs todos". La brecha real es mayor que la que ves.',
    ],
    bien: 'Los jugadores convierten 2× o más que el global.',
    mal: 'Convierten igual o peor.',
    trampa:
      'Quien juega ya venía más interesado. La diferencia SIEMPRE sobreestima el efecto del demo, así que la decisión solo cambia si la brecha es grande.',
    siSaleMal: [
      'Si convierten 2× o más: sube el demo en la página y dale su propio CTA justo debajo.',
      'Si convierten igual: es decoración cara que ocupa el sitio de otra cosa. Quítalo y mide de nuevo.',
    ],
    link: 'demoConversion',
  },

  sinDemoConversion: {
    id: 'sinDemoConversion',
    titulo: 'Landing → registro (sin demo)',
    queMide: 'La línea base de conversión de toda la landing, para comparar contra el demo.',
    comoSeLee: [
      '🔴 Este insight NO se mira solo. Existe únicamente como denominador de "Demo jugable → registro".',
      'Incluye a todo el mundo, jugadores del demo incluidos.',
    ],
    bien: 'No aplica: es una referencia, no una meta.',
    mal: 'No aplica.',
    trampa:
      'Tratarlo como una métrica propia. Su único uso es la resta contra el embudo del demo; leído solo, duplica lo que ya dice el embudo principal.',
    siSaleMal: ['Nada por sí solo. La acción sale de compararlo con el embudo del demo.'],
    link: 'sinDemoConversion',
  },

  ctasLanding: {
    id: 'ctasLanding',
    titulo: 'CTAs de la landing',
    queMide: 'Qué botón del embudo se pulsa y cuál no.',
    comoSeLee: [
      'Siete posiciones: `nav`, `hero`, `post_demos`, `pre_tutorial`, `pricing_estandar_v2`, `pricing_personalizado_v2` y `cta_final`.',
      '🔴 `pre_tutorial` se llamaba `post_capturas` hasta s33. Comparar contra datos anteriores a esa fecha es comparar dos posiciones distintas del embudo.',
    ],
    bien: 'Los clics repartidos, con hero y precios arriba.',
    mal: 'Un CTA concentra casi todo: los demás no se ven o llegan tarde.',
    trampa:
      'Un CTA con pocos clics puede estar bien colocado y tener poca gente que llegue hasta él. Cruza con "Secciones vistas" antes de quitarlo.',
    siSaleMal: [
      'Quita los CTA que no reciben clics teniendo tráfico: repiten sin aportar.',
      'Si `cta_final` gana, la página convence pero tarda: sube ese argumento.',
    ],
    link: 'ctasLanding',
  },

  // ═══ EMBUDO DE PAGO ════════════════════════════════════════════════
  embudoPago: {
    id: 'embudoPago',
    titulo: 'Embudo de pago',
    queMide: 'De quien se registra, cuántos llegan a pagar.',
    comoSeLee: [
      'Cinco pasos: registro → onboarding → planes → checkout → pago.',
      'El paso de verificación de correo suele ser el peor y casi nadie lo mira. Ese salto es gente que quiso entrar y se quedó en la bandeja.',
      'Si `planes_vistos` cae mucho respecto a `onboarding_completo`, el problema está en la pantalla de preview, no en el precio.',
    ],
    bien: 'Verificación arriba de 70%, onboarding arriba de 80%.',
    mal: 'Verificación por debajo de 50%: se está perdiendo la mitad en el correo.',
    trampa:
      '🔴 El paso de pago incluye el trial de 7 días. Una sesión completada NO es dinero: `pago_exitoso` con `es_trial: true` es un cobro de $0. El dinero está en el tablero de ingresos, no aquí.',
    siSaleMal: [
      'Si cae la verificación: revisa spam, el asunto del correo y el tiempo de entrega de Resend.',
      'Si cae en planes: mira "Conversión por promoción" — puede ser que la promo prometida no se esté aplicando.',
    ],
    link: 'embudoPago',
  },

  pagoPorCamino: {
    id: 'pagoPorCamino',
    titulo: 'Embudo de pago por camino',
    queMide: 'Cuál de las tres puertas de cobro convierte mejor.',
    comoSeLee: [
      '`planes` es el embudo normal. `bienvenida` es la vuelta del correo de verificación. `registro_directo` es el alta con plan ya elegido.',
      '`registro_directo` no trae `precio_mostrado` ni `segundos_desde_planes`: esa pantalla nunca los vio. No es un hueco de datos.',
    ],
    bien: 'Los tres caminos en el mismo orden de magnitud.',
    mal: 'Un camino convierte la mitad que los otros.',
    trampa:
      '`bienvenida` siempre tendrá menos volumen: solo pasa por ahí quien tuvo que verificar el correo. Compara porcentajes, no totales.',
    siSaleMal: [
      'Si `bienvenida` va mal, el problema es el salto por el correo: mira "Promo perdida" por si el slug se está cayendo ahí.',
      'Si `registro_directo` va mal, la persona eligió plan antes de ver el producto: revisa el orden del embudo.',
    ],
    link: 'pagoPorCamino',
  },

  pagoPorCanal: {
    id: 'pagoPorCanal',
    titulo: 'Conversión por canal',
    queMide: 'Qué origen trae gente que paga, no solo gente que entra.',
    comoSeLee: [
      'Partido por `utm_source`, que viaja como propiedad automática desde el first-touch.',
      'Un canal con mucho volumen y poca conversión es caro aunque el clic sea barato.',
      '🔴 El first-touch es POR PESTAÑA: vive en sessionStorage. Quien ve el anuncio, cierra y vuelve escribiendo la URL aparece como orgánico. Este informe subestima el pago y sobreestima el directo, siempre.',
    ],
    bien: 'El canal con más volumen también convierte por encima de la media.',
    mal: 'El canal con más gasto convierte por debajo de la media.',
    trampa:
      'No compares canales con menos de 100 personas en el primer paso: un canal con 12 registros y 2 pagos parece un 17% brillante y es azar.',
    siSaleMal: [
      'Baja presupuesto del canal que trae volumen sin conversión y súbelo al que convierte.',
      'Cruza con "Conversión por promoción": puede que ese canal solo traiga cazadores de descuento.',
    ],
    link: 'pagoPorCanal',
  },

  pagoPorPromo: {
    id: 'pagoPorPromo',
    titulo: 'Conversión por promoción',
    queMide: 'Si la campaña trae clientes o solo adelanta compras que iban a pasar.',
    comoSeLee: [
      'De `checkout_iniciado` a `pago_exitoso`, partido por `promo_slug`.',
      'Sin promo también aparece: es la línea base contra la que se compara.',
      'Esto solo mide la conversión inmediata. Si se quedan o no, lo dice "Retención por cohorte".',
    ],
    bien: 'La promo convierte más que la línea base Y esa gente sigue pagando al segundo cobro.',
    mal: 'Convierte más pero cancela en el primer ciclo: compraste una compra, no un cliente.',
    trampa:
      'Un cupón siempre mejora la conversión del checkout. Ese número por sí solo no dice nada: la pregunta es qué pasa al mes siguiente.',
    siSaleMal: [
      'Cruza con "Cancelación por día del ciclo" filtrando por ese `promo_slug`.',
      'Si cancelan justo antes de la primera renovación, el descuento está comprando pruebas, no clientes.',
    ],
    link: 'pagoPorPromo',
  },

  cancelacionDiaCiclo: {
    id: 'cancelacionDiaCiclo',
    titulo: 'Cancelación por día del ciclo',
    queMide: 'En qué momento del periodo cancela la gente.',
    comoSeLee: [
      'Un pico en los primeros días es ARREPENTIMIENTO: el producto no era lo que esperaban.',
      'Un pico justo antes de renovar es DECISIÓN: lo usaron y no les compensó.',
      'Una meseta plana significa que no hay un patrón: la gente se va por motivos individuales.',
    ],
    bien: 'Sin picos marcados y con volumen bajo.',
    mal: 'Un pico claro en los primeros 3 días.',
    trampa:
      'La cancelación es al FIN DEL PERIODO, no inmediata. `dia_del_ciclo` es cuándo pulsaron el botón, no cuándo perdieron el acceso — la gente sigue usando el producto semanas después de aparecer aquí.',
    siSaleMal: [
      'Pico temprano: se arregla en la landing y el onboarding — se prometió algo distinto.',
      'Pico tardío: se arregla en el producto — lo usaron y no volvió a valer la pena.',
      'Cruza con "Motivo de cancelación" en la tabla de admin para saber cuál de los dos es.',
    ],
    link: 'cancelacionDiaCiclo',
  },

  // ═══ USO ═══════════════════════════════════════════════════════════
  retencionTema: {
    id: 'retencionTema',
    titulo: 'Retención D1/D7/D30',
    queMide: 'De los que abrieron un tema un día, cuántos volvieron después.',
    comoSeLee: [
      'Cada renglón es una cohorte: la gente que empezó ese día.',
      '🔴 Se lee por COLUMNA, no por renglón. La columna "Día 7" dice si el producto está mejorando con el tiempo.',
      'Un renglón concreto solo dice cómo le fue a esa cohorte; la tendencia está en la vertical.',
    ],
    bien: 'D1 > 40% · D7 > 20% · D30 > 10%.',
    mal: 'D30 por debajo de 5%: el producto no engancha.',
    trampa:
      'Los renglones de abajo siempre se ven vacíos a la derecha: no han pasado 30 días todavía. No es una caída, es que el futuro no ha ocurrido.',
    siSaleMal: [
      '🔴 Es producto, no marketing. Ninguna campaña arregla un D30 de 4%: solo trae más gente a la misma puerta giratoria.',
      'Mira "Lifecycle" para ver si el problema es que no vuelven o que nunca empezaron.',
      'Mira "Interactivos abandonados" y "Sorts fallidos": la fricción suele estar en un tipo de ejercicio concreto.',
    ],
    link: 'retencionTema',
  },

  lifecycle: {
    id: 'lifecycle',
    titulo: 'Lifecycle de alumnos',
    queMide: 'Cada semana, cuántos son nuevos, cuántos repiten, cuántos vuelven y cuántos se durmieron.',
    comoSeLee: [
      'Cuatro bandas: nuevos, recurrentes, resucitados y dormidos (estos últimos hacia abajo).',
      'Lo sano es que la banda de recurrentes crezca. Si solo crece la de nuevos, estás llenando un cubo con agujero.',
      'La banda de dormidos por debajo del eje es la que se fue esa semana.',
    ],
    bien: 'Recurrentes creciendo semana a semana y por encima de los nuevos.',
    mal: 'Dormidos igualan o superan a nuevos: crecimiento neto cero o negativo.',
    trampa:
      'Una semana con muchos "resucitados" suele ser un correo o una campaña, no una mejora del producto. Mira si coincide con algún envío antes de celebrar.',
    siSaleMal: [
      'Si hay muchos dormidos: correo de reactivación a quienes tienen racha rota.',
      'Si no hay resucitados: no existe ningún mecanismo que traiga gente de vuelta. Ese es el trabajo.',
    ],
    link: 'lifecycle',
  },

  stickiness: {
    id: 'stickiness',
    titulo: 'Stickiness semanal',
    queMide: 'Cuántos días a la semana usa el producto quien lo usa.',
    comoSeLee: [
      'La distribución de días activos por persona y semana.',
      'Un pico en 1 día significa que el producto se usa "cuando hay tarea", no como hábito.',
      'Un pico en 4-5 días significa que entró en la rutina de estudio.',
    ],
    bien: 'La mayoría en 3 días o más.',
    mal: 'La mayoría en 1 día.',
    trampa:
      'El fin de semana baja siempre y no es una señal de nada. Compara semanas completas contra semanas completas, no días sueltos.',
    siSaleMal: [
      'Si la mayoría usa 1 día: las rachas y los recordatorios son la palanca, porque el contenido ya funciona cuando entran.',
      'Cruza con "Rachas rotas": si se rompen en 7 días, el hábito se cae el fin de semana.',
    ],
    link: 'stickiness',
  },

  pistas: {
    id: 'pistas',
    titulo: 'Pistas pedidas',
    queMide: 'Si el sistema de pistas resuelve o solo entretiene.',
    comoSeLee: [
      'La distribución de `n_pista`: cuántas veces se pide la primera, la segunda, la tercera.',
      '🔴 Este insight muestra SOLO las pedidas. La tasa de resolución (`resolvio_tras_pista` con `correcto: true`) no está aquí: hay que mirarla aparte en PostHog con ese evento.',
      'Lo esperable es una escalera descendente: muchos piden la 1, menos la 2, pocos la 3.',
    ],
    bien: 'La mayoría resuelve entre la pista 2 y la 4.',
    mal: 'Un pico en la última pista con baja resolución: las pistas no llevan a ningún lado.',
    trampa:
      '🔴 Fallar consume una pista SIN pedirla. `pista_pedida` solo cuenta los clics del botón, así que este número es menor que las pistas realmente reveladas. Es a propósito: si contáramos las del fallo, la métrica mediría "cuánta gente falla", no "cuánta gente pide ayuda".',
    siSaleMal: [
      'Si nadie pasa de la pista 1: las pistas siguientes no aportan, o el botón no se ve.',
      'Si todos llegan a la última y no resuelven: las pistas no descomponen bien el problema. Reescribe ese ejercicio.',
    ],
    link: 'pistas',
  },

  hordaOleada: {
    id: 'hordaOleada',
    titulo: 'Horda por oleada',
    queMide: 'Hasta qué oleada llega la gente.',
    comoSeLee: [
      'Seis oleadas. La caída natural es progresiva; un escalón brusco señala una oleada mal calibrada.',
      'Se lee junto a "Horda por resultado", que dice qué le pasó a la gente en cada punto.',
    ],
    bien: 'Caída suave, con al menos un tercio llegando a la oleada 4.',
    mal: 'Más de la mitad se cae en una sola oleada.',
    trampa:
      'La oleada 1 siempre tendrá el máximo porque todo el mundo pasa por ella. Mira la forma de la curva, no el valor absoluto del primer punto.',
    siSaleMal: [
      'Baja la dificultad de la oleada donde está el escalón, o reparte mejor sus preguntas.',
    ],
    link: 'hordaOleada',
  },

  hordaResultado: {
    id: 'hordaResultado',
    titulo: 'Horda por resultado',
    queMide: 'Qué le pasa a la gente en cada oleada: avanza, repite o vuelve al principio.',
    comoSeLee: [
      'Tres valores: `avanza` (4-5 aciertos), `repite` (3) y `reinicia` (2 o menos).',
      'Un pico de `reinicia` en una oleada concreta significa que esa oleada está mal calibrada.',
      'Mucho `repite` no es malo: es el sistema funcionando como red de seguridad.',
    ],
    bien: '`avanza` mayoritario en las oleadas 1-3.',
    mal: '`reinicia` por encima de `avanza` en cualquier oleada.',
    trampa:
      '🔴 `reinicia` NO es derrota. El alumno vuelve a la oleada 1 y sigue jugando: la partida no termina. El abandono real es `horda_terminada` con `motivo: "abandono"`, que es otro evento.',
    siSaleMal: [
      'Reduce las preguntas difíciles de la oleada con exceso de `reinicia`.',
      'Si `reinicia` es alto en general, el umbral de 2 aciertos es demasiado castigador.',
    ],
    link: 'hordaResultado',
  },

  audio: {
    id: 'audio',
    titulo: 'Audio escuchado',
    queMide: 'Si el audio se escucha o solo se enciende.',
    comoSeLee: [
      'Cuatro hitos: 25, 50, 75 y 100%. Cada uno se dispara una vez por reproducción.',
      'Lo que importa es la CAÍDA entre 25% y 100%, no el volumen absoluto de cada barra.',
      'Si la mitad se va antes del 50%, el audio es demasiado largo o no aporta sobre el texto.',
    ],
    bien: 'Más del 50% de quienes empiezan llegan al 75%.',
    mal: 'Menos del 30% pasa del 50%.',
    trampa:
      'Arrastrar la barra NO cuenta como escuchado: los saltos mayores a 2 segundos se descartan del tiempo acumulado. El número es conservador a propósito, así que es un suelo, no una estimación.',
    siSaleMal: [
      'Acorta los audios de las secciones con más caída temprana.',
      'Si casi nadie llega al 25%, el problema es que el botón no invita: revisa su posición.',
    ],
    link: 'audio',
  },

  // ═══ CONTENIDO ═════════════════════════════════════════════════════
  temasAbiertos: {
    id: 'temasAbiertos',
    titulo: 'Temas más abiertos',
    queMide: 'Qué contenido busca la gente de verdad.',
    comoSeLee: [
      'Ordenado por aperturas. La cola larga importa tanto como la cabeza.',
      'Un tema muy abierto y poco completado es distinto de uno poco abierto: el primero decepciona, el segundo no se encuentra.',
    ],
    bien: 'La demanda repartida entre materias, sin un solo tema acaparando.',
    mal: 'Los diez primeros concentran casi todo: el resto del catálogo no se está descubriendo.',
    trampa:
      'Los temas más abiertos suelen ser los primeros de cada materia, simplemente porque están arriba en la lista. Compara dentro de cada materia, no entre materias.',
    siSaleMal: [
      'Genera más contenido parecido a los temas de cabeza.',
      'Si la cola no se abre, el problema es de navegación, no de catálogo.',
    ],
    link: 'temasAbiertos',
  },

  interactivosAbandonados: {
    id: 'interactivosAbandonados',
    titulo: 'Interactivos abandonados',
    queMide: 'Qué tipo de minijuego expulsa a la gente.',
    comoSeLee: [
      'Partido por `tipo`: `sort`, `steps`, `match`, `solve`. El evento trae `ultimo_paso`, que dice dónde exactamente.',
      '🔴 `scrubber` NUNCA aparecerá aquí: se completa al primer movimiento, así que no se puede abandonar. Su ausencia no es un error.',
    ],
    bien: 'Ningún tipo concentra el abandono.',
    mal: 'Un tipo dobla a los demás.',
    trampa:
      'Un tipo con más abandonos puede simplemente ser más frecuente en el catálogo. Divide entre las veces que ese tipo se inició, no lo leas en absoluto.',
    siSaleMal: [
      'Abre `ultimo_paso` del tipo peor: si todos se caen en el mismo paso, el ejercicio está mal diseñado.',
      'Si es `solve`, cruza con "Pistas pedidas": puede ser que las pistas no ayuden.',
    ],
    link: 'interactivosAbandonados',
  },

  sortsFallidos: {
    id: 'sortsFallidos',
    titulo: 'Sorts fallidos',
    queMide: 'Alumnos atascados en un ejercicio de ordenar.',
    comoSeLee: [
      '🔴 El `sort` solo se marca completado SI SE ACIERTA. Quien falla no completa, no gana XP, y la sección nunca se marca como leída.',
      'Por eso un alumno atascado aquí es invisible en el resto de métricas: no aparece como abandono ni como progreso.',
      'Partido por `topic`: dice en qué tema concreto está el ejercicio malo.',
    ],
    bien: 'Pocos fallos y repartidos entre temas.',
    mal: 'Un tema concentra los fallos.',
    trampa:
      'Un `sort_fallido` no es un alumno que se rindió: es un intento. La misma persona puede aparecer varias veces. Agrupa por persona única antes de sacar conclusiones.',
    siSaleMal: [
      'Un tema con muchos `sort_fallido` y pocos `interactivo_completado` tiene un ejercicio mal diseñado, no alumnos malos.',
      'Revisa las categorías de ese sort: si dos son ambiguas, cualquiera falla.',
    ],
    link: 'sortsFallidos',
  },

  solicitudesTema: {
    id: 'solicitudesTema',
    titulo: 'Solicitudes de tema',
    queMide: 'Qué contenido pide la gente que no existe.',
    comoSeLee: [
      'Partido por materia. Es demanda declarada, la señal más directa que hay.',
      'El evento trae `texto_libre`: distingue a quien solo puso el título de quien se molestó en explicar.',
    ],
    bien: 'Pocas solicitudes: el catálogo cubre lo que se busca.',
    mal: 'Una materia concentra solicitudes: falta contenido ahí.',
    trampa:
      'El volumen es siempre bajo — pedir requiere esfuerzo. Diez solicitudes de la misma materia son mucho más señal que cien visitas.',
    siSaleMal: [
      'Genera los temas más pedidos. Es la lista de trabajo con menos riesgo que existe.',
      'Mira la tabla en /admin/notificaciones para leer los textos libres.',
    ],
    link: 'solicitudesTema',
  },

  // ═══ RETENCIÓN ═════════════════════════════════════════════════════
  retencionCohorte: {
    id: 'retencionCohorte',
    titulo: 'Retención por cohorte de alta',
    queMide: 'Si la gente que se registra cada semana se queda más o menos que la anterior.',
    comoSeLee: [
      'Igual que la retención de uso, pero la cohorte se define por el registro, no por la primera lectura.',
      'Se lee por COLUMNA: si la columna de la semana 4 sube con el tiempo, lo que cambiaste funciona.',
      'Sirve para saber si un cambio de producto mejoró a los que entraron después.',
    ],
    bien: 'Cohortes más recientes reteniendo mejor que las antiguas.',
    mal: 'Cohortes recientes peor que las antiguas: algo se rompió o el canal cambió de calidad.',
    trampa:
      'Una cohorte de una semana de campaña no es comparable con una orgánica. Antes de concluir que el producto empeoró, mira de qué canal vino esa cohorte.',
    siSaleMal: [
      'Cruza con "Conversión por canal": una caída suele ser un canal nuevo que trae gente peor cualificada.',
    ],
    link: 'retencionCohorte',
  },

  activacion: {
    id: 'activacion',
    titulo: 'Activación',
    queMide: 'Cuánto tarda el producto en demostrar valor.',
    comoSeLee: [
      'Embudo de `primera_sesion` a `activado`: abrió contenido y completó su primer quiz.',
      'El evento `activado` trae `horas_desde_primera_sesion`: ahí está el tiempo real.',
      'Los dos son eventos de SERVIDOR, así que no dependen del consentimiento del navegador ni se pierden si cierran la pestaña.',
    ],
    bien: 'Más del 60% activa, y en menos de 48 horas.',
    mal: 'Menos del 30% activa.',
    trampa:
      'La activación se marca UNA vez por alumno y no se puede repetir: la columna tiene guard de NULL. Un alumno que completa diez quizzes sigue contando como una activación.',
    siSaleMal: [
      'El alumno entró, vio contenido y no completó un quiz: el problema está entre abrir el tema y terminarlo.',
      'Mira "Interactivos abandonados" y "Sorts fallidos" del mismo periodo: la fricción suele estar ahí.',
    ],
    link: 'activacion',
  },

  rachasRotas: {
    id: 'rachasRotas',
    titulo: 'Rachas rotas',
    queMide: 'Cuánta racha se pierde y en qué punto.',
    comoSeLee: [
      '`dias_perdidos` es la racha que se rompió. Un pico en 7 significa que la gente aguanta una semana y se cae el fin de semana siguiente.',
      'Solo aparecen rachas de más de 1 día: romper una racha de un día no es perder una racha.',
    ],
    bien: 'Pocas rachas rotas y con `dias_perdidos` alto: la gente aguanta mucho antes de caerse.',
    mal: 'Un pico en 2-3 días: el hábito no llega a formarse.',
    trampa:
      '🔴 Solo `/api/section-read` escribe la racha. Un alumno que solo hace quizzes o juega la Horda NO acumula racha aunque estudie a diario, y aparecerá aquí como si se hubiera ido. La métrica mide lectura de secciones, no actividad.',
    siSaleMal: [
      'Pico en 7 días: recordatorio el viernes o contenido específico de fin de semana.',
      'Pico en 2-3: el primer tramo es el que falla — revisa la activación.',
    ],
    link: 'rachasRotas',
  },

  // ═══ ERRORES ═══════════════════════════════════════════════════════
  erroresPorTipo: {
    id: 'erroresPorTipo',
    titulo: 'Errores por tipo',
    queMide: 'Qué falla en producción.',
    comoSeLee: [
      'Se lee POR TIPO, no por total. Un tipo NUEVO tras un deploy es lo que buscas.',
      'Los tipos que ya existían y se mantienen planos son ruido de fondo conocido.',
      'Ventana de 14 días para que un deploy reciente destaque contra la línea base.',
    ],
    bien: 'Sin tipos nuevos y con volumen plano.',
    mal: 'Más de 10 del mismo tipo en 24 horas.',
    trampa:
      'Un pico puede ser UN SOLO usuario reintentando. Agrupa por persona única antes de asustarte: 40 errores de una persona es un caso de soporte, no una caída.',
    siSaleMal: [
      'Más de 10 en 24h del mismo tipo: revisa los logs de Vercel de ese periodo.',
      'Si el tipo es `section_read_api` o `quiz_answer_api`, se está perdiendo progreso de alumnos: es prioritario.',
    ],
    link: 'erroresPorTipo',
  },

  erroresPorRuta: {
    id: 'erroresPorRuta',
    titulo: 'Errores por ruta',
    queMide: 'En qué pantalla ocurren los fallos.',
    comoSeLee: [
      'Complementa al de tipo: el tipo dice QUÉ falló, la ruta dice DÓNDE.',
      'Una ruta concentrando errores de varios tipos suele ser un problema de esa pantalla, no de las APIs.',
    ],
    bien: 'Errores repartidos y sin ruta dominante.',
    mal: 'Una ruta concentra la mayoría.',
    trampa:
      'Las rutas de tema llevan el slug dentro, así que se fragmentan en muchas entradas distintas. Agrupa mentalmente por patrón (`/guia/*/`) antes de compararlas con rutas fijas como `/planes`.',
    siSaleMal: [
      'Abre Session Replay filtrado por esa ruta y por usuarios con `error_occurred`.',
    ],
    link: 'erroresPorRuta',
  },

  hordaErrores: {
    id: 'hordaErrores',
    titulo: 'Errores de Horda',
    queMide: 'Cuántas partidas se rompen por un fallo técnico.',
    comoSeLee: [
      '🔴 Es un FALLO DE PRODUCTO, no un desenlace del juego. Está separado de `horda_terminada` a propósito: mezclarlos haría que una caída del endpoint pareciera gente rindiéndose.',
      'El evento trae `punto`, que dice en qué fase se rompió.',
    ],
    bien: 'Cero.',
    mal: 'Cualquier valor sostenido: cada uno es una partida perdida a media sesión.',
    trampa:
      'El volumen siempre será bajo comparado con el resto, y por eso es fácil ignorarlo. Míralo en absoluto, no en porcentaje: no hay un número aceptable.',
    siSaleMal: [
      'Revisa los logs de `/api/horde/run` y `/api/horde/answer` en Vercel para ese periodo.',
    ],
    link: 'hordaErrores',
  },
}

/** Todas las lecturas, para índices y navegación. */
export const IDS_LECTURA = Object.keys(LECTURAS)
