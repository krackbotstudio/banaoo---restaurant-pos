-- Inventory categories, unit cost, and stock movement history.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric CHECK (unit_cost IS NULL OR unit_cost >= 0);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  delta numeric NOT NULL,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
  ON public.inventory_movements (inventory_item_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movements_outlet_access ON public.inventory_movements;
CREATE POLICY inventory_movements_outlet_access ON public.inventory_movements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_items i
      JOIN public.outlets o ON o.id = i.outlet_id
      WHERE i.id = inventory_movements.inventory_item_id
        AND (
          o.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.staff_outlet_assignments a
            WHERE a.outlet_id = o.id AND a.user_id = auth.uid()
          )
        )
    )
  );
