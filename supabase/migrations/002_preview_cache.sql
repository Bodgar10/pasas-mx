-- =============================================================================
-- 002_preview_cache.sql
-- =============================================================================
-- Adds the preview_cache table to store AI-generated personalized previews.
-- Prevents repeated API calls for the same user+subject+theme combination.
-- Enforces a daily generation limit of 3 per user per subject.
-- =============================================================================

create table public.preview_cache (
  user_id      uuid        not null references public.users(id) on delete cascade,
  subject      text        not null,
  theme        text        not null,
  result_json  jsonb       not null,
  diagnostico  text        not null,
  daily_count  integer     not null default 1 check (daily_count >= 0),
  last_reset   date        not null default now()::date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, subject, theme)
);

comment on table public.preview_cache is
  'Caches AI-generated personalized previews per user+subject+theme. Tracks daily generation count with midnight reset.';

-- Index for fast lookup by user
create index idx_preview_cache_user on public.preview_cache (user_id);

-- RLS
alter table public.preview_cache enable row level security;

create policy "preview_cache: select own"
  on public.preview_cache for select
  using (auth.uid() = user_id);

create policy "preview_cache: insert own"
  on public.preview_cache for insert
  with check (auth.uid() = user_id);

create policy "preview_cache: update own"
  on public.preview_cache for update
  using (auth.uid() = user_id);

create policy "preview_cache: delete own"
  on public.preview_cache for delete
  using (auth.uid() = user_id);
