-- =====================================================
-- 050 · Actividad del alumno por trigger + cuentas de prueba
-- Pasas.mx · s33 (medición del embudo)
--
-- ⚠️ PENDIENTE DE APLICAR. Va en el SQL Editor JUSTO ANTES del deploy
--    que quita las escrituras de la app (fase 7 del mismo trabajo).
--    · Solo la migración, sin el deploy → la racha se contaría dos veces
--      (la escribe el trigger y también /api/section-read).
--    · Solo el deploy, sin la migración → la actividad sigue congelada.
--
-- ── POR QUÉ UN TRIGGER Y NO LA APP ───────────────────────────────────
-- La causa raíz de que `last_active_at`, `streak_days` y `max_streak_days`
-- lleven congelados desde el 18-ago-2026 01:37 UTC no es que la app dejara
-- de intentarlo: es que dejó de PODER.
--
-- La migración 036 revocó el UPDATE sobre `learners` a `authenticated` y lo
-- devolvió columna por columna:
--     GRANT UPDATE (streak_days, last_active_at, last_level_seen)
-- La 048 añadió `first_session_at`, `activated_at` y `max_streak_days` y NO
-- extendió ese GRANT. Desde entonces, `/api/section-read` —que corre con la
-- clave anónima y el JWT del usuario, o sea como `authenticated`— manda un
-- UPDATE que toca esas columnas nuevas, Postgres lo rechaza entero con
-- 42501 y el código nunca mira el error del `.update()`. Resultado: ni las
-- columnas nuevas ni las viejas se escriben. Mismo motivo por el que
-- `first_session_at` y `activated_at` están vacías en los 32 alumnos.
--
-- Un trigger SECURITY DEFINER no tiene ese problema y además arregla el
-- segundo agujero: `last_active_at` solo la escribía `section-read`, así que
-- un alumno que solo hace quizzes o juega la Horda aparecía inactivo aunque
-- estudiara a diario. La bitácora `progress` sí recibe todos esos eventos.
-- =====================================================

-- ============================================================
-- Actividad del alumno derivada de la bitácora `progress`.
-- Fuente única: trigger AFTER INSERT. La app deja de escribir
-- last_active_at / streak_days / max_streak_days (Fase 7).
-- Días calendario en America/Mexico_City.
-- activated_at = primer topic_completed o horde_wave_cleared.
-- ============================================================

create or replace function public.learner_activity_from_progress()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_dia     date := (new.created_at at time zone 'America/Mexico_City')::date;
  v_last    timestamptz;
  v_streak  integer;
  v_max     integer;
  v_ultimo  date;
  v_nueva   integer;
begin
  if new.learner_id is null then
    return new;
  end if;

  select last_active_at, coalesce(streak_days, 0), coalesce(max_streak_days, 0)
    into v_last, v_streak, v_max
    from learners
   where id = new.learner_id
   for update;

  v_ultimo := (v_last at time zone 'America/Mexico_City')::date;

  v_nueva := case
    when v_ultimo is null            then 1
    when v_dia = v_ultimo            then greatest(v_streak, 1)
    when v_dia = v_ultimo + 1        then v_streak + 1
    when v_dia > v_ultimo + 1        then 1
    else v_streak                    -- evento con fecha anterior: no mueve la racha
  end;

  update learners l
     set last_active_at   = greatest(coalesce(l.last_active_at, new.created_at), new.created_at),
         first_session_at = coalesce(l.first_session_at, new.created_at),
         activated_at     = case
                              when l.activated_at is null
                               and new.event_type in ('topic_completed', 'horde_wave_cleared')
                              then new.created_at
                              else l.activated_at
                            end,
         streak_days      = v_nueva,
         max_streak_days  = greatest(v_max, v_nueva)::smallint
   where l.id = new.learner_id;

  return new;
end;
$$;

drop trigger if exists trg_progress_learner_activity on public.progress;
create trigger trg_progress_learner_activity
  after insert on public.progress
  for each row execute function public.learner_activity_from_progress();

-- ------------------------------------------------------------
-- Backfill desde la bitácora completa
-- ------------------------------------------------------------
with d as (
  select learner_id, (created_at at time zone 'America/Mexico_City')::date as dia
    from progress
   where learner_id is not null
   group by 1, 2
), g as (
  select learner_id, dia,
         dia - (row_number() over (partition by learner_id order by dia))::int as grp
    from d
), runs as (
  select learner_id, grp, count(*)::int as len, max(dia) as fin
    from g group by 1, 2
), agg as (
  select learner_id,
         max(len) as max_len,
         (array_agg(len order by fin desc))[1] as last_len
    from runs group by 1
), p as (
  select learner_id,
         min(created_at) as first_at,
         max(created_at) as last_at,
         min(created_at) filter (where event_type in ('topic_completed', 'horde_wave_cleared')) as act_at
    from progress
   where learner_id is not null
   group by 1
)
update learners l
   set first_session_at = p.first_at,
       last_active_at   = greatest(coalesce(l.last_active_at, p.last_at), p.last_at),
       activated_at     = p.act_at,
       streak_days      = agg.last_len,
       max_streak_days  = agg.max_len::smallint
  from p
  join agg using (learner_id)
 where l.id = p.learner_id;

-- ------------------------------------------------------------
-- Cuentas de prueba: corrección y regla automática
-- ------------------------------------------------------------
update users
   set is_test = true
 where is_test = false
   and (email ilike 'asdepicasmexico%@gmail.com'
        or email in ('admin@gmail.com', 'test@gmail.com', 'test2@gmail.com', 'pruebados@gmail.com'));

update subscriptions s
   set is_test = true
  from users u
 where u.id = s.user_id
   and u.is_test = true
   and s.is_test = false;

create or replace function public.mark_test_user()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.email ilike 'asdepicasmexico%@gmail.com'
     or new.email in ('admin@gmail.com', 'test@gmail.com', 'test2@gmail.com', 'pruebados@gmail.com') then
    new.is_test := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_mark_test on public.users;
create trigger trg_users_mark_test
  before insert on public.users
  for each row execute function public.mark_test_user();

create or replace function public.inherit_test_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from users where id = new.user_id and is_test) then
    new.is_test := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_inherit_test on public.subscriptions;
create trigger trg_subscriptions_inherit_test
  before insert on public.subscriptions
  for each row execute function public.inherit_test_subscription();
