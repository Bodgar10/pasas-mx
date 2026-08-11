-- ============================================================
-- 040_promocion_ciclo.sql — Aviso de cambio de grado
-- Aplicada en produccion: 11 ago 2026 (sesion 29)
--
-- Ciclo escolar en que se le propuso al alumno pasar de grado.
-- Formato '2026-2027'. NULL = nunca se le ha propuesto.
-- Se escribe aunque el usuario cierre sin decidir: es un aviso una vez
-- por ciclo, no una insistencia.
-- ============================================================

ALTER TABLE public.learners ADD COLUMN promocion_vista_ciclo text;
