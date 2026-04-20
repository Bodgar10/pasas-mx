-- =============================================================================
-- NivelUp — Initial Schema Migration
-- =============================================================================
-- This migration creates the full database schema for NivelUp, a Mexican
-- educational platform that adapts academic content to each student's interests
-- using AI-generated themes.
--
-- Conventions used throughout:
--   • All PKs are UUIDs generated with gen_random_uuid().
--   • All timestamps are timestamptz (UTC stored, displayed in local time).
--   • The public.users table mirrors auth.users and extends it with app data.
--   • Row Level Security (RLS) is enabled on every table. No table is left open.
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- pgcrypto provides gen_random_uuid() used as the default PK generator.
create extension if not exists "pgcrypto";


-- =============================================================================
-- ENUMS
-- =============================================================================

-- plan_type — the three subscription tiers offered on NivelUp.
--   exam            → one-time exam prep for a specific subject
--   grade           → full grade access (all subjects for one school year)
--   ai_personalized → top tier with AI-generated personalized content
create type plan_type as enum ('exam', 'grade', 'ai_personalized');

-- subscription_status — mirrors Stripe / Conekta lifecycle states so we can
-- gate features without hitting the payment provider on every request.
create type subscription_status as enum (
  'trialing',   -- free trial period active
  'active',     -- paid and current
  'past_due',   -- payment failed, grace period
  'paused',     -- user paused billing
  'cancelled'   -- subscription ended
);

-- payment_provider — which gateway processed the transaction.
-- Stripe for international cards; Conekta for OXXO Pay and Mexican debit.
create type payment_provider as enum ('stripe', 'conekta');

-- education_level — the two school levels NivelUp targets in Mexico.
create type education_level as enum ('middle_school', 'high_school');

-- user_role — controls access to the admin dashboard and management tools.
create type user_role as enum ('student', 'admin');

-- event_type — every meaningful user action is stored as an immutable event
-- in the progress table. This enum defines all valid event kinds.
create type event_type as enum (
  'topic_started',
  'topic_completed',
  'quiz_answered',
  'quiz_completed',
  'diagnostic_answered',
  'section_read',
  'streak_extended',
  'achievement_unlocked'
);

-- topic_status — the three states a topic can be in for a given student.
create type topic_status as enum ('not_started', 'in_progress', 'completed');

-- diagnostic_type — how the student's initial knowledge was assessed.
--   quiz             → multiple-choice diagnostic
--   free_description → student described their level in plain text (AI-parsed)
create type diagnostic_type as enum ('quiz', 'free_description');

-- section_type — the role a content block plays within a topic.
-- Each type maps to a distinct UI component and writing style.
create type section_type as enum (
  'explanation',  -- core concept explained clearly
  'analogy',      -- concept linked to the student's interest theme
  'example',      -- worked example with the interest theme as context
  'key_fact',     -- short memorable highlight
  'tip'           -- study or exam strategy
);


-- =============================================================================
-- TABLE: public.users
-- =============================================================================
-- Extends auth.users. Created automatically via trigger handle_new_user when
-- a new user signs up through Supabase Auth. Stores all app-level profile data
-- that does not belong in the auth schema (XP, streaks, onboarding state, etc.).
--
-- Why mirror auth.users instead of using it directly?
--   Supabase auth.users is in a restricted schema. Joining it in queries,
--   applying RLS policies, and adding custom columns are all simpler when the
--   app owns its own users table in the public schema.
create table public.users (
  -- Same UUID as auth.users so JOINs are zero-cost and auth.uid() works directly.
  id                uuid          primary key references auth.users(id) on delete cascade,
  email             text          not null,
  full_name         text,
  role              user_role     not null default 'student',
  education_level   education_level,
  -- Grade within the education level: 1, 2, or 3 (e.g. 1st year of high school).
  grade             integer       check (grade between 1 and 3),
  -- Free-form interest tags collected during onboarding (e.g. {"K-pop","Gaming"}).
  interests         text[],
  xp_total          integer       not null default 0 check (xp_total >= 0),
  streak_days       integer       not null default 0 check (streak_days >= 0),
  last_active_at    timestamptz,
  -- Set to true once the student completes the onboarding flow. The middleware
  -- reads this flag from user_metadata and redirects to /onboarding while false.
  onboarding_done   boolean       not null default false,
  avatar_url        text,
  created_at        timestamptz   not null default now()
);

comment on table public.users is
  'App-level user profiles. One row per auth.users entry, created by trigger.';


