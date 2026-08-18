-- =====================================================
-- 045 · Marcar cuentas y suscripciones de prueba
-- Pasas.mx · s32
--
-- ⚠️ APLICADA A MANO en el SQL Editor de Supabase el 17-ago-2026.
--    Este archivo existe para que el repo refleje el estado real de
--    la base. Todo es idempotente: volver a correrlo no rompe nada.
-- =====================================================

alter table users
  add column if not exists is_test boolean not null default false;

comment on column users.is_test is
  'Cuenta interna de pruebas. Toda métrica del admin filtra is_test = false por defecto.';

-- Marcado explícito por lista, no por patrón:
-- un patrón vuelve a fallar en cuanto entre un correo real con "+".
update users
set is_test = true
where email in (
  'test@gmail.com',
  'test2@gmail.com',
  'pruebados@gmail.com',
  'admin@gmail.com'
)
or email like 'asdepicasmexico%@gmail.com';

alter table subscriptions
  add column if not exists is_test boolean not null default false;

comment on column subscriptions.is_test is
  'Suscripción creada contra Stripe sandbox o perteneciente a una cuenta de prueba.
   Corte: todo lo anterior al 13-ago-2026 se creó cuando el proyecto apuntaba a sandbox.';

update subscriptions s
set is_test = true
where s.created_at < timestamptz '2026-08-13 00:00:00+00'
   or exists (
     select 1 from users u
     where u.id = s.user_id and u.is_test
   );

create index if not exists idx_users_is_test_false
  on users (created_at) where not is_test;

create index if not exists idx_subscriptions_is_test_false
  on subscriptions (status) where not is_test;
