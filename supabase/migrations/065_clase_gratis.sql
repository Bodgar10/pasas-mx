-- =============================================================================
-- 065 — Clase gratis: UN tema fijo por materia, y la muestra cerrada (s51)
-- =============================================================================
--
-- La landing B ("Toma tu primera clase gratis", 26-oct-2026) deja elegir nivel,
-- grado, materia y hobby, y abre la clase sin cuenta. Regla de Bodgar:
--
--   🔴 CADA MATERIA TIENE UNA SOLA CLASE GRATIS, Y SIEMPRE ES LA MISMA.
--   Hoy o dentro de 100 días, Matemáticas 3° abre el mismo tema. Elegir la
--   materia otra vez no abre otro tema: así nadie saca el temario completo
--   entrando gratis una y otra vez.
--
-- Cada materia (subjects) es de un solo grado, así que la llave es la materia.
--
-- Y se cierra el hueco que ya existía: /tema dejaba abrir CUALQUIER tema que
-- hubiera salido alguna vez en el reto (~294) con solo escribir la URL. Ahora
-- solo se abren:
--   1. el tema de clase gratis de su materia, o
--   2. un tema del reto de los últimos 8 días (hoy y 7 atrás). Es la misma
--      ventana que arcade_reto_materia: quien llega por /arcade?materia=X
--      puede jugar un reto de hasta 7 días y luego abrir el tema que falló.
--
-- Todo con service role (la página de /tema). Ni anon ni authenticated
-- pueden leer la tabla ni llamar a las funciones.
-- =============================================================================

create table if not exists public.clase_gratis (
  subject_id uuid primary key references public.subjects (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  -- 'auto' = lo eligió esta migración; 'manual' = lo cambió Bodgar.
  elegido text not null default 'auto' check (elegido in ('auto', 'manual')),
  actualizado timestamptz not null default now()
);

alter table public.clase_gratis enable row level security;
-- Sin políticas: solo service role.

comment on table public.clase_gratis is
  'Clase gratis de la landing B: un tema fijo por materia. Para cambiarlo: update ... set topic_id = <tema>, elegido = ''manual''.';

-- ── Llenado automático ──────────────────────────────────────────────────────
-- El PRIMER tema completo de cada materia en el orden del programa
-- (display_order). "Completo" = publicado, con guía y quiz en las 4 temáticas
-- y al menos un minijuego: lo que la oferta de después del primer minijuego
-- necesita para aparecer. Las materias sin ningún tema así se quedan fuera
-- (y no salen en el formulario).
with tematicas as (
  select id from public.themes
  where active and name in ('Anime & Manga', 'Videojuegos', 'K-pop & K-dramas', 'Fútbol')
),
completos as (
  select t.id, t.subject_id, t.display_order
  from public.topics t
  where t.published
    and (select count(distinct s.theme_id) from public.sections s
          where s.topic_id = t.id and s.user_id is null and s.theme_id in (select id from tematicas)) = 4
    and (select count(distinct q.theme_id) from public.quiz_questions q
          where q.topic_id = t.id and q.theme_id in (select id from tematicas)) = 4
    and exists (select 1 from public.sections s
                 where s.topic_id = t.id and s.user_id is null
                   and s.type in ('sort', 'scrubber', 'steps', 'match', 'solve', 'connect', 'order_steps'))
),
primero as (
  select distinct on (subject_id) subject_id, id as topic_id
  from completos
  order by subject_id, display_order, id
)
insert into public.clase_gratis (subject_id, topic_id)
select subject_id, topic_id from primero
on conflict (subject_id) do nothing;

-- ── ¿Se puede abrir este tema sin cuenta? ───────────────────────────────────
create or replace function public.tema_muestra_permitido(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.clase_gratis where topic_id = p_topic_id)
    or exists (
      select 1
      from public.arcade_challenges c
      join public.arcade_rounds r on r.id = any (c.round_ids)
      where c.challenge_date between public.arcade_hoy() - 7 and public.arcade_hoy()
        and r.topic_id = p_topic_id
    )
    or exists (
      select 1
      from public.arcade_vom_challenges c
      join public.arcade_vom_rounds r on r.id = any (c.round_ids)
      where c.challenge_date between public.arcade_hoy() - 7 and public.arcade_hoy()
        and r.topic_id = p_topic_id
    );
$$;

-- ── Catálogo del formulario de la landing B ─────────────────────────────────
-- Una fila por materia con clase gratis: nivel, grado, nombre y el tema.
create or replace function public.clase_gratis_catalogo()
returns table (
  education_level text,
  grade int,
  subject_slug text,
  subject_name text,
  subject_order int,
  topic_slug text,
  topic_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.education_level::text, coalesce(t.grade, s.grades[1])::int, s.slug, s.name,
         coalesce(s.display_order, 0)::int, t.slug, t.name
  from public.clase_gratis cg
  join public.subjects s on s.id = cg.subject_id
  join public.topics t on t.id = cg.topic_id
  where t.published
  order by 1, 2, 5, 4;
$$;

revoke all on function public.tema_muestra_permitido(uuid) from public, anon, authenticated;
revoke all on function public.clase_gratis_catalogo() from public, anon, authenticated;
grant execute on function public.tema_muestra_permitido(uuid) to service_role;
grant execute on function public.clase_gratis_catalogo() to service_role;
