-- ============================================================
-- 056 · Reto diario por materia
--
-- Calendario (día de la semana en la Ciudad de México):
--   lun historia · mar biologia · mié geografia · jue ciencias
--   vie espanol  · sáb papas (mixto) · dom historia
--
-- - La materia de una ronda sale de su tema (subjects.slug), con
--   arcade_materia_de_slug(). No hace falta columna en arcade_rounds.
-- - arcade_challenges.materia guarda la materia que DE VERDAD se usó ese
--   día: si la del calendario no tiene 5 rondas disponibles, el reto cae a
--   historia para no salir nunca vacío.
-- - 'papas': una ronda de cada materia, solo dificultad 1 y 2.
-- - INCLUYE la calibración de la 054 (mezcla 2-2-1 y la difícil en la
--   posición 4). La 054 quedó vacía a propósito: esta la reemplaza.
-- - Los retos FUTUROS ya armados (todos de historia) se borran y se vuelven
--   a armar con el calendario nuevo. El de hoy no se toca.
-- ============================================================

alter table public.arcade_challenges
  add column if not exists materia text not null default 'historia'
  check (materia in ('historia', 'biologia', 'geografia', 'ciencias', 'espanol', 'papas'));

create or replace function public.arcade_materia_de_slug(p_slug text)
returns text
language sql immutable
set search_path to ''
as $$
  select case
    when p_slug like 'historia-%' then 'historia'
    when p_slug like 'biologia-%' or p_slug in ('temas-selectos-biologia', 'ecologia-medio-ambiente') then 'biologia'
    when p_slug = 'geografia' or p_slug like 'geografia-%' then 'geografia'
    when p_slug like 'quimica-%' or p_slug like 'fisica-%'
      or p_slug in ('temas-selectos-quimica', 'temas-selectos-fisica') then 'ciencias'
    when p_slug like 'espanol-%' or p_slug like 'lengua-comunicacion-%' or p_slug like 'literatura-%' then 'espanol'
    else null
  end
$$;

create or replace function public.arcade_materia_del_dia(p_date date)
returns text
language sql immutable
set search_path to ''
as $$
  select case extract(isodow from p_date)::int
    when 1 then 'historia'
    when 2 then 'biologia'
    when 3 then 'geografia'
    when 4 then 'ciencias'
    when 5 then 'espanol'
    when 6 then 'papas'
    else 'historia'
  end
$$;

create or replace function public.arcade_armar_reto(p_date date)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ids     uuid[];
  v_window  int;
  v_materia text;
  v_intento text;
begin
  if exists (select 1 from public.arcade_challenges where challenge_date = p_date) then
    return true;
  end if;

  v_materia := public.arcade_materia_del_dia(p_date);

  -- Primero la materia del calendario; si no alcanza, historia.
  foreach v_intento in array array[v_materia, 'historia'] loop
    foreach v_window in array array[180, 30, 0] loop
      with usadas as (
        select unnest(c.round_ids) as id
          from public.arcade_challenges c
         where v_window > 0
           and c.challenge_date between p_date - v_window and p_date + v_window
      ), temas_ayer as (
        select r.topic_id
          from public.arcade_challenges c
          join public.arcade_rounds r on r.id = any (c.round_ids)
         where c.challenge_date = p_date - 1
      ), banco as (
        select r.id, r.topic_id, r.difficulty, public.arcade_materia_de_slug(s.slug) as materia
          from public.arcade_rounds r
          join public.topics t   on t.id = r.topic_id
          join public.subjects s on s.id = t.subject_id
         where r.status = 'aprobada'
           and r.id not in (select id from usadas)
      ), candidatas as (
        select distinct on (topic_id) id, topic_id, difficulty, materia
          from banco
         where (v_intento = 'papas' and materia is not null and difficulty <= 2)
            or (v_intento <> 'papas' and materia = v_intento)
         order by topic_id, random()
      ), rankeadas as (
        select id, difficulty, materia,
               row_number() over (
                 partition by case when v_intento = 'papas' then materia else difficulty::text end
                 order by (topic_id in (select topic_id from temas_ayer)), random()
               ) as rn
          from candidatas
      ), elegidas as (
        select id, difficulty
          from rankeadas
         order by case
                    -- papas: una por materia primero.
                    when v_intento = 'papas' and rn = 1 then 0
                    -- resto: 2 fáciles, 2 medias, 1 difícil (054).
                    when v_intento <> 'papas' and (
                         (difficulty = 1 and rn <= 2)
                      or (difficulty = 2 and rn <= 2)
                      or (difficulty = 3 and rn <= 1)) then 0
                    else 1
                  end,
                  rn,
                  random()
         limit 5
      ), ordenadas as (
        select id, row_number() over (order by difficulty, random()) as pos
          from elegidas
      )
      select array_agg(id order by case pos when 4 then 5 when 5 then 4 else pos end)
        into v_ids
        from ordenadas;

      exit when coalesce(array_length(v_ids, 1), 0) = 5;
    end loop;

    if coalesce(array_length(v_ids, 1), 0) = 5 then
      insert into public.arcade_challenges (challenge_date, number, round_ids, materia)
      values (p_date, p_date - date '2026-09-28', v_ids, v_intento)
      on conflict (challenge_date) do nothing;
      return true;
    end if;
  end loop;

  return false;
end;
$function$;

create or replace function public.arcade_reto()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoy date := public.arcade_hoy();
  v_c   public.arcade_challenges;
begin
  perform public.arcade_armar_reto(v_hoy);

  select * into v_c
    from public.arcade_challenges
   where challenge_date <= v_hoy
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

revoke all on function public.arcade_armar_reto(date) from public, anon, authenticated;
grant execute on function public.arcade_armar_reto(date) to service_role;
revoke all on function public.arcade_reto() from public, anon, authenticated;
grant execute on function public.arcade_reto() to service_role;

-- Retos futuros: se rearman con el calendario nuevo (hoy no se toca).
delete from public.arcade_challenges
 where challenge_date > public.arcade_hoy()
   and not exists (select 1 from public.arcade_plays p where p.challenge_date = arcade_challenges.challenge_date);

select public.arcade_llenar_calendario(14);