-- =============================================================================
-- TABLE: public.themes
-- =============================================================================
-- Catalog of interest themes used to personalise content. Each theme represents
-- a cultural or hobbyist context (e.g. "K-pop & K-dramas", "Football") that the
-- AI uses when generating analogies and examples inside sections.
--
-- Themes are pre-created by NivelUp editors. Students pick one per subject
-- during onboarding. Content generation workers reference theme.name when
-- calling the AI to ensure stylistic consistency.
create table public.themes (
  id          uuid          primary key default gen_random_uuid(),
  -- Human-readable label shown in the theme picker (e.g. "Video Games").
  name        text          not null,
  -- Netflix-style short description shown on the theme card UI.
  description text          not null,
  cover_url   text,
  -- Which subscription plans can access this theme.
  plan_types  plan_type[]   not null,
  active      boolean       not null default true,
  created_at  timestamptz   not null default now()
);

comment on table public.themes is
  'Interest themes used by the AI to personalise section content per student.';


-- =============================================================================
-- TABLE: public.subjects
-- =============================================================================
-- Academic subjects offered on the platform (e.g. Matemáticas, Historia).
-- Each subject belongs to one education level and applies to one or more grades.
-- plan_types controls which subscription tiers include this subject.
create table public.subjects (
  id              uuid              primary key default gen_random_uuid(),
  name            text              not null,
  -- URL-safe identifier used in routes (e.g. "matematicas-secundaria").
  slug            text              not null unique,
  education_level education_level   not null,
  -- Array of grades this subject belongs to (e.g. {1,2,3} means all grades).
  grades          integer[]         not null,
  plan_types      plan_type[]       not null,
  icon            text,
  -- Controls the order subjects appear in the subject picker.
  display_order   integer           not null default 0,
  created_at      timestamptz       not null default now()
);

comment on table public.subjects is
  'Academic subjects available on the platform, scoped by education level and grade.';


