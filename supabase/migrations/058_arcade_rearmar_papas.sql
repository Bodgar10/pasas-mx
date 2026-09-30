-- ============================================================
-- 058 · El reto para papás también se rearma con cada materia nueva
--
-- arcade_rearmar_calendario (057) solo borraba los días cuya materia no
-- coincidía con el calendario. Un sábado siempre coincide ('papas'), así que
-- se quedaba con las materias que había cuando se armó. Ahora los sábados
-- futuros sin partidas también se rearman, para mezclar la materia recién
-- cargada.
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
     and (c.materia <> public.arcade_materia_del_dia(c.challenge_date) or c.materia = 'papas')
     and not exists (select 1 from public.arcade_plays p where p.challenge_date = c.challenge_date);
  return public.arcade_llenar_calendario(p_dias);
end;
$function$;

revoke all on function public.arcade_rearmar_calendario(int) from public, anon, authenticated;
grant execute on function public.arcade_rearmar_calendario(int) to service_role;

select public.arcade_rearmar_calendario(14);
