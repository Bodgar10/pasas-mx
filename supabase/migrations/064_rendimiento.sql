-- =============================================================================
-- 064 — Rendimiento: índices, RLS con initplan y cifras del arcade en una pasada
-- =============================================================================
--
-- Sale de la auditoría de rendimiento del 20-oct-2026 (advisor de Supabase +
-- lectura de las rutas que más se llaman). Nada de esto cambia qué datos ve
-- quién ni qué devuelve una función: solo cuánto cuesta.
--
-- Escala al escribirla: progress ~500 filas, sections ~26k, horde_questions
-- ~19k, quiz_questions ~12.7k. Los índices se crean SIN `concurrently` porque
-- la migración corre en transacción y a este tamaño el bloqueo dura ms.
-- =============================================================================


-- ── 1. Índices para los filtros que más se usan ─────────────────────────────

-- progress: la página del tema, section-read y horde/answer filtran por
-- (learner_id, topic_id, event_type). El único índice por learner_id era
-- (learner_id, created_at) y los demás empiezan por user_id, que el código
-- ya no usa desde el multi-alumno (035).
create index if not exists idx_progress_learner_topic_event
  on public.progress (learner_id, topic_id, event_type, attempt desc);

-- section-read busca "¿ya leyó esta sección?" por metadata->>'section_id'.
-- 🔴 NO es UNIQUE: ya existe un duplicado histórico y la ruta no maneja 23505.
create index if not exists idx_progress_section_read
  on public.progress (learner_id, (metadata->>'section_id'))
  where event_type = 'section_read';

-- FKs con ON DELETE SET NULL: sin índice, borrar preguntas de un quiz (admin
-- regenera ~10 por temática) recorría progress entera una vez por pregunta.
create index if not exists idx_progress_question
  on public.progress (question_id) where question_id is not null;
create index if not exists idx_progress_topic
  on public.progress (topic_id);

-- quiz_questions: la consulta más llamada de la base (12.7k veces) filtra por
-- topic_id + theme_id y solo había índice por theme_id, que distingue poco.
create index if not exists idx_quiz_questions_topic_theme
  on public.quiz_questions (topic_id, theme_id, created_at, id);

-- sections.user_id: FK con cascade al borrar un usuario. Solo las
-- personalizadas lo llenan; las base (user_id null) quedan fuera del índice.
create index if not exists idx_sections_user
  on public.sections (user_id) where user_id is not null;

-- topics: catálogo filtrado por materia + grado + orden.
create index if not exists idx_topics_subject_grade
  on public.topics (subject_id, grade, display_order) where published;

-- topic_progress: admin y métricas cuentan completados por tema; la PK
-- empieza por learner_id y no sirve para ese filtro.
create index if not exists idx_topic_progress_topic
  on public.topic_progress (topic_id);

create index if not exists idx_diagnostic_questions_topic
  on public.diagnostic_questions (topic_id);

-- subscriptions: el webhook de Stripe busca ~9 veces por provider_sub_id.
-- UNIQUE además evita filas duplicadas si Stripe reintenta el alta
-- (verificado: hoy no hay duplicados).
create unique index if not exists uq_subscriptions_provider_sub
  on public.subscriptions (provider_sub_id) where provider_sub_id is not null;
create index if not exists idx_subscriptions_customer
  on public.subscriptions (provider_customer_id) where provider_customer_id is not null;

-- arcade_suscriptores: el límite de intentos del alta pública cuenta por
-- anon_id y por IP en una ventana de tiempo; el cron filtra por fecha de envío.
create index if not exists idx_arcade_susc_anon
  on public.arcade_suscriptores (anon_id, created_at);
create index if not exists idx_arcade_susc_ip
  on public.arcade_suscriptores (consentimiento_ip, created_at);
create index if not exists idx_arcade_susc_envio
  on public.arcade_suscriptores (ultimo_envio_fecha) where estado = 'confirmado';


