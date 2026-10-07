-- ============================================================
-- 059 · s37
-- Conteo anónimo del embudo previo a la cuenta (lib/analytics/conteo.ts).
--
-- Por qué existe: PostHog solo ve a quien acepta el aviso de cookies, y del
-- tráfico de anuncios lo acepta menos del 1%. Esta tabla cuenta a TODOS
-- sin identificar a nadie:
--
--  - Sin id de persona, sesión ni dispositivo: da totales por paso, no
--    recorridos. Dos filas de la misma persona no se pueden unir.
--  - Sin IP ni user agent: la ruta /api/m solo guarda "celular/computadora"
--    y el navegador de app (instagram/tiktok/facebook/otro).
--  - `props` solo trae claves de una lista blanca, limpiada en el servidor.
--
-- Se escribe solo desde /api/m con service_role, y solo en producción.
-- RLS activo sin políticas: el navegador nunca lee ni escribe aquí.
-- `interno = true` es tráfico propio (?interno=1): filtrarlo al analizar.
-- ============================================================

create table if not exists public.eventos_anonimos (
  id             bigint generated always as identity primary key,
  creado         timestamptz not null default now(),
  evento         text not null check (char_length(evento) <= 40),
  ruta           text check (char_length(ruta) <= 120),
  canal          text,
  utm_source     text check (char_length(utm_source) <= 64),
  utm_campaign   text check (char_length(utm_campaign) <= 64),
  dispositivo    text check (dispositivo in ('celular', 'computadora')),
  navegador_app  text check (navegador_app in ('instagram', 'tiktok', 'facebook', 'otro')),
  carga          text check (carga in ('<1s', '1-3s', '3-5s', '>5s')),
  interno        boolean not null default false,
  props          jsonb not null default '{}'::jsonb
);

comment on table public.eventos_anonimos is
  'Conteo anónimo del embudo (s37). Sin id, IP ni user agent: solo totales por paso. Lo escribe /api/m. Filtrar interno = false al analizar.';

create index if not exists eventos_anonimos_creado_idx
  on public.eventos_anonimos (creado);

create index if not exists eventos_anonimos_evento_creado_idx
  on public.eventos_anonimos (evento, creado);

alter table public.eventos_anonimos enable row level security;
revoke all on table public.eventos_anonimos from anon, authenticated;
