-- Google Pay India add-on + owner provider selection + connection table

ALTER TABLE public.subscription_addons
  DROP CONSTRAINT IF EXISTS subscription_addons_addon_type_check;

ALTER TABLE public.subscription_addons
  ADD CONSTRAINT subscription_addons_addon_type_check CHECK (
    addon_type IN (
      'extra_outlet',
      'extra_staff',
      'swiggy_integration',
      'zomato_integration',
      'customer_ordering',
      'inventory_management',
      'whatsapp_integration',
      'shiprocket_delivery',
      'razorpay_payments',
      'google_pay_india'
    )
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS online_payment_provider TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_online_payment_provider_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_online_payment_provider_check
      CHECK (
        online_payment_provider IS NULL
        OR online_payment_provider IN ('razorpay', 'google_pay')
      );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.google_pay_connections (
  owner_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  merchant_vpa TEXT,
  payee_name TEXT,
  mcc TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_pay_connections_mcc_check CHECK (
    mcc IS NULL OR mcc ~ '^[0-9]{4}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_google_pay_connections_enabled
  ON public.google_pay_connections (owner_id)
  WHERE is_enabled = true AND is_configured = true;

COMMENT ON TABLE public.google_pay_connections IS
  'Owner-scoped Google Pay India (direct UPI) merchant configuration.';

COMMENT ON COLUMN public.profiles.online_payment_provider IS
  'Active online checkout provider: razorpay | google_pay';
