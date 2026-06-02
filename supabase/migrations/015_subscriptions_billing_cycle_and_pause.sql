-- Migración: 015_subscriptions_billing_cycle_and_pause.sql

-- Billing cycle
CREATE TYPE billing_cycle AS ENUM ('monthly', 'semestral', 'annual');

ALTER TABLE public.subscriptions
  ADD COLUMN billing_cycle billing_cycle NOT NULL DEFAULT 'monthly';

-- Cohort escolar para análisis de retención
ALTER TABLE public.subscriptions
  ADD COLUMN academic_period text;
  -- Formato: '2026-2027', '2027-2028'

-- Sistema de pausa
ALTER TABLE public.subscriptions
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN paused_until timestamptz,
  ADD COLUMN pause_count_lifetime integer DEFAULT 0,
  ADD COLUMN pause_count_year integer DEFAULT 0;
  -- Cap: máximo 2 pausas por año académico

-- Tracking de aviso PROFECO 5 días
ALTER TABLE public.subscriptions
  ADD COLUMN renewal_notice_sent_at timestamptz;

-- Migrar suscripciones existentes a 'monthly'
UPDATE public.subscriptions SET billing_cycle = 'monthly' WHERE billing_cycle IS NULL;

-- Índices
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_paused_until ON public.subscriptions(paused_until)
  WHERE paused_until IS NOT NULL;
