-- Migración: 017_bug_reports.sql

CREATE TYPE bug_status AS ENUM ('new', 'reviewing', 'resolved', 'rejected');

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  page_url text NOT NULL,
  description text NOT NULL,
  screenshot_url text,
  topic_id uuid REFERENCES public.topics(id),
  status bug_status DEFAULT 'new',
  credit_granted_days integer DEFAULT 0,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_bugs_user ON public.bug_reports(user_id);
CREATE INDEX idx_bugs_status ON public.bug_reports(status);

-- RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_bugs" ON public.bug_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_own_bugs" ON public.bug_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_manage_bugs" ON public.bug_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
