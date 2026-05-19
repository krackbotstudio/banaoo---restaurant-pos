-- Internal test account: full Expand (enterprise) subscription + approved account.
-- Email: krackbotstudio@gmail.com
-- Safe to re-run (idempotent).

DO $$
DECLARE
  target_user_id uuid;
  internal_order_id text := 'internal-test-krackbotstudio@gmail.com';
BEGIN
  SELECT id INTO target_user_id
  FROM public.users
  WHERE LOWER(email) = LOWER('krackbotstudio@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found in public.users: krackbotstudio@gmail.com — sign in once so the account exists, then re-run.';
  END IF;

  UPDATE public.profiles
  SET
    account_status = 'approved',
    onboarding_completed = COALESCE(onboarding_completed, true)
  WHERE user_id = target_user_id;

  UPDATE public.subscriptions
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE user_id = target_user_id
    AND status IN ('active', 'trialing', 'past_due');

  INSERT INTO public.subscriptions (
    user_id,
    plan_type,
    status,
    period_months,
    expires_at,
    current_period_start,
    current_period_end,
    razorpay_order_id,
    razorpay_payment_id,
    trial_ends_at
  )
  VALUES (
    target_user_id,
    'enterprise',
    'active',
    120,
    NOW() + INTERVAL '10 years',
    NOW(),
    NOW() + INTERVAL '10 years',
    internal_order_id,
    internal_order_id,
    NULL
  )
  ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL
  DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    period_months = EXCLUDED.period_months,
    expires_at = EXCLUDED.expires_at,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancelled_at = NULL,
    updated_at = NOW();

  RAISE NOTICE 'Granted enterprise subscription to user % (krackbotstudio@gmail.com)', target_user_id;
END $$;
