-- Add rider latitude and longitude columns to public.shiprocket_shipments table
ALTER TABLE public.shiprocket_shipments
  ADD COLUMN IF NOT EXISTS rider_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rider_longitude DOUBLE PRECISION;
