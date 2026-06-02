-- Allow deleting menu items while preserving names on past orders.
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;

ALTER TABLE public.order_items
  ALTER COLUMN menu_item_id DROP NOT NULL;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;

UPDATE public.order_items oi
SET item_name = mi.name
FROM public.menu_items mi
WHERE oi.menu_item_id = mi.id
  AND (oi.item_name IS NULL OR oi.item_name = '');
