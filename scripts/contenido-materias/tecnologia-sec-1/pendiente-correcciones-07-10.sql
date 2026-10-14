-- Correcciones de la revisión independiente (s44) para los temas 7-10 de
-- Tecnología 1°. Los JSON de esta carpeta YA tienen estos cambios; este
-- bloque solo los lleva a la base. Atómico: si una sola fila no coincide,
-- no cambia nada. Borrar este archivo una vez aplicado.
DO $do$
DECLARE n int;
  t7 uuid := (SELECT id FROM topics WHERE slug='correo-electronico-formal-tec-1');
  t8 uuid := (SELECT id FROM topics WHERE slug='presentaciones-electronicas-tec-1');
  t9 uuid := (SELECT id FROM topics WHERE slug='medios-tecnicos-tec-1');
  t10 uuid := (SELECT id FROM topics WHERE slug='proyecto-tecnico-problema-solucion-tec-1');
  am uuid := (SELECT id FROM themes WHERE name='Anime & Manga');
  fu uuid := (SELECT id FROM themes WHERE name='Fútbol');
  kp uuid := (SELECT id FROM themes WHERE name='K-pop & K-dramas');
  vj uuid := (SELECT id FROM themes WHERE name='Videojuegos');
BEGIN
  -- 07
  UPDATE quiz_questions SET question=$x$En soporte@tiendadejuegos.com, ¿qué parte es el nombre de usuario?$x$,
     options=replace(replace(options::text, '"nintendo.com"', '"tiendadejuegos.com"'), '"@nintendo"', '"@tiendadejuegos"')::jsonb
   WHERE topic_id=t7 AND theme_id=vj AND question='En soporte@nintendo.com, ¿qué parte es el nombre de usuario?'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'f1'; END IF;
  UPDATE horde_questions SET question=$x$Un correo de un remitente desconocido que te pide tu contraseña, ¿en qué carpeta suele terminar?$x$
   WHERE topic_id=t7 AND question LIKE 'Recibes un correo en tu bandeja que te pide tu contraseña%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'f2'; END IF;
  UPDATE horde_questions SET question=$x$Te piden mandar tu tarea al maestro con copia a tu tutor, y que el maestro vea que el tutor la recibió. ¿Cómo lo armas?$x$
   WHERE topic_id=t7 AND question LIKE 'Te piden mandar tu tarea al maestro con copia a tu tutor, sin que nadie%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'f3'; END IF;
  -- 08
  UPDATE sections SET content=replace(replace(content, 'una lámina que dice que será en México, Estados Unidos y Canadá', 'una lámina que dice que se jugó en México, Estados Unidos y Canadá'), 'México será el primer país en recibir tres Mundiales', 'México fue el primer país en recibir tres Mundiales')
   WHERE topic_id=t8 AND theme_id=fu AND user_id IS NULL AND type='example' AND content LIKE '%que será en México%' AND content LIKE '%México será el primer%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'g1'; END IF;
  UPDATE sections SET content=replace(content, 'un gran cierre con el anuncio más esperado, el famoso one more thing.', 'un gran cierre con el anuncio más esperado al final.')
   WHERE topic_id=t8 AND theme_id=vj AND user_id IS NULL AND type='analogy' AND content LIKE '%one more thing.%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'g2'; END IF;
  UPDATE sections SET data=replace(data::text, '"El one more thing del final"', '"El gran anuncio del final"')::jsonb
   WHERE topic_id=t8 AND theme_id=vj AND user_id IS NULL AND type='connect' AND data::text LIKE '%one more thing%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'g3'; END IF;
  -- 09
  UPDATE sections SET data=jsonb_set(data, '{pairs,3}', '{"a": "Delegar funciones", "b": "El objeto hace tu tarea"}'::jsonb)
   WHERE topic_id=t9 AND user_id IS NULL AND type='match' AND data->'pairs'->3->>'a' IN ('Polea','Cañón de balones','Plataforma elevadora','Granja automática'); GET DIAGNOSTICS n=ROW_COUNT; IF n<>4 THEN RAISE EXCEPTION 'h1 %', n; END IF;
  UPDATE sections SET content=replace(content, '**Paso 1:** Un inflador de mano para los balones → **herramienta**, la fuerza la pone él.', '**Paso 1:** Una llave para cambiar los tacos de los botines → **herramienta**, la fuerza la pone él.')
   WHERE topic_id=t9 AND theme_id=fu AND user_id IS NULL AND type='example' AND content LIKE '%inflador de mano%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h2'; END IF;
  UPDATE sections SET content=$x$Las tijeras son herramienta porque la fuerza es tuya; el compresor eléctrico es máquina porque transforma energía; y el manómetro que revisa la presión del balón es instrumento porque mide.$x$
   WHERE topic_id=t9 AND theme_id=fu AND user_id IS NULL AND type='tip'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h3'; END IF;
  UPDATE sections SET data=replace(data::text, '"Inflador de mano"', '"Llave para tacos"')::jsonb
   WHERE topic_id=t9 AND theme_id=fu AND user_id IS NULL AND type='sort' AND data::text LIKE '%"Inflador de mano"%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h4'; END IF;
  UPDATE quiz_questions SET explanation=$x$La llave de tacos funciona con la fuerza de quien la usa: herramienta. El compresor es máquina y el manómetro y el cronómetro, instrumentos.$x$,
     options=replace(options::text, '"El inflador de mano"', '"La llave de tacos"')::jsonb
   WHERE topic_id=t9 AND theme_id=fu AND question='¿Cuál de estos objetos del entrenador es una herramienta?'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h5'; END IF;
  UPDATE sections SET content=replace(content, 'Hace años, a los artistas los subían al escenario empujando escaleras a mano; hoy la plataforma hace ese trabajo.', 'Antes, las integrantes tenían que subir al escenario por una escalera, con sus propias piernas; hoy la plataforma elevadora hace ese trabajo.')
   WHERE topic_id=t9 AND theme_id=kp AND user_id IS NULL AND type='analogy' AND content LIKE '%empujando escaleras a mano%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h6'; END IF;
  UPDATE sections SET data=replace(data::text, '"La plataforma en vez de cargar"', '"La plataforma en vez de subir a pie"')::jsonb
   WHERE topic_id=t9 AND theme_id=kp AND user_id IS NULL AND type='connect' AND data::text LIKE '%en vez de cargar%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h7'; END IF;
  UPDATE quiz_questions SET question=$x$Antes, las integrantes subían al escenario por una escalera; hoy las sube una plataforma. ¿Qué concepto explica esto?$x$
   WHERE topic_id=t9 AND theme_id=kp AND question LIKE 'Antes, a los artistas los subían empujando escaleras%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h8'; END IF;
  UPDATE sections SET data=replace(data::text, 'Luego craftear un hacha', 'Luego crafteas un hacha')::jsonb
   WHERE topic_id=t9 AND theme_id=vj AND user_id IS NULL AND type='steps' AND data::text LIKE '%Luego craftear un hacha%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h9'; END IF;
  UPDATE sections SET data=replace(data::text, '"La granja que cosecha sola"', '"Que la granja coseche por ti"')::jsonb
   WHERE topic_id=t9 AND theme_id=vj AND user_id IS NULL AND type='connect' AND data::text LIKE '%La granja que cosecha sola%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h10'; END IF;
  UPDATE horde_questions SET explanation=$x$Las dos cortan; las tijeras funcionan con la fuerza de tu mano y la cortadora con un motor que transforma energía eléctrica.$x$
   WHERE topic_id=t9 AND question='¿Qué diferencia hay entre unas tijeras y una cortadora eléctrica de papel?'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'h11'; END IF;
  -- 10
  UPDATE sections SET content=replace(content, 'One Piece, Chainsaw Man, Spy x Family', 'One Piece, Haikyuu!!, Spy x Family')
   WHERE topic_id=t10 AND theme_id=am AND user_id IS NULL AND type='analogy' AND content LIKE '%Chainsaw Man%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'i1'; END IF;
  UPDATE sections SET data=replace(data::text, '"Reforzar las esquinas con cinta"', '"Doblar y pegar las divisiones"')::jsonb
   WHERE topic_id=t10 AND theme_id=am AND user_id IS NULL AND type='sort' AND data::text LIKE '%Reforzar las esquinas con cinta%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'i2'; END IF;
  UPDATE sections SET data=replace(data::text, '"Ponerle peso a la base"', '"Cortar los tubos a la medida"')::jsonb
   WHERE topic_id=t10 AND theme_id=kp AND user_id IS NULL AND type='sort' AND data::text LIKE '%Ponerle peso a la base%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'i3'; END IF;
  UPDATE horde_questions SET hint=$x$Piensa qué necesitas tener listo antes de poder construir.$x$
   WHERE topic_id=t10 AND question='Ordena: planear, identificar el problema, evaluar, ejecutar. ¿Cuál va en tercer lugar?'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'i4'; END IF;
  UPDATE diagnostic_questions SET question=$x$Los alumnos se mojan al esperar el transporte en la entrada de la escuela. Para resolverlo con un proyecto técnico, ¿qué se hace primero?$x$,
     explanation=$x$Primero se identifica y delimita el problema: qué pasa, dónde y a quién afecta. Construir, comprar y evaluar vienen después de investigar y planear.$x$,
     options=replace(replace(replace(replace(options::text, '"Identificar el problema"', '"Delimitar el problema"'), '"Construir el prototipo final"', '"Construir un techo ya"'), '"Evaluar todos los resultados"', '"Comprar las láminas"'), '"Comprar todos los materiales"', '"Evaluar el techo hecho"')::jsonb
   WHERE topic_id=t10 AND options::text LIKE '%"Identificar el problema"%'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'i5'; END IF;
END
$do$;
