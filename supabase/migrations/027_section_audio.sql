-- Audio narrado por sección (voz clonada, pre-generado y servido estático).
-- Aplica solo a bloques de TEXTO (explanation, analogy, example, key_fact, tip).
-- Los bloques interactivos y el diagram no llevan audio (audio_url queda NULL).
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS audio_duration numeric;

COMMENT ON COLUMN public.sections.audio_url IS 'URL pública del MP3 narrado (Supabase Storage). NULL = sin audio.';
COMMENT ON COLUMN public.sections.audio_duration IS 'Duración del audio en segundos. Se guarda al generar para pintar el tiempo sin descargar el MP3.';
