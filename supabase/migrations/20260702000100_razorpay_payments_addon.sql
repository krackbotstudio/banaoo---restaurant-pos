-- Razorpay payments integration (restaurant-level OAuth/account link, outlet-level transactions)

-- 1) Extend order payment model for gateway-native statuses and metadata
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Expand allowed payment methods/statuses without assuming prior constraint names
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END$$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (
    payment_method IS NULL OR
    payment_method IN ('cod', 'upi', 'online')
  );

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END$$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (
    payment_status IN (
      'not_required',
      'pending',
      'created',
      'authorized',
      'awaiting_confirmation',
      'paid',
      'failed',
      'cancelled',
      'refunded',
      'partially_refunded'
    )
  );

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_signature TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.order_payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%method IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.order_payments DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_payments_method_check'
  ) THEN
    ALTER TABLE public.order_payments
      ADD CONSTRAINT order_payments_method_check
      CHECK (method IN ('cod', 'upi', 'online'));
  END IF;
END$$;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.order_payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.order_payments DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_payments_status_check'
  ) THEN
    ALTER TABLE public.order_payments
      ADD CONSTRAINT order_payments_status_check
      CHECK (
        status IN (
          'pending',
          'created',
          'authorized',
          'awaiting_confirmation',
          'paid',
          'failed',
          'cancelled',
          'refunded',
          'partially_refunded'
        )
      );
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_gateway_order_id
  ON public.order_payments (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_gateway_payment_id
  ON public.order_payments (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

-- 2) Restaurant-level Razorpay connection (one account for all outlets)
CREATE TABLE IF NOT EXISTS public.razorpay_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id TEXT,
  account_name TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  connected_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{
    "online_payments_enabled": true,
    "allow_cod": true,
    "allow_partial_refunds": true,
    "webhook_secret": null
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

CREATE INDEX IF NOT EXISTS idx_razorpay_connections_owner
  ON public.razorpay_connections(owner_id);

-- 3) Webhook/audit events + refund records
CREATE TABLE IF NOT EXISTS public.razorpay_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_razorpay_events_owner_time
  ON public.razorpay_events(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_payment_id UUID NOT NULL REFERENCES public.order_payments(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  gateway_refund_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  initiated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order
  ON public.order_refunds(order_id, created_at DESC);

ALTER TABLE public.razorpay_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "razorpay_connections_owner_all" ON public.razorpay_connections;
CREATE POLICY "razorpay_connections_owner_all"
  ON public.razorpay_connections FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "order_refunds_owner_all" ON public.order_refunds;
CREATE POLICY "order_refunds_owner_all"
  ON public.order_refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = order_refunds.outlet_id
        AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = order_refunds.outlet_id
        AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_refunds_staff_select" ON public.order_refunds;
CREATE POLICY "order_refunds_staff_select"
  ON public.order_refunds FOR SELECT
  USING (public.is_staff_of_outlet(auth.uid(), outlet_id));

DROP TRIGGER IF EXISTS update_razorpay_connections_updated_at ON public.razorpay_connections;
CREATE TRIGGER update_razorpay_connections_updated_at
  BEFORE UPDATE ON public.razorpay_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_refunds_updated_at ON public.order_refunds;
CREATE TRIGGER update_order_refunds_updated_at
  BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
