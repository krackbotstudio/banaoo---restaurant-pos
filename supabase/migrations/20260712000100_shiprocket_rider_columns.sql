-- Add rider assignment columns to public.shiprocket_shipments table
ALTER TABLE public.shiprocket_shipments
  ADD COLUMN IF NOT EXISTS rider_name TEXT,
  ADD COLUMN IF NOT EXISTS rider_phone TEXT,
  ADD COLUMN IF NOT EXISTS rider_vehicle TEXT,
  ADD COLUMN IF NOT EXISTS rider_id TEXT,
  ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMPTZ;
