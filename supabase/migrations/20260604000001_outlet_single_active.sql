-- Only one outlet per owner may be enabled (is_active) at a time.
-- If multiple are active today, keep the most recently updated and disable the rest.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY owner_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC
         ) AS rn
  FROM public.outlets
  WHERE is_active = true
)
UPDATE public.outlets o
SET is_active = false,
    updated_at = NOW()
FROM ranked r
WHERE o.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outlets_one_active_per_owner
  ON public.outlets (owner_id)
  WHERE is_active = true;

COMMENT ON INDEX idx_outlets_one_active_per_owner IS
  'Ensures at most one enabled outlet per owner for POS and customer ordering.';
