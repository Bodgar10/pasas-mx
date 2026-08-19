-- =====================================================================
-- SEMILLA DE PRUEBAS — SOLO ENTORNO LOCAL
--
-- La corre `supabase db reset` en cada reinicio, despues de aplicar las
-- 39 migraciones. NUNCA se aplica a produccion: vive en este archivo y
-- solo lo lee el CLI contra el contenedor local.
--
-- 🔴 TODO ES FICTICIO. Ni una palabra de contenido real. El catalogo de
-- produccion (65 subjects, ~583 topics cargados desde Excel) NO esta en
-- el repo y no se reconstruye desde aqui — ver la nota de
-- 021_subjects_grades_fix.sql, que es solo documental.
--
-- 🔴 QUE NO ESTA AQUI, Y POR QUE.
--
-- No hay users, learners, subscriptions ni user_subjects. Esas las crea
-- cada prueba y las borra al terminar. Datos de usuario compartidos
-- entre pruebas es como una suite empieza a fallar segun el orden en
-- que corre, y ese fallo es carisimo de diagnosticar.
--
-- Aqui solo va CATALOGO: lo que toda prueba necesita leer y ninguna
-- necesita modificar.
--
-- 🔴 LOS IDS SON FIJOS Y LEGIBLES. Las pruebas los referencian directo
-- sin tener que consultarlos primero:
--     themes    11111111-…-1111TT
--     subjects  22222222-…-2222SS
--     topics    33333333-…-3333NN
-- =====================================================================

-- ---------------------------------------------------------------------
-- THEMES — 2 filas
--
-- `plan_types` es NOT NULL y decide que planes pueden usar la tematica.
-- Las dos cubren los dos planes vendibles para que una prueba con plan
-- `grade` y otra con `ai_personalized` encuentren tematica.
--
-- Hacen falta porque `upsertPrimaryLearner` resuelve `theme_id`
-- buscando por nombre con ilike, y porque `user_subjects.theme_id` es
-- NOT NULL: sin una sola fila aqui, el webhook no puede sembrar
-- materias.
-- ---------------------------------------------------------------------
insert into public.themes (id, name, description, plan_types, active) values
  ('11111111-1111-4111-8111-111111111101', 'Videojuegos Test',
   'Tematica ficticia para pruebas automatizadas.', '{grade,ai_personalized}', true),
  ('11111111-1111-4111-8111-111111111102', 'Musica Test',
   'Segunda tematica ficticia, para probar que se elige la correcta.', '{grade,ai_personalized}', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- SUBJECTS — 3 filas, repartidas en DOS grados
--
-- 🔴 El reparto es deliberado. `materiasParaGrado` filtra por
-- education_level + grades, y el cambio de grado solo se puede probar
-- de verdad si hay catalogo en el grado ORIGEN y en el DESTINO:
--
--     grado 1 → Matematicas Test, Espanol Test
--     grado 2 → Historia Test
--
-- Con todo en un solo grado, /api/seats/change-grade cortaria por
-- "grado sin catalogo" y la prueba pasaria por la razon equivocada.
--
-- `grades` es integer[]: se usa un solo grado por fila a proposito,
-- que es como quedo produccion tras el fix estructural de la 021.
-- ---------------------------------------------------------------------
insert into public.subjects (id, name, slug, education_level, grades, plan_types, display_order) values
  ('22222222-2222-4222-8222-222222222201', 'Matematicas Test', 'matematicas-test-sec-1',
   'middle_school', '{1}', '{grade,ai_personalized}', 1),
  ('22222222-2222-4222-8222-222222222202', 'Espanol Test', 'espanol-test-sec-1',
   'middle_school', '{1}', '{grade,ai_personalized}', 2),
  ('22222222-2222-4222-8222-222222222203', 'Historia Test', 'historia-test-sec-2',
   'middle_school', '{2}', '{grade,ai_personalized}', 1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- TOPICS — 8 filas
--
--     Matematicas Test (grado 1)  3 topics, UNO sin publicar
--     Espanol Test     (grado 1)  3 topics, todos publicados
--     Historia Test    (grado 2)  2 topics, todos publicados
--
-- 🔴 EL GRADO VIVE EN DOS SITIOS Y HAY QUE LLENAR LOS DOS.
--
--     subjects.grades  integer[]  ← lo usa materiasParaGrado()
--     topics.grade     integer    ← lo usa la RPC preview_stats()
--
-- No es un descuido del esquema: `topics.grade` es de la migracion 003
-- ("cada grado tiene un temario distinto de la SEP") y `subjects.grades`
-- quedo asi tras el fix estructural de la 021. Conviven, y una consulta
-- usa uno y otra usa el otro.
--
-- La primera version de este archivo solo llenaba `subjects.grades`, y
-- preview_stats devolvia CEROS en todo. Eso habria hecho fallar la
-- prueba de cambio de grado por "Todavia no tenemos contenido para ese
-- grado" — un fallo por falta de datos disfrazado de fallo de codigo,
-- que es justo lo que el seed existe para evitar.
--
-- 🔴 Los dos valores tienen que ser COHERENTES: el `grade` de un topic
-- debe estar dentro del `grades` de su subject.
--
-- 🔴 El topic con `published = false` es el que da valor a esta tabla.
-- preview_stats y el catalogo cuentan SOLO los publicados: sin una fila
-- sin publicar, una consulta que se olvide del filtro devuelve el mismo
-- numero que una que lo aplique, y la prueba no distingue.
--
-- Resultado esperado de preview_stats:
--     grado 1 → materias 2, temas 5   (6 topics, 5 publicados)
--     grado 2 → materias 1, temas 2
-- ---------------------------------------------------------------------
insert into public.topics (id, subject_id, name, slug, description, grade, display_order, difficulty, published) values
  -- Matematicas Test — grado 1
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201',
   'Tema Uno Test', 'tema-uno-test', 'Tema ficticio publicado.', 1, 1, 1, true),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222201',
   'Tema Dos Test', 'tema-dos-test', 'Tema ficticio publicado.', 1, 2, 2, true),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222201',
   'Tema Tres Test (borrador)', 'tema-tres-test-borrador',
   'SIN PUBLICAR a proposito: es el que prueba el filtro published.', 1, 3, 3, false),

  -- Espanol Test — grado 1
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222202',
   'Tema Cuatro Test', 'tema-cuatro-test', 'Tema ficticio publicado.', 1, 1, 1, true),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222202',
   'Tema Cinco Test', 'tema-cinco-test', 'Tema ficticio publicado.', 1, 2, 2, true),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222202',
   'Tema Seis Test', 'tema-seis-test', 'Tema ficticio publicado.', 1, 3, 2, true),

  -- Historia Test — grado 2 (el destino del cambio de grado)
  ('33333333-3333-4333-8333-333333333307', '22222222-2222-4222-8222-222222222203',
   'Tema Siete Test', 'tema-siete-test', 'Tema ficticio publicado.', 2, 1, 1, true),
  ('33333333-3333-4333-8333-333333333308', '22222222-2222-4222-8222-222222222203',
   'Tema Ocho Test', 'tema-ocho-test', 'Tema ficticio publicado.', 2, 2, 2, true)
