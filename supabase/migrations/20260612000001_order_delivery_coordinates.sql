-- Delivery coordinates for online orders (checkout map pin)

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
