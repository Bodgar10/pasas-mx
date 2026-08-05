-- ============================================================
-- 033_preview_stats.sql
-- Sesión 26 — Números reales para la pantalla de vista previa
-- ============================================================
-- Devuelve SOLO agregados (conteos) de un nivel y grado. Nunca contenido.
--
-- SEGURIDAD:
--   · NO usa SECURITY DEFINER. No hace falta: `service_role` ya se salta la RLS,
--     y el único que puede ejecutarla es él.
--   · Se REVOCA a `anon` y `authenticated` explícitamente. Un usuario anónimo
--     en el navegador NO puede llamarla, ni siquiera sabiendo su nombre.
--   · La RLS anti-trampa de `horde_questions` sigue intacta.
--
-- Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.preview_stats(p_nivel text, p_grado int)
RETURNS TABLE (
  materias         bigint,
  temas            bigint,
  bloques_leccion  bigint,
  interactivos     bigint,
  papel_lapiz      bigint,
  audios           bigint,
  horda_temas      bigint,
  horda_preguntas  bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH temas_grado AS (
    SELECT t.id, t.subject_id
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.published = true
      AND t.grade = p_grado
      AND s.education_level::text = p_nivel
  ),
  secciones AS (
    SELECT
      COUNT(*) FILTER (
        WHERE sec.type::text IN ('explanation','example','analogy','key_fact','tip')
      ) AS leccion,
      COUNT(*) FILTER (
        WHERE sec.type::text IN ('sort','match','scrubber','steps')
      ) AS inter,
      COUNT(*) FILTER (WHERE sec.type::text = 'solve')  AS solve,
      COUNT(*) FILTER (WHERE sec.audio_url IS NOT NULL) AS audio
    FROM public.sections sec
    WHERE sec.user_id IS NULL
      AND sec.topic_id IN (SELECT id FROM temas_grado)
  ),
  horda AS (
    SELECT COUNT(DISTINCT hq.topic_id) AS th, COUNT(*) AS pq
    FROM public.horde_questions hq
    WHERE hq.topic_id IN (SELECT id FROM temas_grado)
  )
  SELECT
    (SELECT COUNT(DISTINCT subject_id) FROM temas_grado),
    (SELECT COUNT(*)                   FROM temas_grado),
    secciones.leccion,
    secciones.inter,
    secciones.solve,
    secciones.audio,
    horda.th,
    horda.pq
  FROM secciones, horda;
$$;

COMMENT ON FUNCTION public.preview_stats(text, int) IS
  'Conteos agregados para /onboarding/preview. Solo la llama /api/preview-stats con service role. NO exponer a anon.';

REVOKE ALL ON FUNCTION public.preview_stats(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_stats(text, int) FROM anon;
REVOKE ALL ON FUNCTION public.preview_stats(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_stats(text, int) TO service_role;
