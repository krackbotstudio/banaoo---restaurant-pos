-- Customer UPI payments (not Razorpay) + outlet/profile payment settings

-- Profile-level defaults (fallback for all outlets)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS upi_display_name text,
  ADD COLUMN IF NOT EXISTS upi_qr_url text,
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean NOT NULL DEFAULT true;

-- Per-outlet overrides (NULL = use profile default)
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS upi_display_name text,
  ADD COLUMN IF NOT EXISTS upi_qr_url text,
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean;

-- Order payment tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cod', 'upi')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'awaiting_confirmation', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (outlet_id, payment_status);

-- Payment records (UPI references, audit)
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'upi' CHECK (method IN ('cod', 'upi')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_confirmation', 'paid', 'failed', 'cancelled')),
  upi_vpa text,
  customer_reference text,
  notes text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_outlet_status ON public.order_payments (outlet_id, status);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Owners manage payments for their outlets
DROP POLICY IF EXISTS "order_payments_owner_all" ON public.order_payments;
CREATE POLICY "order_payments_owner_all"
  ON public.order_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = order_payments.outlet_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = order_payments.outlet_id AND o.owner_id = auth.uid()
    )
  );

-- Staff can view outlet payments
DROP POLICY IF EXISTS "order_payments_staff_select" ON public.order_payments;
CREATE POLICY "order_payments_staff_select"
  ON public.order_payments FOR SELECT
  USING (public.is_staff_of_outlet(auth.uid(), outlet_id));

-- Customers can insert/select own payment row via service role API only (no direct client insert policy)

DROP TRIGGER IF EXISTS update_order_payments_updated_at ON public.order_payments;
CREATE TRIGGER update_order_payments_updated_at
  BEFORE UPDATE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public read of payment settings fields on active outlets (already have outlets_public_active_select)
-- Extend profiles public select already exists for branding
