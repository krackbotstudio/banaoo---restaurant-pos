-- Outlet-scoped inventory RLS + sync owner_id from outlet.
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owners_manage_inventory ON public.inventory_items;
DROP POLICY IF EXISTS inventory_outlet_access ON public.inventory_items;

CREATE POLICY inventory_outlet_access ON public.inventory_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = inventory_items.outlet_id AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_outlet_assignments a
      WHERE a.outlet_id = inventory_items.outlet_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = inventory_items.outlet_id AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_outlet_assignments a
      WHERE a.outlet_id = inventory_items.outlet_id AND a.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.sync_inventory_owner_id()
RETURNS trigger AS $$
BEGIN
  SELECT owner_id INTO NEW.owner_id FROM public.outlets WHERE id = NEW.outlet_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_owner_id ON public.inventory_items;
CREATE TRIGGER trg_sync_inventory_owner_id
  BEFORE INSERT OR UPDATE OF outlet_id ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_owner_id();
