-- Global shared image library for menu items
-- Images are cached here after first fetch so all users benefit from the pool

CREATE TABLE IF NOT EXISTS public.menu_item_images (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  search_term text        NOT NULL,           -- normalised dish name, e.g. "paneer tikka"
  image_url   text        NOT NULL,           -- full-size image URL
  thumb_url   text        NOT NULL,           -- thumbnail URL (smaller, for picker grid)
  source      text        NOT NULL DEFAULT 'unknown', -- 'TheMealDB' | 'Wikipedia' | 'Unsplash'
  created_at  timestamptz DEFAULT now()
);

-- Fast lookup by dish name
CREATE INDEX IF NOT EXISTS idx_menu_item_images_search_term
  ON public.menu_item_images (search_term);

-- Prevent exact duplicates (same image URL for same dish)
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_item_images_unique
  ON public.menu_item_images (search_term, image_url);

-- RLS: anyone can read (shared global library), only service role can write
ALTER TABLE public.menu_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access on menu_item_images"
  ON public.menu_item_images FOR SELECT USING (true);
