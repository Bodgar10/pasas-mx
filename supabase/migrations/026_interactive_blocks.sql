-- Agrega los tipos de bloque interactivo al enum existente.
-- No referenciamos estos valores en esta misma migración (solo los registramos),
-- así que es seguro correrlo tal cual en Supabase (PG15).
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'scrubber';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'steps';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'sort';

-- Payload estructurado de los bloques interactivos.
-- El texto viejo sigue viviendo en content; los bloques interactivos guardan su
-- JSON aquí. content se mantiene NOT NULL: cada bloque interactivo guarda también
-- un texto corto de respaldo (accesibilidad + fallback si el componente no carga).
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS data jsonb;

COMMENT ON COLUMN public.sections.data IS 'Payload JSON para bloques interactivos (scrubber/steps/sort). NULL para bloques de texto.';
