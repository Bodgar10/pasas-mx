-- ============================================================
-- 055 · s34-F5
-- Suscriptores al recordatorio del reto diario.
-- Doble opt-in. Solo mayores de edad. Sin acceso desde el cliente:
-- RLS activo sin políticas; todo pasa por rutas de servidor con service_role.
-- Los tokens los genera la app (crypto), no la base.
--
-- Se puede aplicar cuando sea: el código queda apagado detrás de
-- NEXT_PUBLIC_ENABLE_ARCADE_RECORDATORIO y no toca la tabla mientras esté
-- en false. NO encender el flag hasta que el aviso de privacidad incluya
-- esta finalidad.
-- ============================================================

create table if not exists public.arcade_suscriptores (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente', 'confirmado', 'baja')),
  token_confirmacion  text not null unique,
  token_baja          text not null unique,
  mayor_de_edad       boolean not null check (mayor_de_edad),
  aviso_version       text not null,
  consentimiento_ip   text,
  anon_id             text,
  canal               text,
  created_at          timestamptz not null default now(),
  confirmado_at       timestamptz,
  baja_at             timestamptz,
  ultimo_envio_fecha  date
);

create unique index if not exists arcade_suscriptores_email_uq
  on public.arcade_suscriptores (lower(email));

alter table public.arcade_suscriptores enable row level security;
revoke all on table public.arcade_suscriptores from anon, authenticated;
