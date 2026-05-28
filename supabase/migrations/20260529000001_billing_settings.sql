-- Owner billing preferences and saved payment methods (card/UPI metadata for checkout UX)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_auto_pay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.billing_payment_methods IS
  'Array of { id, type, brand, last4, exp_month?, exp_year?, vpa?, is_default, created_at }';
