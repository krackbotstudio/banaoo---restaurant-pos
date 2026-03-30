-- Add onboarding fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Mark any existing users as having completed onboarding
-- (so they don't get stuck after the migration)
UPDATE public.profiles SET onboarding_completed = true WHERE onboarding_completed = false;
