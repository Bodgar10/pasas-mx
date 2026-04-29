-- =============================================================================
-- 004_themes_icon.sql
-- =============================================================================
-- Adds icon and subtitle columns to public.themes.
-- icon: emoji displayed in the theme selector UI
-- subtitle: short text shown below the theme name (e.g. "Minecraft · GTA · LoL")
-- =============================================================================

ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS subtitle text;

COMMENT ON COLUMN public.themes.icon IS 'Emoji icon displayed in theme selector UI';
COMMENT ON COLUMN public.themes.subtitle IS 'Short subtitle shown below theme name, e.g. Minecraft · GTA · LoL';

-- Seed subtitle values for existing themes
UPDATE public.themes SET subtitle = 'Minecraft · GTA · LoL'
  WHERE id = '8675082b-df0f-4599-b566-38fa13753120';
UPDATE public.themes SET subtitle = 'BTS · Stray Kids'
  WHERE id = '16b89743-e0d7-4fdb-81d6-cf23184d080f';
UPDATE public.themes SET subtitle = 'Liga MX · Champions'
  WHERE id = '00ef7bf7-5fce-4dbe-9171-4bd413e59753';
UPDATE public.themes SET subtitle = 'Naruto · AOT · DS'
  WHERE id = '8c348606-4ea8-4914-83dd-47b8d039e5d1';

-- RLS: allow authenticated users to read active themes
CREATE POLICY "Authenticated users can read active themes"
  ON public.themes FOR SELECT
  TO authenticated
  USING (active = true);
