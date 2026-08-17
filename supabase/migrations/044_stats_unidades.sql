-- ============================================================
-- 044_stats_unidades.sql
-- Sesión 31 — Los conteos, en la unidad que el usuario cuenta
-- ============================================================
-- Dos cosas:
--   1. preview_stats: `papel_lapiz` contaba SECCIONES y la pantalla las
--      llamaba "ejercicios". Cada sección `solve` trae varias preguntas y la
--      UI las numera una por una ("Ejercicio 1 de 3"), así que para
--      Secundaria 2° decía 136 cuando el alumno se va a encontrar 408.
--   2. landing_stats(): los conteos globales de la landing estaban escritos a
--      mano y envejecían en silencio. "4,070 audios" contra 6,282 reales: 35%
--      por debajo en trece días.
--
-- 🔴 CREATE OR REPLACE en migración nueva. La 033 no se edita: el histórico
-- de migraciones es el registro de lo que se ejecutó, no el estado deseado.
--
-- SEGURIDAD: idéntica a la 033. Sin SECURITY DEFINER —`service_role` ya se
-- salta la RLS y es el único que ejecuta—, y EXECUTE revocado a `anon` y
-- `authenticated`. La RLS anti-trampa de `horde_questions` sigue intacta.
--
-- Idempotente.
-- ============================================================


-- ------------------------------------------------------------
-- 1. preview_stats — solo cambia `papel_lapiz`
-- ------------------------------------------------------------
-- 🔴 SOLO `papel_lapiz`. Se verificó tipo por tipo qué guarda cada sección en
-- `data` y cómo la numera la UI, y el resto YA estaba bien:
--
--   type       llave del array   la UI numera…            ¿1 sección = 1 ejercicio?
--   ---------  ----------------  -----------------------  -------------------------
--   solve      questions         "Ejercicio 1 de 3"       NO — son N ejercicios
--   sort       items             (no numera)              sí
--   match      pairs             "3 / 4 parejas"          sí — una partida
--   scrubber   points            (no numera)              sí — un simulador
--   steps      steps             "Paso 2 de 5"            sí — una secuencia
--
-- Los cuatro tipos de `interactivos` NO comparten llave: sumar
-- data->'questions' sobre ellos habría dado cero y roto el conteo bueno. Y su
-- unidad ya es correcta: un memorama es una partida, no cuatro. `solve` es el
-- único donde la sección es un contenedor de ejercicios.
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
      -- 🔴 PREGUNTAS, no secciones. `data->'questions'` solo existe en
      -- `solve`; el COALESCE cubre una fila con data nulo o sin la llave, que
      -- de otro modo anularía la suma entera.
      COALESCE(SUM(
        CASE
          WHEN sec.type::text = 'solve'
            AND jsonb_typeof(sec.data -> 'questions') = 'array'
          THEN jsonb_array_length(sec.data -> 'questions')
          ELSE 0
        END
      ), 0) AS solve,
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
  'Conteos agregados para /onboarding/preview. papel_lapiz cuenta PREGUNTAS (data->questions), no secciones. Solo la llama /api/preview-stats y la pagina, con service role. NO exponer a anon.';

REVOKE ALL ON FUNCTION public.preview_stats(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_stats(text, int) FROM anon;
REVOKE ALL ON FUNCTION public.preview_stats(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_stats(text, int) TO service_role;


-- ------------------------------------------------------------
-- 2. landing_stats — los conteos globales de la landing
-- ------------------------------------------------------------
-- Sin parámetros: son totales del catálogo completo, no por grado. Cada
-- alumno recorre todos los temas en SU temática, así que el número que se
-- anuncia es el del catálogo; la temática cambia el envoltorio, no el
-- temario.
--
-- 🔴 CADA CIFRA EN LA UNIDAD QUE EL USUARIO CUENTA, que no es la misma para
-- todos los tipos (ver la tabla de arriba). `papel_lapiz` suma preguntas;
-- memoramas, simuladores, secuencias y clasificaciones se cuentan por
-- sección, porque cada sección ES una de esas cosas.
--
-- Solo contenido genérico (`user_id IS NULL`): las secciones personalizadas
-- pertenecen a un alumno y no son catálogo que se pueda anunciar.
CREATE OR REPLACE FUNCTION public.landing_stats()
RETURNS TABLE (
  materias         bigint,
  temas            bigint,
  horda_temas      bigint,
  horda_preguntas  bigint,
  papel_lapiz      bigint,
  audios           bigint,
  memoramas        bigint,
  simuladores      bigint,
  secuencias       bigint,
  clasificaciones  bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH publicados AS (
    SELECT t.id, t.subject_id
    FROM public.topics t
    WHERE t.published = true
  ),
  secciones AS (
    SELECT
      COUNT(*) FILTER (WHERE sec.type::text = 'match')     AS memoramas,
      COUNT(*) FILTER (WHERE sec.type::text = 'scrubber')  AS simuladores,
      COUNT(*) FILTER (WHERE sec.type::text = 'steps')     AS secuencias,
      COUNT(*) FILTER (WHERE sec.type::text = 'sort')      AS clasificaciones,
      COUNT(*) FILTER (WHERE sec.audio_url IS NOT NULL)    AS audios,
      COALESCE(SUM(
        CASE
          WHEN sec.type::text = 'solve'
            AND jsonb_typeof(sec.data -> 'questions') = 'array'
          THEN jsonb_array_length(sec.data -> 'questions')
          ELSE 0
        END
      ), 0) AS papel_lapiz
    FROM public.sections sec
    WHERE sec.user_id IS NULL
      AND sec.topic_id IN (SELECT id FROM publicados)
  ),
  horda AS (
    SELECT COUNT(DISTINCT hq.topic_id) AS th, COUNT(*) AS pq
    FROM public.horde_questions hq
    WHERE hq.topic_id IN (SELECT id FROM publicados)
  )
  SELECT
    (SELECT COUNT(DISTINCT subject_id) FROM publicados),
    (SELECT COUNT(*)                   FROM publicados),
    horda.th,
    horda.pq,
    secciones.papel_lapiz,
    secciones.audios,
    secciones.memoramas,
    secciones.simuladores,
    secciones.secuencias,
    secciones.clasificaciones
  FROM secciones, horda;
$$;

COMMENT ON FUNCTION public.landing_stats() IS
  'Conteos globales del catalogo para la landing. Cada cifra en la unidad que la UI numera: papel_lapiz en preguntas, el resto por seccion. Solo service role. NO exponer a anon.';

REVOKE ALL ON FUNCTION public.landing_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.landing_stats() FROM anon;
REVOKE ALL ON FUNCTION public.landing_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.landing_stats() TO service_role;
