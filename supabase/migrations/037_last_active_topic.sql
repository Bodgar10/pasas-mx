-- ============================================================
-- 037_last_active_topic.sql
-- Aplicada en produccion: 10 ago 2026 (sesion 28)
--
-- La RPC NUNCA existio. El dashboard la llamaba sin revisar { error },
-- asi que PostgREST devolvia 404, lastActiveRows quedaba undefined y la
-- tarjeta de "continuar donde te quedaste" jamas se pinto en la vida del
-- producto. Se crea ya con learner_id: nace correcta.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_last_active_topic(p_learner_id uuid)
RETURNS TABLE(
  topic_name   text,
  topic_slug   text,
  subject_name text,
  subject_slug text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  -- SECURITY INVOKER, no DEFINER: la RLS de progress sigue aplicando y
  -- nadie puede leer el avance de otra cuenta pasando un uuid ajeno.
  -- t.published = true: si se despublica un tema, la tarjeta no manda
  -- a nadie a un 404.
  SELECT t.name, t.slug, s.name, s.slug
  FROM public.progress p
  JOIN public.topics   t ON t.id = p.topic_id
  JOIN public.subjects s ON s.id = t.subject_id
  WHERE p.learner_id = p_learner_id
    AND p.topic_id IS NOT NULL
    AND t.published = true
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

COMMIT;
