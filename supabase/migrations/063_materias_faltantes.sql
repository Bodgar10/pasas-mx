-- ============================================================
-- 063 — Materias faltantes (s44): 10 materias + 100 temas
-- ============================================================
-- Fuente: claude/Pasas_Auditoria_Materias_Faltantes_s44.md (proyecto).
--
-- 🔴 Las materias nacen OCULTAS: `grades = '{}'`.
--    El dashboard, el onboarding y `materiasParaGrado` (webhook de Stripe,
--    seats/add, seats/change-grade) filtran con `grades @> [grado]`. Con el
--    arreglo vacío ninguna aparece ni se le asigna a nadie, así que un alumno
--    nunca entra a una materia sin contenido.
--    El grado destino vive en `topics.grade`. Publicar una materia es:
--      1) cargar su contenido y poner sus temas published + horde_ready,
--      2) `update subjects set grades = array[<grado>]`,
--      3) backfill de `user_subjects` para los alumnos de ese nivel y grado
--         (la guía lee la temática de `user_subjects.theme_id`; sin la fila
--         el tema se pinta vacío). Ver scripts/contenido-materias/README.md.
--
-- Los slugs de `topics` son ÚNICOS EN TODA LA BASE (topics_slug_key) y la
-- guía busca el tema solo por slug: por eso todos llevan sufijo de materia.
-- Idempotente: ON CONFLICT (slug) DO NOTHING en materias y temas.
-- ============================================================

insert into public.subjects (name, slug, education_level, grades, plan_types, icon, display_order) values
  ('Tecnología 1°', 'tecnologia-sec-1', 'middle_school', '{}', '{grade,exam}', '💻', 80),
  ('Tecnología 2°', 'tecnologia-sec-2', 'middle_school', '{}', '{grade,exam}', '🖥️', 80),
  ('Tecnología 3°', 'tecnologia-sec-3', 'middle_school', '{}', '{grade,exam}', '🤖', 80),
  ('Artes 1°', 'artes-sec-1', 'middle_school', '{}', '{grade,exam}', '🎨', 90),
  ('Artes 2°', 'artes-sec-2', 'middle_school', '{}', '{grade,exam}', '🎭', 90),
  ('Artes 3°', 'artes-sec-3', 'middle_school', '{}', '{grade,exam}', '🎼', 90),
  ('Introducción a las Ciencias Sociales', 'introduccion-ciencias-sociales', 'high_school', '{}', '{grade,exam}', '🏘️', 45),
  ('Ciencias de la Salud I', 'ciencias-salud-1', 'high_school', '{}', '{grade,exam}', '🩺', 46),
  ('Ciencias de la Salud II', 'ciencias-salud-2', 'high_school', '{}', '{grade,exam}', '🫀', 47),
  ('Inglés VI', 'ingles-6', 'high_school', '{}', '{grade,exam}', '🎓', 48),
  ('Matemáticas Financieras', 'matematicas-financieras', 'high_school', '{}', '{grade,exam}', '💵', 49)
on conflict (slug) do nothing;

