-- 029_match_section_type.sql
-- Migracion RETROACTIVA. El valor 'match' del enum section_type ya existe
-- en la base de produccion: se agrego con un ALTER TYPE manual despues de
-- la migracion 026 y nunca quedo en un archivo. Sin esto, un entorno
-- reconstruido desde supabase/migrations/ no tendria el valor y todos los
-- inserts de bloques match tronarian.
--
-- Es idempotente: en la base actual no cambia nada.

ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'match';
