-- ============================================================
-- 046_resync_learner_grade.sql
-- Sesión 32 — Cambiar de grado sin dejar al alumno sin materias
-- ============================================================
-- `api/seats/change-grade` escribía `learners.education_level` y
-- `learners.grade` sin tocar `user_subjects`. Como los temas se filtran
-- por `topics.grade`, el alumno quedaba con el catálogo del grado
-- anterior y veía "Próximamente" en TODAS sus materias, con el
-- contenido existiendo. Medido en producción: una alumna en 3° con
-- siete materias de 2°, 62 temas publicados entre ellas y 0 visibles.
--
-- Es el camino de la PROMOCIÓN DE CICLO ESCOLAR: en septiembre lo
-- recorre cualquier alumno que suba de grado.
--
-- 🔴 POR QUÉ UNA FUNCIÓN Y NO CUATRO LLAMADAS DESDE EL CLIENTE:
-- por la TRANSACCIÓN, no por el privilegio. Supabase JS no expone
-- transacciones. Si el insert fallara después del delete, el alumno se
-- quedaría sin ninguna materia y sin forma de recuperarlas desde la
-- interfaz: peor que el bug que esto arregla. Aquí o pasa todo o no
-- pasa nada.
--
-- 🔴 LA REGLA DE "QUÉ MATERIAS LE TOCAN" NO VIVE AQUÍ.
-- Llega resuelta en `p_subject_ids`, calculada por `materiasParaGrado`
-- (src/lib/learners.ts), que es la única definición y la comparten los
-- tres caminos que escriben `user_subjects` (webhook de Stripe,
-- seats/add y change-grade). Reimplementarla en SQL sería la cuarta
-- copia de una regla que ya se desincronizó una vez.
--
-- SEGURIDAD: patrón de la 035:172-184 — SECURITY DEFINER con
-- `SET search_path TO 'public'`. Además, EXECUTE revocado a `anon` y
-- `authenticated` (patrón de la 033/044): esta función ESCRIBE y se
-- salta la RLS, así que solo la llama el service role desde la ruta,
-- que ya verificó que el learner es de la cuenta en sesión. Sin ese
-- revoke, cualquier usuario autenticado podría reasignarle el grado y
-- borrarle las materias a cualquier alumno de cualquier cuenta.
--
-- Idempotente.
-- ============================================================

BEGIN;

-- DROP explícito antes del CREATE: CREATE OR REPLACE con distinta firma
-- NO reemplaza, deja las dos vivas (misma razón que la nota de 035:166).
DROP FUNCTION IF EXISTS public.resync_learner_grade(uuid, text, integer, uuid[], uuid, text);

