-- 031_last_level_seen.sql
-- Guarda el ultimo nivel que el alumno ya vio celebrado.
--
-- Por que una columna y no detectar el nivel en el momento del XP:
-- el XP se otorga en 4 rutas distintas (quiz, section-read, horda,
-- bloques interactivos) y en la horda se ganan hasta 330 XP de una
-- sentada. Un popup que salta a media oleada rompe el juego. Con esta
-- columna, el server component compara el nivel real contra el ultimo
-- celebrado y muestra la felicitacion en la siguiente pantalla tranquila
-- (dashboard o materia), sin importar que accion dio el XP.
--
-- El UPDATE inicial marca a todos los usuarios existentes como "ya
-- vieron" su nivel actual, para que nadie reciba una felicitacion
-- retroactiva de un nivel que subio hace meses.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_level_seen smallint NOT NULL DEFAULT 1;

UPDATE public.users
SET last_level_seen = GREATEST(FLOOR(COALESCE(xp_total, 0) / 500) + 1, 1);
