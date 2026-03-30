-- Create restaurant_tables table for floor plan layout
CREATE TABLE public.restaurant_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  table_number text NOT NULL,
  shape text NOT NULL DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rectangle')),
  seats integer NOT NULL DEFAULT 4,
  x_position numeric NOT NULL DEFAULT 50,
  y_position numeric NOT NULL DEFAULT 50,
  width numeric NOT NULL DEFAULT 10,
  height numeric NOT NULL DEFAULT 10,
  rotation integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Owners can manage their outlet's tables
CREATE POLICY "Outlet owners can manage tables"
ON public.restaurant_tables
FOR ALL
USING (EXISTS (
  SELECT 1 FROM outlets
  WHERE outlets.id = restaurant_tables.outlet_id
  AND outlets.owner_id = auth.uid()
));

-- Staff can view tables for their assigned outlets
CREATE POLICY "Staff can view outlet tables"
ON public.restaurant_tables
FOR SELECT
USING (is_staff_of_outlet(auth.uid(), outlet_id));

-- Add trigger for updated_at
CREATE TRIGGER update_restaurant_tables_updated_at
BEFORE UPDATE ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_restaurant_tables_outlet ON public.restaurant_tables(outlet_id);

-- Enable realtime for table status updates
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;