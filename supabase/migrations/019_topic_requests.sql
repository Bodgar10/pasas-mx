CREATE TABLE public.topic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  grade integer NOT NULL,
  education_level text NOT NULL,
  topic_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_topic_requests_user ON public.topic_requests(user_id);
CREATE INDEX idx_topic_requests_status ON public.topic_requests(status);
CREATE INDEX idx_topic_requests_created ON public.topic_requests(created_at DESC);

ALTER TABLE public.topic_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_create_own_requests" ON public.topic_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_view_own_requests" ON public.topic_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_manage_requests" ON public.topic_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
