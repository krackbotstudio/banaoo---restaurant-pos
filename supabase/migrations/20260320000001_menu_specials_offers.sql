-- Add specials and offers fields to menu_items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_label text NOT NULL DEFAULT 'Today''s Special',
  ADD COLUMN IF NOT EXISTS offer_label text,
  ADD COLUMN IF NOT EXISTS offer_price numeric(10,2);

COMMENT ON COLUMN menu_items.is_special    IS 'Whether this item is highlighted as a special (e.g. Today''s Special)';
COMMENT ON COLUMN menu_items.special_label IS 'Label shown on special badge: Today''s Special | Chef''s Pick | Must Try | New';
COMMENT ON COLUMN menu_items.offer_label   IS 'Short offer text shown as badge, e.g. "20% OFF" or "₹50 OFF"';
COMMENT ON COLUMN menu_items.offer_price   IS 'Discounted price; when set the original base_price shows as strikethrough';
