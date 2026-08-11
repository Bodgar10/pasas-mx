-- ============================================================
-- 036_learners_rls.sql — Permisos por columna y candado de XP
-- Aplicada en produccion: 10 ago 2026 (sesion 28)
-- ============================================================

BEGIN;

-- Permisos por columna: el cliente escribe la racha y el nivel visto,
-- pero NO birthdate, education_level, grade ni theme_id.
-- Esos siguen siendo server-only.
CREATE POLICY "learners: update own activity" ON public.learners
  FOR UPDATE
  USING (auth.uid() = account_user_id)
  WITH CHECK (auth.uid() = account_user_id);

REVOKE UPDATE ON public.learners FROM authenticated;
GRANT UPDATE (streak_days, last_active_at, last_level_seen)
  ON public.learners TO authenticated;

-- Hueco heredado de increment_xp: era SECURITY DEFINER y aceptaba
-- cualquier uuid del cliente. Cualquiera podia regalarse XP.
-- auth.uid() es NULL con service role, que es como llama /api/horde/answer.
CREATE OR REPLACE FUNCTION public.increment_learner_xp(lid uuid, amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.learners
  SET xp_total = xp_total + amount
  WHERE id = lid
    AND (auth.uid() IS NULL OR account_user_id = auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.increment_subject_xp(lid uuid, sid uuid, amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.user_subjects us
  SET xp = us.xp + amount
  WHERE us.learner_id = lid
    AND us.subject_id = sid
    AND (auth.uid() IS NULL OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = lid AND l.account_user_id = auth.uid()
    ));
END; $$;

COMMIT;
