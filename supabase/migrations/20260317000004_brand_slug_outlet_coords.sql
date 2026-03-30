-- Add brand ordering fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ordering_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS brand_name TEXT;

CREATE INDEX IF NOT EXISTS profiles_ordering_slug_idx ON public.profiles(ordering_slug);

-- Add GPS coordinates to outlets for distance-based sorting
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Allow public to look up a profile by ordering_slug (for brand page)
-- (safe: only slug + brand_name + user_id are used in customer-facing queries)
CREATE POLICY "Public can view profiles by ordering slug"
  ON public.profiles FOR SELECT
  USING (ordering_slug IS NOT NULL);
