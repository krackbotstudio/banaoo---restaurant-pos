-- Add improvements tracking columns to order_payments
ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS gateway_response JSONB,
  ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ;
