-- Add new columns to restaurant_tables for reservation tracking
ALTER TABLE public.restaurant_tables
ADD COLUMN IF NOT EXISTS zone text NOT NULL DEFAULT 'indoor',
ADD COLUMN IF NOT EXISTS current_customer_name text,
ADD COLUMN IF NOT EXISTS reserved_time timestamptz,
ADD COLUMN IF NOT EXISTS party_size integer;

-- Create table_zones table for managing zones
CREATE TABLE IF NOT EXISTS public.table_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.table_zones ENABLE ROW LEVEL SECURITY;

-- RLS policies for table_zones
CREATE POLICY "Outlet owners can manage zones"
ON public.table_zones FOR ALL
USING (EXISTS (
  SELECT 1 FROM outlets WHERE outlets.id = table_zones.outlet_id AND outlets.owner_id = auth.uid()
));

CREATE POLICY "Staff can view zones"
ON public.table_zones FOR SELECT
USING (is_staff_of_outlet(auth.uid(), outlet_id));

-- Insert default zones for existing outlets
INSERT INTO public.table_zones (outlet_id, name, sort_order)
SELECT DISTINCT outlet_id, 'Indoor', 1 FROM public.restaurant_tables
ON CONFLICT DO NOTHING;