-- =============================================================================
-- TABLE: public.topics
-- =============================================================================
-- A topic is the atomic learning unit within a subject (e.g. "Pythagorean
-- Theorem", "Mexican Independence"). Students complete topics to earn XP and
-- advance their streak. Topics contain sections (content) and quiz_questions.
--
-- is_diagnostic = true means the topic is used exclusively as an initial
-- knowledge assessment and does not appear in the regular learning path.
-- published = false means the topic is in draft and hidden from students.
create table public.topics (
  id              uuid        primary key default gen_random_uuid(),
  subject_id      uuid        not null references public.subjects(id) on delete cascade,
  name            text        not null,
  slug            text        not null unique,
  description     text,
  display_order   integer     not null default 0,
  -- Difficulty rating 1 (easy) to 3 (hard), used to sort and filter content.
  difficulty      integer     not null default 1 check (difficulty between 1 and 3),
  -- XP awarded to the student when they complete this topic for the first time.
  xp_reward       integer     not null default 100 check (xp_reward >= 0),
  is_diagnostic   boolean     not null default false,
  published       boolean     not null default false,
  created_at      timestamptz not null default now()
);

comment on table public.topics is
  'Atomic learning units within a subject. Each topic has sections and quiz questions.';


-- =============================================================================
-- TABLE: public.sections
-- =============================================================================
-- Content blocks that make up a topic's reading material. A section can be:
--   • Base content (theme_id IS NULL, user_id IS NULL) — shared across all students.
--   • Theme-personalised (theme_id IS NOT NULL, user_id IS NULL) — generated once
--     per theme and cached for reuse by any student with that theme.
--   • Fully personalised (user_id IS NOT NULL) — generated for a specific student,
--     incorporating their declared interests from users.interests.
--
-- This three-tier structure lets us serve most students from cached content
-- while only generating bespoke content for ai_personalized plan subscribers.
create table public.sections (
  id              uuid            primary key default gen_random_uuid(),
  topic_id        uuid            not null references public.topics(id) on delete cascade,
  -- NULL = base content not tied to any theme.
  theme_id        uuid            references public.themes(id) on delete set null,
  -- NULL = shared content; a UUID = content generated for this specific user.
  user_id         uuid            references public.users(id) on delete cascade,
  type            section_type    not null,
  title           text,
  content         text            not null,
  -- Tracks which interest tags were injected when generating personalised content.
  interests_used  text[],
  display_order   integer         not null default 0,
  created_at      timestamptz     not null default now()
);

comment on table public.sections is
  'Content blocks within a topic. Supports base, theme-level, and per-user personalisation.';


-- =============================================================================
-- TABLE: public.quiz_questions
-- =============================================================================
-- Multiple-choice questions attached to a topic. Used both for in-topic quizzes
-- and as diagnostic questions (when the parent topic has is_diagnostic = true).
--
-- options stores an ordered array of answer choices:
--   [{"letter": "A", "text": "Newton"}, {"letter": "B", "text": "Einstein"}, ...]
-- correct_answer stores the letter of the correct choice (e.g. "A").
-- source tracks the origin: 'manual' (editor-written) or 'ai' (generated).
create table public.quiz_questions (
  id              uuid        primary key default gen_random_uuid(),
  topic_id        uuid        not null references public.topics(id) on delete cascade,
  question        text        not null,
  -- JSONB array: [{"letter": "A", "text": "..."}, ...]. Min 2, max 5 options.
  options         jsonb       not null,
  correct_answer  text        not null,
  explanation     text,
  difficulty      integer     not null default 1 check (difficulty between 1 and 3),
  xp_reward       integer     not null default 10 check (xp_reward >= 0),
  source          text        not null default 'manual',
  created_at      timestamptz not null default now()
);

comment on table public.quiz_questions is
  'Multiple-choice quiz questions linked to topics. Also used for diagnostic assessments.';


-- =============================================================================
-- TABLE: public.subscriptions
-- =============================================================================
-- Tracks the student's active subscription and payment lifecycle. One row per
-- subscription attempt; a student may have multiple rows (e.g. after upgrading).
-- The application should treat the most recent active/trialing row as current.
--
-- provider_sub_id     — Stripe subscription ID (sub_xxx) or Conekta order ID.
-- provider_customer_id — Stripe customer ID (cus_xxx) or Conekta customer ID.
-- metadata            — Stores raw webhook payload snippets or extra provider data.
create table public.subscriptions (
  id                    uuid                  primary key default gen_random_uuid(),
  user_id               uuid                  not null references public.users(id) on delete cascade,
  plan                  plan_type             not null,
  status                subscription_status   not null default 'active',
  -- Amount in Mexican pesos (MXN), stored as integer cents to avoid float issues.
  price_mxn             integer               not null check (price_mxn >= 0),
  payment_provider      payment_provider,
  provider_sub_id       text,
  provider_customer_id  text,
  current_period_start  timestamptz           not null,
  current_period_end    timestamptz           not null,
  trial_ends_at         timestamptz,
  cancelled_at          timestamptz,
  metadata              jsonb,
  created_at            timestamptz           not null default now(),
  updated_at            timestamptz           not null default now()
);

comment on table public.subscriptions is
  'User subscription records. One row per subscription lifecycle event.';


-- =============================================================================
-- TABLE: public.user_subjects
-- =============================================================================
-- Records which subjects a student has purchased/enrolled in, along with their
-- chosen theme and progress counters for that subject.
--
-- initial_description is populated when diagnostic_type = 'free_description':
-- the student typed their prior knowledge in natural language, which the AI
-- parsed to determine a starting point.
--
-- UNIQUE(user_id, subject_id) ensures a student cannot enroll in the same
-- subject twice, and makes upserts safe.
create table public.user_subjects (
  id                  uuid              primary key default gen_random_uuid(),
  user_id             uuid              not null references public.users(id) on delete cascade,
  subject_id          uuid              not null references public.subjects(id) on delete cascade,
  theme_id            uuid              not null references public.themes(id),
  plan_type           plan_type         not null,
  xp                  integer           not null default 0 check (xp >= 0),
  streak_days         integer           not null default 0 check (streak_days >= 0),
  last_active_at      timestamptz,
  -- Free-text prior knowledge collected during onboarding for this subject.
  initial_description text,
  diagnostic_type     diagnostic_type,
  purchased_at        timestamptz       not null default now(),
  unique (user_id, subject_id)
);

comment on table public.user_subjects is
  'Junction table linking students to their purchased subjects, themes, and per-subject progress.';


-- =============================================================================
-- TABLE: public.progress
-- =============================================================================
-- Immutable event log. Every meaningful student action is appended here as an
-- INSERT. This table is NEVER updated or deleted (except via admin tooling).
--
-- Why an event log?
--   • Full audit trail for debugging and support.
--   • Source of truth for XP recalculation, streaks, and analytics.
--   • topic_progress and users.xp_total are derived caches — this table is the
--     authoritative record.
--
-- topic_id and question_id are nullable because some events (e.g. streak_extended,
-- achievement_unlocked) are not tied to a specific topic or question.
-- attempt tracks how many times a student has tried this question/topic, allowing
-- analysis of learning curves without overwriting previous attempts.
create table public.progress (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  topic_id    uuid        references public.topics(id) on delete set null,
  question_id uuid        references public.quiz_questions(id) on delete set null,
  event_type  event_type  not null,
  -- For quiz events: true = correct answer, false = wrong, null = N/A.
  result      boolean,
  xp_earned   integer     not null default 0 check (xp_earned >= 0),
  -- Time spent on this event in seconds (nullable for non-timed events).
  time_seconds integer,
  attempt     integer     not null default 1 check (attempt >= 1),
  -- Extra context: {"score": 80, "theme_id": "..."} etc.
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.progress is
  'Immutable event log of all student activity. INSERT only — never UPDATE or DELETE.';


-- =============================================================================
-- TABLE: public.topic_progress
-- =============================================================================
-- Denormalised cache of each student's progress on a given topic. Updated by
-- application code (or a trigger on progress) whenever a topic-related event
-- is recorded. Avoids expensive aggregates over the progress log at read time.
--
-- composite PK (user_id, topic_id) ensures uniqueness and makes point lookups O(1).
-- best_score stores the highest quiz score achieved (0-100).
-- attempts counts how many times the student has attempted the topic quiz.
create table public.topic_progress (
  user_id       uuid          not null references public.users(id) on delete cascade,
  topic_id      uuid          not null references public.topics(id) on delete cascade,
  status        topic_status  not null default 'not_started',
  best_score    integer       not null default 0 check (best_score between 0 and 100),
  attempts      integer       not null default 0 check (attempts >= 0),
  completed_at  timestamptz,
  updated_at    timestamptz   not null default now(),
  primary key (user_id, topic_id)
);

comment on table public.topic_progress is
  'Cached per-topic progress per student. Derived from the progress event log.';


-- =============================================================================
-- INDEXES
-- =============================================================================
-- Indexes are created for the most frequent query patterns identified in the
-- application layer. All foreign-key columns that appear in WHERE clauses or
-- JOINs without a covering index are included.

-- Event log queries: "show me all events of type X for user Y"
create index idx_progress_user_event       on public.progress (user_id, event_type);

-- Per-topic event queries: "how many times did this user attempt topic Y?"
create index idx_progress_user_topic       on public.progress (user_id, topic_id);

-- Topic progress dashboard queries: "show all topic statuses for this user"
create index idx_topic_progress_user       on public.topic_progress (user_id);

-- Content serving: "fetch sections for topic T with theme X (cached)"
create index idx_sections_topic_theme      on public.sections (topic_id, theme_id);

-- Personalised content lookup: "fetch sections generated for this specific user"
create index idx_sections_topic_user       on public.sections (topic_id, user_id);

-- Subject enrollment queries: "what subjects has this student enrolled in?"
create index idx_user_subjects_user        on public.user_subjects (user_id);

-- Subscription status check: "does this user have an active subscription?"
create index idx_subscriptions_user_status on public.subscriptions (user_id, status);


-- =============================================================================
-- TRIGGER: handle_new_user
-- =============================================================================
-- Fires immediately after a new row is inserted into auth.users (i.e. whenever
-- a student signs up via email/password, OAuth, or magic link).
--
-- Why a trigger instead of application code?
--   • Guarantees atomicity — the public.users row is always created even if the
--     application process crashes between the two operations.
--   • Works regardless of which client library or signup method is used.
--   • Keeps the auth and app schemas in sync without coupling signup logic to a
--     specific API route or server action.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Restrict search_path to prevent search-path hijacking attacks.
set search_path = public
as $$
begin
  insert into public.users (id, email, role, onboarding_done)
  values (
    new.id,
    new.email,
    'student',
    false
  );
  return new;
end;
$$;

-- Attach the function to auth.users as an AFTER INSERT trigger.
create trigger handle_new_user
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

comment on function public.handle_new_user() is
  'Creates a public.users profile row whenever a new auth.users entry is inserted.';


-- =============================================================================
-- RPC FUNCTION: increment_xp
-- =============================================================================
-- Atomically adds `amount` XP to a user's global xp_total counter.
--
-- Why a dedicated function instead of a plain UPDATE?
--   • Prevents race conditions from concurrent requests both reading and writing
--     xp_total. The UPDATE with addition is atomic at the row level in Postgres.
--   • Centralises the XP mutation so we can add side-effects later (e.g. level-up
--     checks, achievement triggers) without touching call sites.
--   • Callable via supabase.rpc('increment_xp', {uid, amount}) from the client.

create or replace function public.increment_xp(uid uuid, amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set xp_total = xp_total + amount
  where id = uid;
end;
$$;

comment on function public.increment_xp(uuid, integer) is
  'Atomically increments a user''s global XP total by the given amount.';


-- =============================================================================
-- RPC FUNCTION: increment_subject_xp
-- =============================================================================
-- Atomically adds `amount` XP to a specific subject enrollment row.
-- Called alongside increment_xp so that both global and per-subject XP stay
-- in sync within the same transaction on the application side.

create or replace function public.increment_subject_xp(
  uid        uuid,
  sid        uuid,
  amount     integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_subjects
  set xp = xp + amount
  where user_id = uid
    and subject_id = sid;
end;
$$;

comment on function public.increment_subject_xp(uuid, uuid, integer) is
  'Atomically increments a student''s XP for a specific enrolled subject.';


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- RLS is enabled on every table. The golden rule: if there is no matching
-- policy, access is denied by default. Policies are additive (OR logic).
--
-- Service role (used by Edge Functions and admin scripts) bypasses RLS.
-- Authenticated students are scoped to their own rows on sensitive tables.
-- Read-only catalog tables (subjects, topics, sections, etc.) are open to
-- any authenticated user.


-- ── public.users ─────────────────────────────────────────────────────────────
-- Students can read and update only their own profile row.
-- Inserts are handled exclusively by the handle_new_user trigger (service role).

alter table public.users enable row level security;

-- A student can see their own profile (e.g. to display name and XP in the UI).
create policy "users: select own row"
  on public.users for select
  using (auth.uid() = id);

-- A student can update their own profile (e.g. full_name, avatar, interests).
-- Role and onboarding_done should only be mutated via trusted server code,
-- but we allow updates here and rely on server actions to validate the payload.
create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id);


-- ── public.themes ─────────────────────────────────────────────────────────────
-- Themes are catalog data. Any logged-in student can read all active themes.

alter table public.themes enable row level security;

create policy "themes: authenticated read"
  on public.themes for select
  to authenticated
  using (true);


-- ── public.subjects ───────────────────────────────────────────────────────────
-- Subjects are catalog data. Any authenticated user can read them.

alter table public.subjects enable row level security;

create policy "subjects: authenticated read"
  on public.subjects for select
  to authenticated
  using (true);


-- ── public.topics ─────────────────────────────────────────────────────────────
-- Only published topics are visible to students. Admins see all via service role.

alter table public.topics enable row level security;

create policy "topics: authenticated read published"
  on public.topics for select
  to authenticated
  using (published = true);


-- ── public.sections ───────────────────────────────────────────────────────────
-- A student can read:
--   1. Base content (theme_id IS NULL AND user_id IS NULL).
--   2. Theme-level content for any theme (cached, shared).
--   3. Personalised content generated for them specifically.

alter table public.sections enable row level security;

create policy "sections: authenticated read"
  on public.sections for select
  to authenticated
  using (
    user_id is null           -- base or theme-level cached content
    or user_id = auth.uid()   -- personalised content for this student
  );


-- ── public.quiz_questions ─────────────────────────────────────────────────────
-- Quiz questions are catalog data. Any authenticated user can read them.

alter table public.quiz_questions enable row level security;

create policy "quiz_questions: authenticated read"
  on public.quiz_questions for select
  to authenticated
  using (true);


-- ── public.subscriptions ─────────────────────────────────────────────────────
-- Students can only read their own subscription records.
-- Inserts and updates are performed by webhook handlers (service role).

alter table public.subscriptions enable row level security;

create policy "subscriptions: select own"
  on public.subscriptions for select
  using (auth.uid() = user_id);


-- ── public.user_subjects ─────────────────────────────────────────────────────
-- Students can only see their own subject enrollments.

alter table public.user_subjects enable row level security;

create policy "user_subjects: select own"
  on public.user_subjects for select
  using (auth.uid() = user_id);


-- ── public.progress ───────────────────────────────────────────────────────────
-- Students can read their own event log and append new events.
-- Updates and deletes are not allowed for authenticated users (immutable log).

alter table public.progress enable row level security;

create policy "progress: select own"
  on public.progress for select
  using (auth.uid() = user_id);

create policy "progress: insert own"
  on public.progress for insert
  with check (auth.uid() = user_id);


-- ── public.topic_progress ─────────────────────────────────────────────────────
-- Students can read and upsert their own cached topic progress.

alter table public.topic_progress enable row level security;

create policy "topic_progress: select own"
  on public.topic_progress for select
  using (auth.uid() = user_id);

-- Upsert is allowed so the client can initialise a row on first visit and
-- update it as the student advances through the topic.
create policy "topic_progress: insert own"
  on public.topic_progress for insert
  with check (auth.uid() = user_id);

create policy "topic_progress: update own"
  on public.topic_progress for update
  using (auth.uid() = user_id);
