-- Publicar Introducción a las Ciencias Sociales (s44)
-- ============================================================
-- Correr SOLO cuando el contenido esté revisado (y aplicadas las
-- correcciones pendientes, si las hay). Para otra materia: cambiar el
-- slug y el grado.
--
-- 1) Temas visibles (solo los que ya tienen Horda cargada).
-- 2) La materia aparece en el dashboard y en `materiasParaGrado` (webhook
--    de Stripe, seats/add, seats/change-grade) para 1.º de bachillerato.
-- 3) Backfill de user_subjects: la guía lee la temática de
--    user_subjects.theme_id; sin esa fila el tema se pinta vacío para los
--    alumnos que ya pagaron antes de que existiera la materia.
-- ============================================================
BEGIN;

UPDATE public.topics SET published = true
 WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'introduccion-ciencias-sociales')
   AND horde_ready;

UPDATE public.subjects SET grades = ARRAY[1] WHERE slug = 'introduccion-ciencias-sociales';

INSERT INTO public.user_subjects (user_id, learner_id, subject_id, theme_id, plan_type)
SELECT DISTINCT ON (us.learner_id)
       us.user_id, us.learner_id, s.id, COALESCE(l.theme_id, us.theme_id), 'grade'
  FROM public.user_subjects us
  JOIN public.learners l ON l.id = us.learner_id
  JOIN public.subjects s ON s.slug = 'introduccion-ciencias-sociales'
 WHERE us.plan_type = 'grade'
   AND l.education_level = 'high_school'
   AND l.grade = 1
ON CONFLICT (learner_id, subject_id) DO NOTHING;

COMMIT;
