-- ============================================================
-- 054 · s34-F4
-- Calibración del reto diario.
-- Mezcla objetivo: 2 de dificultad 1, 2 de dificultad 2, 1 de dificultad 3
-- (si falta alguna, se completa con lo que haya).
-- Orden: ascendente, pero la más difícil va en la posición 4
-- y el reto cierra con la segunda más difícil.
-- Los retos futuros ya armados SOLO se reordenan (4 <-> 5).
--
-- Solo toca la base: no necesita deploy. El video de la mañana usa la
-- ronda 1, que no cambia.
--
-- Verificación (antes y después de aplicarla):
--   select c.challenge_date, c.number, array_agg(r.difficulty order by u.ord) as dificultades
--     from arcade_challenges c
--     cross join lateral unnest(c.round_ids) with ordinality u(id, ord)
--     join arcade_rounds r on r.id = u.id
--    where c.challenge_date > arcade_hoy()
--    group by 1, 2 order by 1;
-- ============================================================

create or replace function public.arcade_armar_reto(p_date date)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ids    uuid[];
  v_window int;
begin
  if exists (select 1 from public.arcade_challenges where challenge_date = p_date) then
    return true;
  end if;

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
    ), candidatas as (
      select distinct on (r.topic_id) r.id, r.topic_id, r.difficulty
        from public.arcade_rounds r
       where r.status = 'aprobada'
         and r.id not in (select id from usadas)
       order by r.topic_id, random()
    ), rankeadas as (
      select id, difficulty,
             row_number() over (
               partition by difficulty
               order by (topic_id in (select topic_id from temas_ayer)), random()
             ) as rn
        from candidatas
    ), elegidas as (
      select id, difficulty
        from rankeadas
       order by case
                  when (difficulty = 1 and rn <= 2)
                    or (difficulty = 2 and rn <= 2)
                    or (difficulty = 3 and rn <= 1) then 0
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

  if coalesce(array_length(v_ids, 1), 0) < 5 then
    return false;
  end if;

  insert into public.arcade_challenges (challenge_date, number, round_ids)
  values (p_date, p_date - date '2026-09-28', v_ids)
  on conflict (challenge_date) do nothing;

  return true;
end;
$function$;

revoke all on function public.arcade_armar_reto(date) from public, anon, authenticated;
grant execute on function public.arcade_armar_reto(date) to service_role;

-- Retos futuros ya armados: mismas preguntas, se intercambian la 4 y la 5.
update public.arcade_challenges
   set round_ids = round_ids[1:3] || round_ids[5:5] || round_ids[4:4]
 where challenge_date > public.arcade_hoy()
   and array_length(round_ids, 1) = 5;
