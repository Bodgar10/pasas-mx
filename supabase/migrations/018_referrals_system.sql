-- Migración: 018_referrals_system.sql

CREATE TYPE referral_status AS ENUM ('pending', 'qualified', 'expired');

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.users(id),
  referred_user_id uuid NOT NULL REFERENCES public.users(id),
  code_used text NOT NULL,
  status referral_status DEFAULT 'pending',
  qualified_at timestamptz,
  reward_granted boolean DEFAULT false,
  reward_granted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(referrer_user_id, referred_user_id)
);

CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  free_months_pending integer DEFAULT 0,
  free_months_used integer DEFAULT 0,
  total_referrals_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

-- Trigger: generar referral_code cuando subscription pasa a 'active'
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    UPDATE public.users
    SET referral_code = UPPER(
      SUBSTRING(REPLACE(COALESCE(full_name, 'USER'), ' ', ''), 1, 3) ||
      LPAD((RANDOM() * 999)::int::text, 3, '0')
    )
    WHERE id = NEW.user_id AND referral_code IS NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_generate_referral_code
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();