-- ── 2. RLS: auth.uid() evaluado una vez por consulta, no una vez por fila ───
--
-- `auth.uid() = user_id` llama a la función en CADA fila. Envuelto en
-- `(select auth.uid())` Postgres lo saca a un InitPlan y lo evalúa una sola
-- vez. Lo mismo vuelve no-correlacionado el EXISTS de las políticas admin.
-- La semántica es idéntica (advisor `auth_rls_initplan`, 57 avisos).
--
-- Se hace con un DO sobre pg_policies para no reescribir a mano 57 políticas
-- (y no equivocarse en una). El guard evita envolver dos veces si se re-corre.

do $$
declare
  p record;
  nuevo_qual text;
  nuevo_check text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
  loop
    nuevo_qual  := p.qual;
    nuevo_check := p.with_check;

    if nuevo_qual is not null and nuevo_qual !~* 'select auth\.uid\(\)' then
      nuevo_qual := replace(nuevo_qual, 'auth.uid()', '(select auth.uid())');
    end if;
    if nuevo_check is not null and nuevo_check !~* 'select auth\.uid\(\)' then
      nuevo_check := replace(nuevo_check, 'auth.uid()', '(select auth.uid())');
    end if;

    if nuevo_qual is distinct from p.qual or nuevo_check is distinct from p.with_check then
      sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if nuevo_qual is not null then
        sql := sql || format(' using (%s)', nuevo_qual);
      end if;
      if nuevo_check is not null then
        sql := sql || format(' with check (%s)', nuevo_check);
      end if;
      execute sql;
    end if;
  end loop;
end $$;

-- "lgc: select own" hacía un EXISTS correlacionado por cada fila. Misma regla
-- (el alumno es de mi cuenta), pero el conjunto de mis alumnos se calcula una vez.
alter policy "lgc: select own" on public.learner_grade_changes
  using (
    learner_id in (
      select l.id from public.learners l
      where l.account_user_id = (select auth.uid())
    )
  );


-- ── 3. Cifras del arcade en UNA pasada ──────────────────────────────────────
--
-- Antes: un scan principal + 5 LEFT JOIN (uno por ronda) + 6 count(*)
-- correlacionados para la distribución = 12 lecturas de las partidas del día
-- en CADA partida registrada (O(N²) en un día viral). Ahora un solo scan con
-- agregados filtrados. Mismo JSON: per_round sigue saliendo [null×5] en un día
-- sin partidas y dist [0×6].

create or replace function public.arcade_cifras(p_date date)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'players',   count(*),
    'avg',       round(avg(score)::numeric, 2),
    'per_round', jsonb_build_array(
      round(100.0 * avg((results[1])::int)),
      round(100.0 * avg((results[2])::int)),
      round(100.0 * avg((results[3])::int)),
      round(100.0 * avg((results[4])::int)),
      round(100.0 * avg((results[5])::int))
    ),
    'dist', jsonb_build_array(
      count(*) filter (where score = 0),
      count(*) filter (where score = 1),
      count(*) filter (where score = 2),
      count(*) filter (where score = 3),
      count(*) filter (where score = 4),
      count(*) filter (where score = 5)
    )
  )
  from public.arcade_plays
  where challenge_date = p_date;
$function$;

create or replace function public.arcade_vom_cifras(p_date date)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'players',   count(*),
    'avg',       round(avg(score)::numeric, 2),
    'per_round', jsonb_build_array(
      round(100.0 * avg((results[1])::int)),
      round(100.0 * avg((results[2])::int)),
      round(100.0 * avg((results[3])::int)),
      round(100.0 * avg((results[4])::int)),
      round(100.0 * avg((results[5])::int))
    ),
    'dist', jsonb_build_array(
      count(*) filter (where score = 0),
      count(*) filter (where score = 1),
      count(*) filter (where score = 2),
      count(*) filter (where score = 3),
      count(*) filter (where score = 4),
      count(*) filter (where score = 5)
    )
  )
  from public.arcade_vom_plays
  where challenge_date = p_date;
$function$;
