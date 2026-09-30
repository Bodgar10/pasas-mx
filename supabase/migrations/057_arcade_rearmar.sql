-- ============================================================
-- 057 · Rearmar el calendario cuando llega una materia nueva
--
-- Los retos se arman con anticipación. Un martes armado hoy sin rondas de
-- biología cae a historia (056) y se quedaría así aunque mañana se carguen
-- 300 rondas de biología. Esta función borra los días FUTUROS, sin
-- partidas, cuya materia no coincide con el calendario, y los vuelve a
-- armar. Se corre después de cargar las rondas de una materia:
--   select arcade_rearmar_calendario(14);
-- Devuelve cuántos días quedaron con reto.
-- ============================================================

create or replace function public.arcade_rearmar_calendario(p_dias int default 14)
returns int
language plpgsql
security definer
set search_path to ''
as $function$
begin
  delete from public.arcade_challenges c
   where c.challenge_date > public.arcade_hoy()
     and c.materia <> public.arcade_materia_del_dia(c.challenge_date)
     and not exists (select 1 from public.arcade_plays p where p.challenge_date = c.challenge_date);
  return public.arcade_llenar_calendario(p_dias);
end;
$function$;

revoke all on function public.arcade_rearmar_calendario(int) from public, anon, authenticated;
grant execute on function public.arcade_rearmar_calendario(int) to service_role;
