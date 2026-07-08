-- Support direct merchant API key connection (in addition to partner OAuth)

ALTER TABLE public.razorpay_connections
  ADD COLUMN IF NOT EXISTS connection_mode TEXT NOT NULL DEFAULT 'oauth',
  ADD COLUMN IF NOT EXISTS merchant_key_id TEXT,
  ADD COLUMN IF NOT EXISTS merchant_key_secret_enc TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'razorpay_connections_connection_mode_check'
  ) THEN
    ALTER TABLE public.razorpay_connections
      ADD CONSTRAINT razorpay_connections_connection_mode_check
      CHECK (connection_mode IN ('oauth', 'api_keys'));
  END IF;
END$$;
