-- Customers table (public ordering app users identified by phone)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer saved addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  address_text TEXT NOT NULL,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Public access (phone number acts as the natural key/identifier)
CREATE POLICY "Public access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to customer addresses" ON public.customer_addresses FOR ALL USING (true) WITH CHECK (true);

-- Add delivery as a valid order type
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'));

-- Add delivery_address column if not present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
