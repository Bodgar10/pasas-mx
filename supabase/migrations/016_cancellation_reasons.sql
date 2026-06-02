-- Migración: 016_cancellation_reasons.sql

CREATE TYPE cancellation_category AS ENUM (
  'precio',
  'no_la_uso',
  'mi_hijo_no_quiso',
  'encontre_algo_mejor',
  'falla_tecnica',
  'vacaciones',
  'otro'
);

CREATE TABLE public.cancellation_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  subscription_id uuid REFERENCES public.subscriptions(id),
  reason_category cancellation_category NOT NULL,
  reason_detail text,
  pause_offered boolean DEFAULT false,
  pause_accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cancellation_user ON public.cancellation_reasons(user_id);
CREATE INDEX idx_cancellation_category ON public.cancellation_reasons(reason_category);

-- RLS
ALTER TABLE public.cancellation_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_cancellations" ON public.cancellation_reasons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_view_all_cancellations" ON public.cancellation_reasons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_create_own_cancellations" ON public.cancellation_reasons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
