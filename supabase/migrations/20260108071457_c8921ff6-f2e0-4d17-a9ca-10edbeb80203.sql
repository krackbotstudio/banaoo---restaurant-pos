-- Orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway')),
  table_number text,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number(outlet_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_count integer;
  order_num text;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM public.orders o
  WHERE o.outlet_id = generate_order_number.outlet_id
    AND DATE(o.created_at) = CURRENT_DATE;
  
  order_num := to_char(CURRENT_DATE, 'MMDD') || '-' || LPAD(today_count::text, 3, '0');
  RETURN order_num;
END;
$$;

-- RLS policies for orders
CREATE POLICY "Outlet owners can manage orders"
  ON public.orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = orders.outlet_id
    AND outlets.owner_id = auth.uid()
  ));

CREATE POLICY "Staff can view outlet orders"
  ON public.orders FOR SELECT
  USING (is_staff_of_outlet(auth.uid(), outlet_id));

CREATE POLICY "Staff can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (is_staff_of_outlet(auth.uid(), outlet_id) OR EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = orders.outlet_id
    AND outlets.owner_id = auth.uid()
  ));

CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  USING (is_staff_of_outlet(auth.uid(), outlet_id) OR EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = orders.outlet_id
    AND outlets.owner_id = auth.uid()
  ));

-- RLS policies for order_items
CREATE POLICY "Outlet owners can manage order items"
  ON public.order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN outlets ON outlets.id = o.outlet_id
    WHERE o.id = order_items.order_id
    AND outlets.owner_id = auth.uid()
  ));

CREATE POLICY "Staff can view order items"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND is_staff_of_outlet(auth.uid(), o.outlet_id)
  ));

CREATE POLICY "Staff can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (is_staff_of_outlet(auth.uid(), o.outlet_id) OR EXISTS (
      SELECT 1 FROM outlets WHERE outlets.id = o.outlet_id AND outlets.owner_id = auth.uid()
    ))
  ));

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;