on conflict (id) do nothing;

-- =====================================================================
-- PRIVILEGIOS — 🔴 LO QUE EL REPO NO DECLARA Y PRODUCCION SI TIENE
--
-- Al reconstruir la base de cero, `service_role` y `authenticated` se
-- quedan SIN SELECT/INSERT/UPDATE/DELETE sobre las tablas de `public`:
--
--     permission denied for table subjects (SQLSTATE 42501)
--
-- Los default privileges del stack local conceden a los roles de API
-- solo Dxtm (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), no arwd. En
-- Supabase cloud los GRANT existen —el codigo lleva meses leyendo y
-- escribiendo con SUPABASE_SERVICE_ROLE_KEY, y las policies de RLS para
-- `authenticated` no servirian de nada sin GRANT: sin el, el rol ni
-- siquiera llega a evaluar la policy—, pero NINGUNA migracion los
-- declara.
--
-- Es la misma clase de hueco que 021_subjects_grades_fix.sql: el repo
-- reconstruye el ESQUEMA, no el estado completo de la base. Si algun dia
-- hay que levantar produccion de cero desde supabase/migrations/, esto
-- tambien faltaria.
--
-- 🔴 Se pone en el seed y NO en una migracion nueva a proposito: tocar
-- el historial de migraciones es una decision del dueño del repo, y el
-- seed solo corre en local.
-- =====================================================================

-- service_role: acceso total. Salta RLS por diseño y es el que usan los
-- endpoints con SUPABASE_SERVICE_ROLE_KEY.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- anon y authenticated: acceso a las tablas, con la RLS decidiendo que
-- filas ven. El GRANT es condicion previa para que la policy se evalue.
--
-- 🔴 NO se les concede EXECUTE sobre las funciones. La migracion 033
-- revoca a proposito el EXECUTE de `preview_stats` a estos dos roles
-- (expone conteos de catalogo completo), y un `grant execute on all
-- functions` aqui desharia esa decision en silencio.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- 🔴 RE-APLICA el revoke de 036_learners_rls.sql, que el `grant ... on all
-- tables` de arriba acaba de deshacer.
--
-- Sin esta linea, cualquier usuario autenticado podria hacer UPDATE
-- directo sobre `learners` —cambiarse el grado, el xp o el slot— desde la
-- consola del navegador. La migracion 036 lo revoco por eso mismo; el
-- entorno de pruebas tiene que reproducir ESA realidad, no una mas
-- permisiva, o una prueba de seguridad pasaria en local y fallaria en
-- produccion.
revoke update on public.learners from authenticated;