with nuevos (materia, orden, slug, name, description, icon, difficulty, grade) as (values
  -- ── Tecnología 1° (Informática) ───────────────────────────────
  ('tecnologia-sec-1', 1, 'que-es-la-tecnologia-tec-1', 'Qué es la tecnología: técnica, necesidades y productos', 'Por qué existen los objetos que usas y qué necesidad resolvió cada uno.', '🛠️', 1, 1),
  ('tecnologia-sec-1', 2, 'la-computadora-hardware-software-tec-1', 'La computadora: hardware, software y periféricos', 'Las partes que tocas, los programas que no y cómo entra y sale la información.', '🖥️', 1, 1),
  ('tecnologia-sec-1', 3, 'sistema-operativo-y-archivos-tec-1', 'Sistema operativo y organización de archivos', 'Qué hace el sistema operativo y cómo ordenar carpetas para no perder nada.', '📁', 1, 1),
  ('tecnologia-sec-1', 4, 'procesador-de-textos-tec-1', 'Procesador de textos: documentos, formato y tablas', 'Dar formato a un documento, insertar tablas y entregarlo bien presentado.', '📝', 1, 1),
  ('tecnologia-sec-1', 5, 'internet-busqueda-confiable-tec-1', 'Internet: navegación, búsqueda confiable y fuentes', 'Buscar mejor y distinguir una fuente confiable de una que no lo es.', '🌐', 2, 1),
  ('tecnologia-sec-1', 6, 'seguridad-digital-tec-1', 'Seguridad digital: contraseñas, privacidad y ciberacoso', 'Proteger tus cuentas y tus datos, y qué hacer ante el ciberacoso.', '🔒', 1, 1),
  ('tecnologia-sec-1', 7, 'correo-electronico-formal-tec-1', 'Correo electrónico y comunicación formal en línea', 'Escribir un correo formal: asunto, saludo, cuerpo, adjuntos y CC.', '📧', 1, 1),
  ('tecnologia-sec-1', 8, 'presentaciones-electronicas-tec-1', 'Presentaciones electrónicas', 'Diapositivas claras: poco texto, buena imagen y una idea por lámina.', '📊', 1, 1),
  ('tecnologia-sec-1', 9, 'medios-tecnicos-tec-1', 'Medios técnicos: herramientas, máquinas e instrumentos', 'La diferencia entre herramienta, máquina e instrumento, y cómo extienden el cuerpo.', '🔧', 2, 1),
  ('tecnologia-sec-1', 10, 'proyecto-tecnico-problema-solucion-tec-1', 'Proyecto técnico: identificar un problema y proponer una solución', 'Las fases del proyecto técnico, del problema al prototipo y su evaluación.', '💡', 2, 1),

  -- ── Tecnología 2° (Informática) ───────────────────────────────
  ('tecnologia-sec-2', 1, 'cambio-tecnico-y-sistemas-tecnicos-tec-2', 'Cambio técnico y sistemas técnicos', 'Cómo evolucionan los objetos y qué partes forman un sistema técnico.', '⚙️', 2, 2),
  ('tecnologia-sec-2', 2, 'hoja-de-calculo-formulas-tec-2', 'Hoja de cálculo: celdas, fórmulas y funciones básicas', 'Celdas, rangos y fórmulas como =SUMA y =PROMEDIO para que la hoja calcule por ti.', '🧮', 2, 2),
  ('tecnologia-sec-2', 3, 'hoja-de-calculo-graficas-tec-2', 'Hoja de cálculo: gráficas y análisis de datos', 'Elegir la gráfica correcta y leer lo que dicen los datos.', '📈', 2, 2),
  ('tecnologia-sec-2', 4, 'algoritmos-y-diagramas-de-flujo-tec-2', 'Introducción a la programación: algoritmos y diagramas de flujo', 'Pensar paso a paso: algoritmos y los símbolos del diagrama de flujo.', '🔀', 2, 2),
  ('tecnologia-sec-2', 5, 'programacion-por-bloques-scratch-tec-2', 'Programación por bloques (Scratch): secuencias, ciclos y condicionales', 'Mover un personaje con bloques: repetir, decidir y reaccionar a eventos.', '🧩', 2, 2),
  ('tecnologia-sec-2', 6, 'edicion-de-imagen-y-diseno-digital-tec-2', 'Edición de imagen y diseño digital', 'Píxeles, resolución, capas y formatos para que tus imágenes se vean bien.', '🖌️', 2, 2),
  ('tecnologia-sec-2', 7, 'tecnologia-y-sociedad-impacto-ambiental-tec-2', 'Tecnología y sociedad: impacto ambiental y responsabilidad', 'Lo que cuesta al planeta fabricar y tirar aparatos, y qué podemos hacer.', '🌱', 1, 2),
  ('tecnologia-sec-2', 8, 'propiedad-intelectual-uso-etico-tec-2', 'Propiedad intelectual y uso ético de la información', 'Derechos de autor, licencias y cómo citar sin caer en plagio.', '©️', 2, 2),
  ('tecnologia-sec-2', 9, 'trabajo-colaborativo-en-la-nube-tec-2', 'Trabajo colaborativo en la nube', 'Compartir, editar a la vez, permisos e historial de versiones.', '☁️', 1, 2),
  ('tecnologia-sec-2', 10, 'proyecto-tecnico-diseno-ejecucion-tec-2', 'Proyecto técnico: diseño, planeación y ejecución', 'Planear tiempos, materiales y costos, y llevar el diseño a la realidad.', '📐', 2, 2),

  -- ── Tecnología 3° (Informática) ───────────────────────────────
  ('tecnologia-sec-3', 1, 'innovacion-y-desarrollo-sustentable-tec-3', 'Innovación técnica y desarrollo sustentable', 'Qué hace que algo sea una innovación y cómo diseñar sin dañar el futuro.', '♻️', 2, 3),
  ('tecnologia-sec-3', 2, 'bases-de-datos-tablas-y-consultas-tec-3', 'Bases de datos: tablas, registros y consultas sencillas', 'Tablas, campos, registros y cómo pedirle a una base solo lo que buscas.', '🗄️', 2, 3),
  ('tecnologia-sec-3', 3, 'introduccion-a-html-tec-3', 'Introducción a HTML y páginas web', 'Etiquetas, títulos, párrafos, enlaces e imágenes: tu primera página web.', '🌐', 2, 3),
  ('tecnologia-sec-3', 4, 'python-variables-y-condicionales-tec-3', 'Programación con texto (Python básico): variables, operaciones y condicionales', 'Guardar datos en variables, operar con ellos y tomar decisiones con if.', '🐍', 3, 3),
  ('tecnologia-sec-3', 5, 'python-ciclos-listas-funciones-tec-3', 'Programación con texto: ciclos, listas y funciones', 'Repetir con for y while, guardar varios datos en listas y crear funciones.', '🔁', 3, 3),
  ('tecnologia-sec-3', 6, 'robotica-sensores-y-actuadores-tec-3', 'Robótica y automatización: sensores y actuadores', 'Cómo un robot percibe, decide y actúa: sensores, controlador y motores.', '🦾', 2, 3),
  ('tecnologia-sec-3', 7, 'inteligencia-artificial-usos-y-limites-tec-3', 'Inteligencia artificial: qué es, usos y límites', 'Cómo aprende una IA con datos, dónde la usas y en qué se equivoca.', '🧠', 2, 3),
  ('tecnologia-sec-3', 8, 'multimedia-audio-y-video-digital-tec-3', 'Multimedia: audio y video digital', 'Resolución, cuadros por segundo, compresión y formatos de audio y video.', '🎬', 2, 3),
  ('tecnologia-sec-3', 9, 'evaluacion-de-sistemas-y-gestion-tec-3', 'Evaluación de sistemas técnicos y gestión de proyectos', 'Medir si un sistema funciona y organizar un proyecto con tareas y fechas.', '📋', 2, 3),
  ('tecnologia-sec-3', 10, 'proyecto-de-innovacion-prototipo-tec-3', 'Proyecto técnico de innovación: prototipo y presentación', 'Construir un prototipo, probarlo, mejorarlo y presentarlo.', '🚀', 2, 3),

  -- ── Artes 1° ──────────────────────────────────────────────────
  ('artes-sec-1', 1, 'que-son-las-artes-lenguajes-artes-1', 'Qué son las artes: lenguajes artísticos y sus elementos', 'Artes visuales, música, danza y teatro: qué usa cada lenguaje para expresar.', '🎨', 1, 1),
  ('artes-sec-1', 2, 'punto-linea-forma-color-artes-1', 'Artes visuales: punto, línea, forma y color', 'Los elementos básicos con los que se construye cualquier imagen.', '✏️', 1, 1),
  ('artes-sec-1', 3, 'composicion-encuadre-perspectiva-artes-1', 'Composición, encuadre y perspectiva básica', 'Dónde poner las cosas en la imagen y cómo dar sensación de profundidad.', '🖼️', 2, 1),
  ('artes-sec-1', 4, 'ritmo-pulso-y-compas-artes-1', 'Música: ritmo, pulso y compás', 'El latido de la música y cómo se agrupan los tiempos.', '🥁', 1, 1),
  ('artes-sec-1', 5, 'melodia-altura-notacion-artes-1', 'Música: melodía, altura y notación básica', 'Notas graves y agudas, el pentagrama y las figuras musicales.', '🎵', 2, 1),
  ('artes-sec-1', 6, 'danza-cuerpo-espacio-tiempo-artes-1', 'Danza: cuerpo, espacio y tiempo', 'Los elementos del movimiento: niveles, direcciones, velocidad y energía.', '💃', 1, 1),
  ('artes-sec-1', 7, 'teatro-expresion-corporal-voz-artes-1', 'Teatro: expresión corporal y voz', 'Comunicar con el cuerpo, el gesto y la voz sobre el escenario.', '🎭', 1, 1),
  ('artes-sec-1', 8, 'patrimonio-artistico-mexico-artes-1', 'Patrimonio artístico y cultural de México', 'Lo que heredamos y debemos cuidar: material, inmaterial y natural.', '🏛️', 1, 1),
  ('artes-sec-1', 9, 'apreciacion-como-leer-una-obra-artes-1', 'Apreciación de obras: cómo leer una obra de arte', 'Describir, analizar, interpretar y valorar una obra paso a paso.', '🔎', 2, 1),
  ('artes-sec-1', 10, 'proyecto-artistico-colectivo-artes-1', 'Proyecto artístico colectivo', 'Organizar a un grupo para crear y presentar una obra entre todos.', '🤝', 2, 1),

  -- ── Artes 2° ──────────────────────────────────────────────────
  ('artes-sec-2', 1, 'dibujo-pintura-y-grabado-artes-2', 'Técnicas de artes visuales: dibujo, pintura y grabado', 'Materiales y procesos de cada técnica, y qué efecto logra cada una.', '🖌️', 1, 2),
  ('artes-sec-2', 2, 'circulo-cromatico-armonias-artes-2', 'Color: círculo cromático, armonías y contrastes', 'Primarios, secundarios, complementarios y cómo combinarlos.', '🌈', 2, 2),
  ('artes-sec-2', 3, 'fotografia-e-imagen-digital-artes-2', 'Fotografía e imagen digital', 'Luz, encuadre, planos y ángulos para contar algo con una foto.', '📷', 2, 2),
  ('artes-sec-2', 4, 'armonia-acordes-y-generos-artes-2', 'Música: armonía, acordes y géneros', 'Cómo suenan varias notas juntas y qué distingue a cada género.', '🎸', 2, 2),
  ('artes-sec-2', 5, 'instrumentos-y-familias-orquestales-artes-2', 'Instrumentos musicales y familias orquestales', 'Cuerdas, alientos y percusiones: cómo produce su sonido cada familia.', '🎻', 1, 2),
  ('artes-sec-2', 6, 'danza-folclorica-y-contemporanea-artes-2', 'Danza folclórica y danza contemporánea', 'Bailes que cuentan la identidad de una región y la danza que rompe reglas.', '🩰', 1, 2),
  ('artes-sec-2', 7, 'estructura-dramatica-personajes-artes-2', 'Teatro: estructura dramática y creación de personajes', 'Planteamiento, conflicto, clímax y desenlace, y cómo se construye un personaje.', '🎬', 2, 2),
  ('artes-sec-2', 8, 'arte-prehispanico-y-virreinal-artes-2', 'Historia del arte: del prehispánico al virreinato', 'Del arte olmeca y maya al barroco novohispano y el mestizaje.', '🗿', 2, 2),
  ('artes-sec-2', 9, 'arte-y-tecnologia-medios-digitales-artes-2', 'Arte y tecnología: medios digitales', 'Arte digital, animación, videoarte y lo que cambia al crear con pantallas.', '💻', 1, 2),
  ('artes-sec-2', 10, 'montaje-y-presentacion-de-obra-artes-2', 'Montaje y presentación de una obra', 'Producción, ensayos, escenografía, difusión y la función ante el público.', '🎟️', 2, 2),

  -- ── Artes 3° ──────────────────────────────────────────────────
  ('artes-sec-3', 1, 'vanguardias-y-arte-contemporaneo-artes-3', 'Vanguardias y arte contemporáneo', 'Impresionismo, cubismo, surrealismo y el arte que vino después.', '🌀', 2, 3),
  ('artes-sec-3', 2, 'muralismo-y-arte-mexicano-siglo-xx-artes-3', 'Arte mexicano del siglo XX: muralismo y después', 'Rivera, Siqueiros, Orozco, Kahlo y la Ruptura.', '🖼️', 2, 3),
  ('artes-sec-3', 3, 'escultura-e-instalacion-artes-3', 'Escultura, instalación y arte tridimensional', 'Volumen, materiales y obras que se recorren con el cuerpo.', '🗽', 2, 3),
  ('artes-sec-3', 4, 'formas-musicales-y-produccion-artes-3', 'Música: formas musicales y producción musical', 'Estrofa, coro y puente, y cómo se graba y mezcla una canción.', '🎚️', 2, 3),
  ('artes-sec-3', 5, 'musica-popular-identidad-globalizacion-artes-3', 'Música popular, identidad y globalización', 'Cómo la música dice quién eres y viaja de un país a otro.', '🌎', 1, 3),
  ('artes-sec-3', 6, 'coreografia-y-creacion-dancistica-artes-3', 'Coreografía y creación dancística', 'Componer una coreografía: motivo, variación, unísono y canon.', '🕺', 2, 3),
  ('artes-sec-3', 7, 'dramaturgia-direccion-puesta-en-escena-artes-3', 'Teatro: dramaturgia, dirección y puesta en escena', 'Quién escribe, quién dirige y cómo una obra llega al escenario.', '🎭', 2, 3),
  ('artes-sec-3', 8, 'critica-y-analisis-de-obras-artes-3', 'Crítica y análisis de obras artísticas', 'Opinar de una obra con argumentos y no solo con gustos.', '📝', 2, 3),
  ('artes-sec-3', 9, 'arte-comunidad-transformacion-artes-3', 'Arte, comunidad y transformación social', 'Arte urbano, comunitario y de protesta: cuando el arte cambia un lugar.', '✊', 1, 3),
  ('artes-sec-3', 10, 'proyecto-artistico-integrador-artes-3', 'Proyecto artístico integrador', 'Unir varios lenguajes artísticos en un solo proyecto con propósito.', '🌟', 2, 3),

  -- ── Introducción a las Ciencias Sociales (1° prepa) ───────────
  ('introduccion-ciencias-sociales', 1, 'que-son-las-ciencias-sociales-ics', 'Qué son las ciencias sociales: objeto de estudio y método', 'Qué estudian las ciencias sociales y por qué su método es distinto.', '🏘️', 1, 1),
  ('introduccion-ciencias-sociales', 2, 'ciencias-sociales-y-naturales-ics', 'Ciencias sociales y ciencias naturales: diferencias y relación', 'Estudiar personas no es igual que estudiar átomos, y a veces se necesitan.', '🔬', 1, 1),
  ('introduccion-ciencias-sociales', 3, 'disciplinas-sociales-ics', 'Disciplinas sociales: historia, sociología, economía, antropología, ciencia política, psicología social', 'Qué pregunta hace cada disciplina sobre un mismo hecho social.', '🧭', 1, 1),
  ('introduccion-ciencias-sociales', 4, 'origen-de-las-ciencias-sociales-ics', 'Origen de las ciencias sociales: Ilustración, Revolución Industrial y positivismo', 'Los cambios que hicieron necesario estudiar científicamente a la sociedad.', '🏭', 2, 1),
  ('introduccion-ciencias-sociales', 5, 'corrientes-teoricas-ics', 'Corrientes teóricas: positivismo, marxismo, funcionalismo y teoría comprensiva', 'Cuatro lentes para explicar la sociedad: Comte, Marx, Durkheim y Weber.', '👓', 3, 1),
  ('introduccion-ciencias-sociales', 6, 'conceptos-basicos-sociedad-estado-ics', 'Conceptos básicos: sociedad, Estado, clase, cultura, poder e identidad', 'Las palabras clave que usarás en todas las ciencias sociales.', '🏛️', 2, 1),
  ('introduccion-ciencias-sociales', 7, 'instituciones-sociales-ics', 'Instituciones sociales: familia, escuela, Estado, religión y medios', 'Las instituciones que nos forman y qué función cumple cada una.', '🏫', 1, 1),
  ('introduccion-ciencias-sociales', 8, 'problemas-sociales-de-mexico-ics', 'Problemas sociales de México: pobreza, desigualdad, migración y violencia', 'Cómo se miden y se explican los grandes problemas del país.', '🇲🇽', 2, 1),
  ('introduccion-ciencias-sociales', 9, 'individuo-sociedad-participacion-ics', 'Interacción individuo–sociedad y participación ciudadana', 'Socialización, roles y las formas de participar en tu comunidad.', '🙋', 1, 1),
  ('introduccion-ciencias-sociales', 10, 'investigacion-social-tecnicas-ics', 'Investigación social: planteamiento, encuesta, entrevista y observación', 'Plantear una pregunta y elegir la técnica correcta para responderla.', '📋', 2, 1),

  -- ── Ciencias de la Salud I (3° prepa) ─────────────────────────
  ('ciencias-salud-1', 1, 'salud-y-enfermedad-prevencion-cs1', 'Salud y enfermedad: concepto OMS, determinantes y niveles de prevención', 'Qué es estar sano según la OMS y los tres niveles de prevención.', '🩺', 1, 3),
  ('ciencias-salud-1', 2, 'sistema-de-salud-en-mexico-cs1', 'Salud pública en México: sistema de salud e instituciones', 'IMSS, ISSSTE, servicios estatales y los tres niveles de atención.', '🏥', 2, 3),
  ('ciencias-salud-1', 3, 'epidemiologia-basica-cs1', 'Epidemiología básica: morbilidad, mortalidad e indicadores', 'Incidencia, prevalencia y tasas para medir la salud de una población.', '📊', 3, 3),
  ('ciencias-salud-1', 4, 'nutricion-y-plato-del-bien-comer-cs1', 'Nutrición: grupos de alimentos, plato del bien comer y trastornos alimentarios', 'Qué aporta cada grupo de alimentos y las señales de un trastorno alimentario.', '🥗', 1, 3),
  ('ciencias-salud-1', 5, 'higiene-saneamiento-infecciosas-cs1', 'Higiene, saneamiento y enfermedades infecciosas', 'Cómo se transmiten las infecciones y cómo se corta la cadena de contagio.', '🧼', 2, 3),
  ('ciencias-salud-1', 6, 'vacunacion-y-esquema-nacional-cs1', 'Vacunación y esquema nacional', 'Cómo funciona una vacuna, la inmunidad de grupo y el esquema en México.', '💉', 2, 3),
  ('ciencias-salud-1', 7, 'salud-sexual-y-reproductiva-cs1', 'Salud sexual y reproductiva: anticoncepción e ITS', 'Métodos anticonceptivos, infecciones de transmisión sexual y prevención.', '🛡️', 2, 3),
  ('ciencias-salud-1', 8, 'adicciones-tabaco-alcohol-drogas-cs1', 'Adicciones: tabaco, alcohol y drogas', 'Cómo se forma una adicción, sus efectos y dónde pedir ayuda.', '🚭', 2, 3),
  ('ciencias-salud-1', 9, 'salud-mental-adolescentes-cs1', 'Salud mental: estrés, ansiedad y depresión en adolescentes', 'Reconocer las señales, cuidarte y saber cuándo y a quién pedir ayuda.', '🧠', 1, 3),
  ('ciencias-salud-1', 10, 'primeros-auxilios-basicos-cs1', 'Primeros auxilios básicos', 'Qué hacer en los primeros minutos: evaluar, pedir ayuda y actuar seguro.', '⛑️', 2, 3),

  -- ── Ciencias de la Salud II (3° prepa) ────────────────────────
  ('ciencias-salud-2', 1, 'diabetes-hipertension-obesidad-cs2', 'Enfermedades crónico-degenerativas: diabetes, hipertensión y obesidad', 'Las tres enfermedades que más pesan en México y cómo se previenen.', '🩸', 2, 3),
  ('ciencias-salud-2', 2, 'enfermedades-cardiovasculares-respiratorias-cs2', 'Enfermedades cardiovasculares y respiratorias', 'Infarto, embolia, asma y EPOC: causas, señales de alarma y prevención.', '🫁', 2, 3),
  ('ciencias-salud-2', 3, 'cancer-riesgo-y-deteccion-cs2', 'Cáncer: factores de riesgo y detección oportuna', 'Qué es el cáncer, qué aumenta el riesgo y por qué detectarlo a tiempo cambia todo.', '🎗️', 2, 3),
  ('ciencias-salud-2', 4, 'aparato-digestivo-padecimientos-cs2', 'Aparato digestivo y padecimientos frecuentes', 'El recorrido de la comida y los problemas digestivos más comunes.', '🫃', 2, 3),
  ('ciencias-salud-2', 5, 'sistema-inmunologico-alergias-cs2', 'Sistema inmunológico, alergias y autoinmunidad', 'Cómo te defiende el cuerpo y qué pasa cuando se equivoca de enemigo.', '🛡️', 3, 3),
  ('ciencias-salud-2', 6, 'salud-ambiental-y-ocupacional-cs2', 'Salud ambiental y ocupacional', 'Cómo el aire, el agua y el trabajo afectan tu salud.', '🏭', 2, 3),
  ('ciencias-salud-2', 7, 'accidentes-y-violencia-salud-publica-cs2', 'Accidentes y violencia como problema de salud pública', 'Por qué los accidentes y la violencia se estudian y se previenen como enfermedades.', '🚑', 2, 3),
  ('ciencias-salud-2', 8, 'historia-clinica-signos-vitales-cs2', 'Historia clínica, signos vitales y exploración básica', 'Pulso, presión, temperatura, respiración y cómo se arma una historia clínica.', '📋', 2, 3),
  ('ciencias-salud-2', 9, 'farmacologia-basica-automedicacion-cs2', 'Farmacología básica: tipos de medicamentos y automedicación', 'Qué hace cada tipo de medicamento y por qué automedicarse es un riesgo.', '💊', 2, 3),
  ('ciencias-salud-2', 10, 'bioetica-derechos-pacientes-cs2', 'Bioética y derechos de los pacientes', 'Autonomía, consentimiento informado y los derechos que tienes como paciente.', '⚖️', 2, 3),

  -- ── Inglés VI (3° prepa) ──────────────────────────────────────
  ('ingles-6', 1, 'review-of-tenses-ingles-6', 'Review of tenses: present, past and future in context', 'Todos los tiempos verbales juntos y cómo elegir el correcto en contexto.', '⏱️', 2, 3),
  ('ingles-6', 2, 'second-third-mixed-conditionals-ingles-6', 'Conditionals II and III and mixed conditionals', 'Situaciones imaginarias y arrepentimientos: if I were, if I had known.', '🔀', 3, 3),
  ('ingles-6', 3, 'passive-voice-all-tenses-ingles-6', 'Passive voice in all tenses', 'Cuando importa la acción y no quién la hizo, en todos los tiempos.', '🔄', 2, 3),
  ('ingles-6', 4, 'reported-speech-ingles-6', 'Reported speech: statements, questions and commands', 'Contar lo que alguien dijo, preguntó u ordenó sin citarlo palabra por palabra.', '🗨️', 3, 3),
  ('ingles-6', 5, 'relative-and-participle-clauses-ingles-6', 'Relative clauses and participle clauses', 'Who, which, that, whose y cómo acortar oraciones con participios.', '🔗', 3, 3),
  ('ingles-6', 6, 'modals-of-deduction-ingles-6', 'Modals of deduction and speculation (must have, might have)', 'Deducir con seguridad o con duda, en presente y en pasado.', '🕵️', 3, 3),
  ('ingles-6', 7, 'phrasal-verbs-and-collocations-ingles-6', 'Phrasal verbs and collocations for everyday and academic use', 'Give up, look into, make a decision: las combinaciones que suenan natural.', '🧷', 2, 3),
  ('ingles-6', 8, 'reading-argumentative-scientific-ingles-6', 'Reading comprehension: argumentative and scientific texts', 'Encontrar la tesis, los argumentos y la evidencia en un texto en inglés.', '📖', 2, 3),
  ('ingles-6', 9, 'writing-essays-letters-cv-ingles-6', 'Writing: essays, formal letters and CV', 'La estructura de un ensayo, una carta formal y un CV en inglés.', '✍️', 2, 3),
  ('ingles-6', 10, 'listening-speaking-interviews-debates-ingles-6', 'Listening and speaking: job interviews, presentations and debates', 'Frases para entrevistas, presentaciones y debates en inglés.', '🎤', 2, 3),

  -- ── Matemáticas Financieras (3° prepa) ────────────────────────
  ('matematicas-financieras', 1, 'porcentajes-razones-proporciones-mf', 'Porcentajes, razones y proporciones aplicados al dinero', 'Descuentos, aumentos e IVA calculados sin errores.', '💯', 1, 3),
  ('matematicas-financieras', 2, 'interes-simple-mf', 'Interés simple: capital, tasa, tiempo y monto', 'I = C·i·t y cómo despejar cualquiera de sus partes.', '💵', 2, 3),
  ('matematicas-financieras', 3, 'interes-compuesto-capitalizacion-mf', 'Interés compuesto y capitalización', 'Cuando los intereses también generan intereses: M = C(1 + i)ⁿ.', '📈', 2, 3),
  ('matematicas-financieras', 4, 'tasa-nominal-efectiva-equivalente-mf', 'Tasas nominal, efectiva y equivalente', 'Comparar tasas que se capitalizan distinto para elegir la mejor.', '⚖️', 3, 3),
  ('matematicas-financieras', 5, 'descuento-simple-y-compuesto-mf', 'Descuento simple y compuesto', 'Cuánto vale hoy un pago que vence después.', '🏷️', 2, 3),
  ('matematicas-financieras', 6, 'anualidades-vencidas-anticipadas-mf', 'Anualidades vencidas y anticipadas', 'Pagos iguales y periódicos: cuánto acumulan y cuánto valen hoy.', '🗓️', 3, 3),
  ('matematicas-financieras', 7, 'amortizacion-de-creditos-mf', 'Amortización de créditos y tablas de pago', 'Cómo cada pago se reparte entre interés y capital hasta saldar la deuda.', '🏦', 3, 3),
  ('matematicas-financieras', 8, 'depreciacion-de-activos-mf', 'Depreciación de activos', 'Cuánto valor pierde un bien con el uso: método de línea recta y otros.', '📉', 2, 3),
  ('matematicas-financieras', 9, 'inflacion-valor-presente-futuro-mf', 'Inflación, valor presente y valor futuro', 'Por qué $100 de hoy no valen lo mismo dentro de un año.', '🎈', 2, 3),
  ('matematicas-financieras', 10, 'presupuesto-ahorro-inversion-mf', 'Presupuesto personal, ahorro e inversión básica', 'Armar un presupuesto, ahorrar con meta y entender riesgo y rendimiento.', '🐷', 1, 3)
)
insert into public.topics (subject_id, name, slug, description, display_order, difficulty, xp_reward, is_diagnostic, published, icon, grade, horde_ready)
select s.id, n.name, n.slug, n.description, n.orden, n.difficulty, 100, n.orden = 1, false, n.icon, n.grade, false
from nuevos n
join public.subjects s on s.slug = n.materia
on conflict (slug) do nothing;
