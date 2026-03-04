
-- Add new profile columns for enhanced onboarding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_frequency text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS next_pay_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spending_concerns text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_context text;
