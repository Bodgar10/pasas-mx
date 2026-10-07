-- ============================================================
-- 060 · s39
-- Reto por materia: /arcade?materia=historia sirve el reto de Historia más
-- reciente (hoy o días anteriores) para que un anuncio de una materia lleve
-- a jugar ESA materia, aunque hoy toque otra. Al terminar, la página invita
-- a jugar el reto de hoy.
--
-- 1. arcade_reto_materia(p_materia): mismo JSON que arcade_reto(), pero del
--    último reto de esa materia con fecha <= hoy. No arma retos nuevos.
-- 2. arcade_registrar acepta partidas de los últimos 7 días (antes: hoy y
--    ayer). Cada materia sale al menos una vez por semana, así que el reto
--    "más reciente" de cualquiera tiene como mucho 7 días.
--
-- Sin DROP: CREATE OR REPLACE con la misma firma de arcade_registrar.
-- ============================================================

create or replace function public.arcade_reto_materia(p_materia text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoy date := public.arcade_hoy();
  v_c   public.arcade_challenges;
begin
  if p_materia not in ('historia', 'biologia', 'geografia', 'ciencias', 'espanol', 'papas') then
    return null;
  end if;

  select * into v_c
    from public.arcade_challenges
   where materia = p_materia
     and challenge_date <= v_hoy
     and challenge_date >= v_hoy - 7
   order by challenge_date desc
   limit 1;

  if v_c is null then
    return null;
  end if;

  return jsonb_build_object(
    'date',    v_c.challenge_date,
    'number',  v_c.number,
    'materia', v_c.materia,
    'rounds', (
      select jsonb_agg(jsonb_build_object(
               'id',           r.id,
               'options',      to_jsonb(r.options),
               'odd',          r.odd_index,
               'explanation',  r.explanation,
               'kind',         r.kind,
               'topic',        t.name,
               'topic_slug',   t.slug,
               'subject_slug', s.slug,
               'materia',      public.arcade_materia_de_slug(s.slug),
               'horde_ready',  t.horde_ready and t.published
             ) order by u.ord)
        from unnest(v_c.round_ids) with ordinality as u(id, ord)
        join public.arcade_rounds r on r.id = u.id
        join public.topics t        on t.id = r.topic_id
        join public.subjects s      on s.id = t.subject_id
    )
  );
end;
$function$;

revoke all on function public.arcade_reto_materia(text) from public, anon, authenticated;
grant execute on function public.arcade_reto_materia(text) to service_role;

create or replace function public.arcade_registrar(
  p_date date, p_anon_id text, p_picks smallint[],
  p_origen text default null, p_canal text default null,
  p_utm_source text default null, p_utm_campaign text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoy     date := public.arcade_hoy();
  v_results boolean[];
  v_origen  text := case when p_origen in ('landing_banner', 'resultado_compartido', 'arcade', 'directo')
                         then p_origen end;
  v_canal   text := case when p_canal in ('instagram', 'tiktok', 'facebook', 'whatsapp', 'google', 'email', 'directo', 'otro')
                         then p_canal end;
begin
  -- s39: 7 días hacia atrás (antes hoy y ayer) por el reto por materia.
  if p_date > v_hoy or p_date < v_hoy - 7
     or coalesce(array_length(p_picks, 1), 0) <> 5
     or not (p_picks <@ array[0, 1, 2, 3]::smallint[])
     or length(coalesce(p_anon_id, '')) not between 8 and 64 then
    return null;
  end if;

  select array_agg(p_picks[u.ord::int] = r.odd_index order by u.ord)
    into v_results
    from public.arcade_challenges c
    cross join lateral unnest(c.round_ids) with ordinality as u(id, ord)
    join public.arcade_rounds r on r.id = u.id
   where c.challenge_date = p_date;

  if v_results is null then
    return null;
  end if;

  insert into public.arcade_plays
    (challenge_date, anon_id, results, picks, score, origen, canal, utm_source, utm_campaign)
  values (
    p_date, p_anon_id, v_results, p_picks,
    (select count(*) from unnest(v_results) as x where x),
    v_origen, v_canal,
    left(nullif(trim(p_utm_source), ''), 64),
    left(nullif(trim(p_utm_campaign), ''), 64)
  )
  on conflict (challenge_date, anon_id) do nothing;

  return public.arcade_cifras(p_date);
end;
$function$;
