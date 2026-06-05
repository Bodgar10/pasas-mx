-- Migración: 021_subjects_grades_fix.sql
-- Sesión 16 — 5 junio 2026
--
-- Documenta el fix estructural aplicado manualmente:
-- Se separaron subjects con grades=[1,2,3] en registros individuales por grado.
-- Afectó 7 subjects: Matemáticas sec (x3), Español sec (x3), Historia sec (x3),
-- Cívica sec (x2), Geografía sec (x3), Humanidades prepa (x2), Lenguaje prepa (x2).
--
-- Adicionalmente se migró contenido completo desde Excel:
-- Bachillerato: 44 subjects, 340 topics
-- Secundaria: 21 subjects, ~243 topics (upsert con preservación de contenido existente)
--
-- Este archivo es solo referencia documental.
-- Los cambios ya están aplicados en BD de producción y sandbox.

SELECT '021_subjects_grades_fix: documentado' AS status;
