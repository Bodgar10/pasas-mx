-- Add theme_id to quiz_questions to support per-theme quizzes
ALTER TABLE public.quiz_questions
ADD COLUMN theme_id uuid REFERENCES public.themes(id) NULL;

-- Index for performance
CREATE INDEX idx_quiz_questions_theme_id
ON public.quiz_questions(theme_id);

-- Allow admin to update quiz questions
CREATE POLICY "Admin can update quiz_questions" ON public.quiz_questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
