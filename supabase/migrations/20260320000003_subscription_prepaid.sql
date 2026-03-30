-- Add prepaid subscription columns
-- Switches from Razorpay Subscriptions API (recurring) to Orders API (prepaid)

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS period_months  integer,
  ADD COLUMN IF NOT EXISTS expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_order_id   text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

-- Unique index on order ID to prevent duplicate payment processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id
  ON public.subscriptions (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
