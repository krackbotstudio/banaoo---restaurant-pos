-- Purchased add-ons (extra outlets, staff seats, integrations, customer ordering).
CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  addon_type text NOT NULL CHECK (
    addon_type IN (
      'extra_outlet',
      'extra_staff',
      'swiggy_integration',
      'zomato_integration',
      'customer_ordering',
      'inventory_management'
    )
  ),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  period_months integer,
  expires_at timestamptz,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_addons_user_id
  ON public.subscription_addons (user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_addons_user_active
  ON public.subscription_addons (user_id, status)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_addons_razorpay_order_id
  ON public.subscription_addons (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
