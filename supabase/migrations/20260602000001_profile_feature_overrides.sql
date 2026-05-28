-- Per-user CMS feature overrides (force enable/disable beyond plan tier)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.feature_overrides IS
  'CMS overrides for module access, e.g. {"customerOrdering": true, "inventoryManagement": false}';
