-- CMS-managed complimentary access and internal test accounts (no payment required)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complimentary_plan text
    CHECK (complimentary_plan IS NULL OR complimentary_plan IN ('starter', 'professional', 'enterprise')),
  ADD COLUMN IF NOT EXISTS complimentary_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.is_test_account IS
  'Full Expand access for QA/demo — all modules and features, no Razorpay payment.';
COMMENT ON COLUMN public.profiles.billing_exempt IS
  'When true, owner gets an active subscription at complimentary_plan without payment.';
COMMENT ON COLUMN public.profiles.complimentary_plan IS
  'Plan tier granted while billing_exempt is true (starter/professional/enterprise).';

-- Promote known internal email to test account (idempotent)
UPDATE public.profiles p
SET
  is_test_account = true,
  billing_exempt = true,
  complimentary_plan = 'enterprise',
  account_status = 'approved',
  onboarding_completed = COALESCE(onboarding_completed, true)
FROM public.users u
WHERE u.id = p.user_id
  AND LOWER(u.email) = LOWER('krackbotstudio@gmail.com');
