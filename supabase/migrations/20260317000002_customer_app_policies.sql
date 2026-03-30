-- Allow anyone to read active outlets (customer-facing app)
CREATE POLICY "Anyone can view active outlets"
  ON public.outlets FOR SELECT
  USING (is_active = true);

-- Add source column to orders if not exists (for tracking online vs POS orders)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pos',
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Allow anonymous order creation via service role (handled by edge function)
-- No RLS policy needed for anon inserts - edge function uses service role
