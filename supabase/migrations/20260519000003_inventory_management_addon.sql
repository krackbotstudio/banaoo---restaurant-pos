-- Creates subscription_addons + inventory_items.
-- Supabase SQL Editor: select ALL lines (Ctrl+A), then Run once.

CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  addon_type text NOT NULL,
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
      'inventory_management'
    )
  );

ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owners_manage_subscription_addons ON public.subscription_addons;
CREATE POLICY owners_manage_subscription_addons
  ON public.subscription_addons FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  unit text NOT NULL DEFAULT 'pcs',
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold numeric NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_outlet
  ON public.inventory_items (outlet_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_owner
  ON public.inventory_items (owner_id);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owners_manage_inventory ON public.inventory_items;
CREATE POLICY owners_manage_inventory
  ON public.inventory_items FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
