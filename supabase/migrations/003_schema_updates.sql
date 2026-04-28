-- =============================================================================
-- 003_schema_updates.sql
-- =============================================================================
-- Adds fields discovered during Session 5 (28 April 2026) that were missing
-- from the original schema documentation but exist in the live database.
--
-- Changes:
--   1. public.topics  → ADD COLUMN icon  text       (emoji for UI display)
--   2. public.topics  → ADD COLUMN grade integer    (filters topics by student grade)
-- =============================================================================


-- ── public.topics: icon ───────────────────────────────────────────────────────
-- Stores the emoji or icon string for this topic, displayed in the topic card UI.
-- Kept in the database so editors can update icons via the admin panel without
-- touching code. NULL falls back to '📚' in the frontend.

alter table public.topics
  add column if not exists icon text;

comment on column public.topics.icon is
  'Emoji or icon string displayed on the topic card. NULL = frontend falls back to 📚.';


-- ── public.topics: grade ──────────────────────────────────────────────────────
-- Each subject (e.g. Matemáticas Secundaria) covers grades 1, 2 and 3, but each
-- grade has a completely different SEP curriculum. This column scopes topics to a
-- specific grade so the API can filter with:
--   WHERE subject_id = ? AND grade = profile.grade AND published = true
-- This avoids duplicating subjects per grade while keeping topics cleanly separated.

alter table public.topics
  add column if not exists grade integer check (grade between 1 and 3);

comment on column public.topics.grade is
  'School grade (1, 2 or 3) this topic belongs to. Filters the curriculum shown
   to each student based on their profile.grade. NULL = applies to all grades.';
