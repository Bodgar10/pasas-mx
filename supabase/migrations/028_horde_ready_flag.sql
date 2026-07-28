-- 028_horde_ready_flag.sql
-- Bandera de "este topic ya tiene banco de horda".
--
-- Por que una columna y no un COUNT sobre horde_questions:
-- la migracion 027 le niega a `authenticated` el SELECT sobre
-- horde_questions a proposito, para que ningun alumno pueda bajarse
-- las preguntas con su correct_answer desde la consola. Un count
-- desde el server component (que corre con la sesion del alumno)
-- regresaria 0 aunque el banco exista. Esta columna vive en topics,
-- que el alumno ya puede leer, y no expone nada del contenido.
--
-- La escribe scripts/generate-horde.ts al terminar cada topic.

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS horde_ready boolean NOT NULL DEFAULT false;

UPDATE public.topics t
SET horde_ready = true
WHERE EXISTS (
  SELECT 1 FROM public.horde_questions q WHERE q.topic_id = t.id
);
