-- Diagnostic questions table for ai_personalized plan
-- One question per topic, medium difficulty, used in pre-payment diagnostic quiz

CREATE TABLE public.diagnostic_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  topic_name text NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text NOT NULL,
  education_level text NOT NULL,
  grade integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.diagnostic_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do everything on diagnostic_questions"
  ON public.diagnostic_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read diagnostic_questions"
  ON public.diagnostic_questions
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_diagnostic_questions_subject_grade
  ON public.diagnostic_questions (subject_id, grade);
