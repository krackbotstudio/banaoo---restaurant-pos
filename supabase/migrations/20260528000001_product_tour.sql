-- Product tour progress on owner profiles (staff use localStorage fallback)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS product_tour_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_tour_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_tour_modules jsonb NOT NULL DEFAULT '[]'::jsonb;
