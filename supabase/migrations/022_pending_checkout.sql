-- Columna temporal para guardar plan pendiente durante verificación de email
-- Se limpia automáticamente después del checkout en auth/callback
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pending_checkout JSONB DEFAULT NULL;