CREATE FUNCTION public.resync_learner_grade(
  p_learner_id      uuid,
  p_education_level text,
  p_grade           integer,
  p_subject_ids     uuid[],
  p_theme_id        uuid,
  p_reason          text DEFAULT 'manual'
)
RETURNS TABLE (borradas integer, insertadas integer, conservadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id     uuid;
  v_from_level  education_level;
  v_from_grade  integer;
  v_borradas    integer := 0;
  v_insertadas  integer := 0;
  v_conservadas integer := 0;
BEGIN
  -- Defensa en profundidad. La ruta ya rechaza el cambio si el grado
  -- destino no tiene catálogo, pero un arreglo vacío aquí borraría
  -- TODAS las materias del alumno y no insertaría ninguna: exactamente
  -- el estado del que venimos.
  IF p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL THEN
    RAISE EXCEPTION
      'resync_learner_grade: sin materias para el grado destino (learner %)', p_learner_id;
  END IF;

  -- `user_subjects.theme_id` es NOT NULL. Sin temática no hay insert
  -- posible, y no se inventa una: el alumno eligió la suya.
  IF p_theme_id IS NULL THEN
    RAISE EXCEPTION
      'resync_learner_grade: sin tematica (learner %)', p_learner_id;
  END IF;

  -- FOR UPDATE: serializa dos cambios de grado simultáneos del mismo
  -- alumno. Sin el lock, dos peticiones podrían intercalar delete e
  -- insert y dejar el catálogo mezclado.
  SELECT l.account_user_id, l.education_level, l.grade
    INTO v_user_id, v_from_level, v_from_grade
  FROM public.learners l
  WHERE l.id = p_learner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resync_learner_grade: learner % no existe', p_learner_id;
  END IF;

  UPDATE public.learners
     SET education_level = p_education_level::education_level,
         grade           = p_grade
   WHERE id = p_learner_id;
  -- 🔴 `xp_total` NO se toca. El XP histórico del alumno se conserva
  -- entero al cambiar de grado.

  -- Cuántas sirven a los dos grados. Se cuenta ANTES del delete: son
  -- las que quedan intactas, con su xp y su racha.
  SELECT count(*) INTO v_conservadas
  FROM public.user_subjects us
  WHERE us.learner_id = p_learner_id
    AND us.plan_type  = 'grade'
    AND us.subject_id = ANY(p_subject_ids);

  -- 🔴 EL DELETE SE ACOTA A plan_type = 'grade'.
  -- Cambiar de grado reemplaza el catálogo estándar; no destruye lo que
  -- el alumno pagó a medida. Las filas `ai_personalized` son planes
  -- generados con IA, cuestan dinero y no se regeneran solos: se quedan
  -- donde están. Las `exam` tampoco son del catálogo por grado.
  WITH us_borradas AS (
    DELETE FROM public.user_subjects us
    WHERE us.learner_id = p_learner_id
      AND us.plan_type  = 'grade'
      AND NOT (us.subject_id = ANY(p_subject_ids))
    RETURNING 1
  )
  SELECT count(*) INTO v_borradas FROM us_borradas;

  -- Las nuevas entran con xp = 0 y streak_days = 0: es contenido nuevo,
  -- no progreso heredado.
  --
  -- ON CONFLICT DO NOTHING es lo que deja INTACTA una materia que sirve
  -- a los dos grados — conserva su xp, su racha y su last_active_at en
  -- vez de reinsertarla en cero. También respeta una fila
  -- `ai_personalized` de la misma materia, que no se pisa.
  WITH us_nuevas AS (
    INSERT INTO public.user_subjects (
      user_id, learner_id, subject_id, theme_id, plan_type,
      xp, streak_days, purchased_at
    )
    SELECT v_user_id, p_learner_id, s.id, p_theme_id, 'grade'::plan_type,
           0, 0, now()
    FROM unnest(p_subject_ids) AS s(id)
    ON CONFLICT (learner_id, subject_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_insertadas FROM us_nuevas;

  -- Bitácora append-only, dentro de la misma transacción. Antes su
  -- fallo se toleraba; ahora revierte el cambio entero. Es el precio de
  -- la atomicidad y es el correcto: los tres valores de `reason` pasan
  -- el CHECK de la tabla, así que un fallo aquí significa que algo más
  -- grave ya hacía que el cambio no debiera aplicarse.
  INSERT INTO public.learner_grade_changes (
    learner_id, from_level, from_grade, to_level, to_grade, reason
  ) VALUES (
    p_learner_id, v_from_level, v_from_grade,
    p_education_level::education_level, p_grade, p_reason
  );

  -- `progress` y `topic_progress` NO se borran. Quedan huérfanos por
  -- diseño: eran de temas del grado anterior, y si el alumno regresa a
  -- ese grado los recupera tal cual estaban.

  RETURN QUERY SELECT v_borradas, v_insertadas, v_conservadas;
END;
$$;

REVOKE ALL ON FUNCTION
  public.resync_learner_grade(uuid, text, integer, uuid[], uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.resync_learner_grade(uuid, text, integer, uuid[], uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.resync_learner_grade(uuid, text, integer, uuid[], uuid, text) IS
  'Cambia grado/nivel de un learner y reemplaza sus user_subjects de plan_type=grade, atomico. Las materias las calcula materiasParaGrado() en la app; aqui solo se aplican.';

COMMIT;

SELECT '046_resync_learner_grade: aplicada' AS status;
