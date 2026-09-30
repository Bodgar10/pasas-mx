-- ============================================================
-- 053 · s34-F2
-- Atribución del reto y de la Horda pública: canal + UTMs.
-- canal = primer contacto externo. origen = entrada dentro del producto.
-- Las funciones son SECURITY DEFINER y SOLO service_role las ejecuta:
-- al recrearlas se reponen exactamente esos permisos.
--
-- Se aplica ANTES del deploy de s34-F2. El código nuevo además reintenta
-- con la firma vieja si la nueva todavía no existe (arcade-server.ts y
-- horda-publica-server.ts), así que el orden no rompe partidas.
-- ============================================================

alter table public.arcade_plays
  add column if not exists canal        text,
  add column if not exists utm_source   text,
  add column if not exists utm_campaign text;

alter table public.horda_publica_avance
  add column if not exists canal        text,
  add column if not exists utm_source   text,
  add column if not exists utm_campaign text;

drop function if exists public.arcade_registrar(date, text, smallint[], text);

create function public.arcade_registrar(
  p_date         date,
  p_anon_id      text,
  p_picks        smallint[],
  p_origen       text default null,
  p_canal        text default null,
  p_utm_source   text default null,
  p_utm_campaign text default null
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
  if p_date not in (v_hoy, v_hoy - 1)
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

revoke all on function public.arcade_registrar(date, text, smallint[], text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.arcade_registrar(date, text, smallint[], text, text, text, text)
  to service_role;

drop function if exists public.horda_publica_registrar(text, uuid, text, integer, text, text);

create function public.horda_publica_registrar(
  p_anon_id      text,
  p_topic_id     uuid,
  p_evento       text,
  p_oleada       integer default null,
  p_eleccion     text    default null,
  p_origen       text    default null,
  p_canal        text    default null,
  p_utm_source   text    default null,
  p_utm_campaign text    default null
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_origen text := case when p_origen in ('landing_banner', 'resultado_compartido', 'arcade', 'directo')
                        then p_origen end;
  v_canal  text := case when p_canal in ('instagram', 'tiktok', 'facebook', 'whatsapp', 'google', 'email', 'directo', 'otro')
                        then p_canal end;
  v_src    text := left(nullif(trim(p_utm_source), ''), 64);
  v_camp   text := left(nullif(trim(p_utm_campaign), ''), 64);
begin
  if length(coalesce(p_anon_id, '')) not between 8 and 64
     or p_evento not in ('inicio', 'oleada', 'eleccion')
     or (p_evento = 'oleada' and (p_oleada is null or p_oleada not between 1 and 3))
     or (p_evento = 'eleccion' and p_eleccion not in ('estudiante', 'adulto')) then
    return false;
  end if;

  insert into public.horda_publica_avance as a
    (anon_id, topic_id, partidas, oleada_max, llego_muro, eleccion, origen, canal, utm_source, utm_campaign)
  values (
    p_anon_id, p_topic_id,
    case when p_evento = 'inicio' then 1 else 0 end,
    case when p_evento = 'oleada' then p_oleada else 0 end,
    p_evento = 'oleada' and p_oleada >= 3,
    case when p_evento = 'eleccion' then p_eleccion end,
    v_origen, v_canal, v_src, v_camp
  )
  on conflict (anon_id, topic_id) do update
     set partidas     = a.partidas + case when p_evento = 'inicio' then 1 else 0 end,
         oleada_max   = greatest(a.oleada_max, case when p_evento = 'oleada' then p_oleada else 0 end),
         llego_muro   = a.llego_muro or (p_evento = 'oleada' and p_oleada >= 3),
         eleccion     = coalesce(case when p_evento = 'eleccion' then p_eleccion end, a.eleccion),
         origen       = coalesce(a.origen, v_origen),
         canal        = coalesce(a.canal, v_canal),
         utm_source   = coalesce(a.utm_source, v_src),
         utm_campaign = coalesce(a.utm_campaign, v_camp),
         updated_at   = now();

  return true;
end;
$function$;

revoke all on function public.horda_publica_registrar(text, uuid, text, integer, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.horda_publica_registrar(text, uuid, text, integer, text, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
